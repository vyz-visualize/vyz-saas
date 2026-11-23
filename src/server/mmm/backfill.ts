import "server-only";

// Carga do histórico do MMM (docs/MMM.md): conta × mês, só no nível de campanha e sem
// breakdown, gravando só em mmm.raw_insights e mmm.media_daily (pela função
// public.mmm_save_backfill, que também recalcula mmm.daily do mês). Nada de
// writeDataset/pruneStale: o histórico nunca apaga o que a sincronização de todo dia grava.
//
// Roda no cron próprio (/api/cron/mmm, vários horários por dia, com os 300 s inteiros), em
// duas fases por rodada:
//   1. pedir: os relatórios assíncronos da Meta de vários meses de uma vez (até 3 esperando
//      por conta); a Meta processa entre uma rodada e outra;
//   2. baixar: os relatórios prontos e os meses do Google, 6 trabalhos por vez, sempre de
//      contas diferentes, do mês mais antigo para o mais novo (a fila decide: mmm_claim_backfill).
// Só anda com mmm.backfill_control.ativo (scripts/mmm/backfill.ts liga e pausa).
// Meta: só os últimos 37 meses (o começo do mês mais velho fica preso a esse limite); acima de
// 75% do x-fb-ads-insights-throttle, a Meta para até a próxima rodada. Google: uma busca GAQL por
// mês, até o teto diário de operações do token (GOOGLE_ADS_DAILY_OPS, padrão 2.000).

import { isRateLimited, runPool } from "@/features/sync/throttle";
import { pauseAfterRateLimit, pauseCalls, pausedPlatforms, RATE_LIMIT_PAUSE_SECONDS } from "@/server/cache/redis";
import { ADS, adsHeaders } from "@/server/integrations/providers/google";
import { metaAuthParams } from "@/server/integrations/meta-auth";
import { fetchJson } from "@/server/integrations/providers/http";
import { getValidAccessToken } from "@/server/integrations/tokens";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminSupabase } from "@/server/supabase/admin";
import type { GoogleRow, MetaInsight } from "@/server/sync/live/map";
import { googleMediaRows, META_THROTTLE_PAUSE, metaMediaRows, metaMonthRange, metaThrottle, monthRange, requestHash } from "./rows";

const GRAPH = "https://graph.facebook.com/v26.0";
const META_FIELDS = "campaign_id,campaign_name,date_start,spend,impressions,clicks,actions,action_values";
/** Espera curta pelo relatório que a fase de baixar acabou de pedir (depois, fica para a próxima vez). */
const META_POLL_MS = 8_000;
/** Trabalhos ao mesmo tempo (sempre de contas diferentes). */
export const BACKFILL_CONCURRENCY = 6;
/** Relatórios da Meta pedidos por vez na fase de pedir. */
const META_REQUEST_BATCH = 15;

type Job = { id: number; workspace_id: string; ad_account_id: string; platform_id: "meta" | "google"; mes: string; status: string; tentativas: number; report_run_id: string | null };
type Account = { id: string; external_id: string; connection_id: string; currency: string; metadata: unknown };
type Outcome = "concluido" | "aguardando" | "pausado" | "erro";
type RunResult = { outcome: Outcome; reportRunId?: string; error?: string; raw?: unknown; rows?: ReturnType<typeof metaMediaRows> };


export type BackfillSummary = {
  /** Relatórios da Meta pedidos na fase de pedir. */
  requested: number;
  ran: number;
  concluded: number;
  waiting: number;
  paused: number;
  failed: number;
  durationMs: number;
  skipped?: string;
};

/** Hoje em Brasília (a janela de 37 meses da Meta conta a partir daqui). */
const todaySP = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const metaAuth = metaAuthParams;

/** Chamada à Graph devolvendo o corpo e o uso da cota de insights (o token só vai na URL da Graph, nunca no log). */
async function graph<T>(path: string, params: Record<string, string>, token: string, method: "GET" | "POST" = "GET"): Promise<{ body: T; throttle: number }> {
  const url = new URL(path.startsWith("http") ? path : `${GRAPH}/${path}`);
  const all = { ...params, ...metaAuth(token) };
  const init: RequestInit = { method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(45_000) };
  if (method === "GET") for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v);
  else init.body = new URLSearchParams(all);
  const res = await fetch(url, init);
  const throttle = metaThrottle(res.headers.get("x-fb-ads-insights-throttle"));
  const body = (await res.json().catch(() => null)) as T & { error?: { code?: number; error_subcode?: number; type?: string } };
  if (!res.ok || !body) {
    const e = body?.error;
    const err = Object.assign(new Error(`Meta (MMM): HTTP ${res.status} code=${e?.code ?? "?"} error_subcode=${e?.error_subcode ?? "?"} type=${e?.type ?? "?"}`), { status: res.status });
    throw err;
  }
  return { body, throttle };
}

type MetaRun = { async_status?: string; async_percent_completion?: number };
type MetaPage = { data?: (MetaInsight & { campaign_name?: string })[]; paging?: { next?: string } };

const metaAct = (account: Account) => (account.external_id.startsWith("act_") ? account.external_id : `act_${account.external_id}`);

/** Pede o relatório assíncrono do mês (só o pedido: a Meta processa e a rodada segue). */
async function requestMeta(job: Job, account: Account, range: { from: string; to: string }, paused: Set<string>): Promise<string> {
  const token = await getValidAccessToken(account.connection_id);
  const { body, throttle } = await graph<{ report_run_id?: string }>(
    `${metaAct(account)}/insights`,
    { level: "campaign", fields: META_FIELDS, time_range: JSON.stringify({ since: range.from, until: range.to }), time_increment: "1", action_attribution_windows: '["7d_click","1d_view"]' },
    token,
    "POST",
  );
  if (throttle >= META_THROTTLE_PAUSE) paused.add("meta");
  if (!body.report_run_id) throw new Error("A Meta não devolveu o relatório.");
  return body.report_run_id;
}

async function runMeta(job: Job, account: Account, paused: Set<string>): Promise<RunResult> {
  const range = metaMonthRange(job.mes, todaySP());
  // o mês inteiro já saiu da janela de 37 meses da Meta: conclui sem linhas
  if (!range) return { outcome: "concluido", raw: { fora_da_janela_meta: true }, rows: [] };
  const token = await getValidAccessToken(account.connection_id);
  // sem relatório pedido (a fase de pedir não chegou nele): pede e espera um pouco
  const fresh = !job.report_run_id;
  const runId = job.report_run_id ?? (await requestMeta(job, account, range, paused));
  const deadline = Date.now() + (fresh ? META_POLL_MS : 0);
  for (;;) {
    const { body, throttle } = await graph<MetaRun>(runId, { fields: "async_status,async_percent_completion" }, token);
    if (throttle >= META_THROTTLE_PAUSE) paused.add("meta");
    if (body.async_status === "Job Completed") break;
    if (body.async_status === "Job Failed" || body.async_status === "Job Skipped") return { outcome: "erro", error: `Relatório da Meta: ${body.async_status}` };
    if (Date.now() >= deadline || paused.has("meta")) return { outcome: "aguardando", reportRunId: runId };
    await sleep(3_000);
  }
  const data: MetaPage["data"] = [];
  let next: string | undefined = `${runId}/insights`;
  for (let i = 0; next && i < 200; i++) {
    const page: { body: MetaPage; throttle: number } = await graph<MetaPage>(next, next.startsWith("http") ? {} : { limit: "500" }, token);
    data.push(...(page.body.data ?? []));
    next = page.body.paging?.next;
    if (page.throttle >= META_THROTTLE_PAUSE) paused.add("meta");
  }
  return { outcome: "concluido", raw: { report_run_id: runId, data }, rows: metaMediaRows(data, account.currency) };
}

type GoogleSearch = { results?: GoogleRow[]; nextPageToken?: string };

async function runGoogle(job: Job, account: Account): Promise<RunResult> {
  const token = await getValidAccessToken(account.connection_id);
  const customer = account.external_id.replace(/-/g, "");
  const login = (account.metadata as { login_customer_id?: unknown } | null)?.login_customer_id;
  const headers = adsHeaders(token, { "login-customer-id": typeof login === "string" && /^\d{10}$/.test(login) ? login : customer, "Content-Type": "application/json" });
  const { from, to } = monthRange(job.mes);
  const query = `SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '${from}' AND '${to}'`;
  const results: GoogleRow[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 50; i++) {
    const res: GoogleSearch = await fetchJson<GoogleSearch>(`${ADS}/customers/${customer}/googleAds:search`, { method: "POST", headers, body: JSON.stringify(pageToken ? { query, pageToken } : { query }), label: "Google (MMM): campanhas por dia", rejectCode: "provedor_recusou" });
    results.push(...(res.results ?? []));
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }
  return { outcome: "concluido", raw: { query, results }, rows: googleMediaRows(results, account.currency) };
}

type DB = ReturnType<typeof createAdminSupabase>;

async function claim(db: DB, limit: number, fase: "tudo" | "pedir"): Promise<{ jobs: Job[]; error?: { code?: string; message: string } }> {
  // as funções public.mmm_* (o schema mmm não é exposto na API)
  const r = await db.rpc("mmm_claim_backfill", { p_limit: limit, p_fase: fase });
  if (r.error) return { jobs: [], error: r.error };
  return { jobs: (r.data ?? []).map((j) => ({ ...j, platform_id: j.platform_id === "google" ? "google" : "meta", report_run_id: j.report_run_id ?? null })) };
}

async function accountsOf(db: DB, jobs: Job[]): Promise<Map<string, Account>> {
  const ids = [...new Set(jobs.map((j) => j.ad_account_id))];
  return new Map(((await db.from("ad_accounts").select("id, external_id, connection_id, currency, metadata").in("id", ids)).data ?? []).map((a) => [a.id, a as Account]));
}

/** Uma rodada da carga, dentro de budgetMs. Desligada (ou sem a migration), não faz nada. */
export async function runBackfillRound(opts: { budgetMs: number }): Promise<BackfillSummary> {
  const started = Date.now();
  const timeLeft = () => opts.budgetMs - (Date.now() - started);
  const db = createAdminSupabase();
  const summary: BackfillSummary = { requested: 0, ran: 0, concluded: 0, waiting: 0, paused: 0, failed: 0, durationMs: 0 };
  // com Redis, começa com as pausas que outras funções já pediram (limite ou cota do dia)
  const shared = await pausedPlatforms();
  const paused = new Set<string>(shared);
  const googleCap = Number(process.env.GOOGLE_ADS_DAILY_OPS) || 2000;
  let googleOps: number | null = null;
  const today = todaySP();

  const back = async (job: Job, status: "aguardando" | "pendente" | "erro", erro: string | null, reportRunId: string | null, refund: boolean) => {
    // sem erro ou sem relatório: o padrão da função (null) limpa o campo
    await db.rpc("mmm_update_backfill", { p_id: job.id, p_status: status, p_erro: erro ?? undefined, p_report_run_id: reportRunId ?? undefined, p_refund: refund });
  };
  /** Grava o bruto e as linhas do mês e conclui o trabalho (mmm_save_backfill). */
  const save = async (job: Job, account: Account, payload: unknown, rows: unknown[]) => {
    const { from, to } = monthRange(job.mes);
    const raw = [{ date_from: from, date_to: to, request_hash: requestHash([job.platform_id, account.external_id, from, to, "campaign"]), payload }];
    const saved = await db.rpc("mmm_save_backfill", { p_id: job.id, p_raw: raw as Json, p_rows: rows as Json });
    if (saved.error) throw new Error(saved.error.message);
  };
  const failed = async (job: Job, err: unknown) => {
    if (isRateLimited(err)) {
      paused.add(job.platform_id);
      await pauseAfterRateLimit(job.platform_id);
      summary.paused++;
      return back(job, "pendente", null, job.report_run_id, true);
    }
    summary.failed++;
    console.error("[vyz] MMM: carga falhou", job.platform_id, job.mes, err instanceof Error ? err.message.slice(0, 200) : err);
    return back(job, "erro", err instanceof Error ? err.message.slice(0, 300) : "Falhou.", null, false);
  };

  // ---- fase 1: pedir os relatórios da Meta de vários meses de uma vez ----
  while (timeLeft() > 60_000 && !paused.has("meta")) {
    const { jobs, error } = await claim(db, META_REQUEST_BATCH, "pedir");
    if (error) {
      // sem a migration aplicada (ou fora do ar): nada a fazer nesta rodada
      summary.skipped = error.code === "PGRST202" || error.code === "42883" ? "sem a base do MMM" : error.message.slice(0, 120);
      summary.durationMs = Date.now() - started;
      return summary;
    }
    if (!jobs.length) break;
    const accounts = await accountsOf(db, jobs);
    await runPool(jobs, BACKFILL_CONCURRENCY, async (job) => {
      const account = accounts.get(job.ad_account_id);
      if (paused.has("meta")) {
        summary.paused++;
        return back(job, "pendente", null, null, true);
      }
      if (!account?.connection_id) {
        summary.failed++;
        return back(job, "erro", "Conta sem conexão ativa.", null, false);
      }
      try {
        const range = metaMonthRange(job.mes, today);
        // o mês inteiro já saiu da janela de 37 meses da Meta: conclui sem linhas
        if (!range) {
          await save(job, account, { fora_da_janela_meta: true }, []);
          summary.concluded++;
          return;
        }
        const runId = await requestMeta(job, account, range, paused);
        summary.requested++;
        await back(job, "aguardando", null, runId, true);
      } catch (err) {
        await failed(job, err);
      }
    });
  }

  // ---- fase 2: baixar os relatórios prontos e os meses do Google ----
  const waitingHere = new Set<number>();
  while (timeLeft() > 45_000) {
    const { jobs, error } = await claim(db, BACKFILL_CONCURRENCY, "tudo");
    if (error) {
      summary.skipped = error.code === "PGRST202" || error.code === "42883" ? "sem a base do MMM" : error.message.slice(0, 120);
      break;
    }
    if (!jobs.length) {
      // só sobraram relatórios que ainda estão processando: espera um pouco e confere de novo
      if (waitingHere.size && timeLeft() > 75_000) {
        await sleep(15_000);
        continue;
      }
      break;
    }
    const accounts = await accountsOf(db, jobs);
    if (googleOps === null && jobs.some((j) => j.platform_id === "google")) googleOps = (await db.rpc("mmm_google_ops_today")).data ?? 0;

    await runPool(jobs, BACKFILL_CONCURRENCY, async (job) => {
      summary.ran++;
      const account = accounts.get(job.ad_account_id);
      // plataforma em pausa (limite) ou teto do Google: volta para a fila sem gastar tentativa
      if (paused.has(job.platform_id) || (job.platform_id === "google" && (googleOps ?? 0) >= googleCap)) {
        summary.paused++;
        return back(job, job.report_run_id ? "aguardando" : "pendente", null, job.report_run_id, true);
      }
      if (!account?.connection_id) {
        summary.failed++;
        return back(job, "erro", "Conta sem conexão ativa.", null, false);
      }
      try {
        if (job.platform_id === "google") googleOps = (googleOps ?? 0) + 1;
        const r = job.platform_id === "meta" ? await runMeta(job, account, paused) : await runGoogle(job, account);
        if (r.outcome === "aguardando") {
          summary.waiting++;
          waitingHere.add(job.id);
          return back(job, "aguardando", null, r.reportRunId ?? null, true);
        }
        waitingHere.delete(job.id);
        if (r.outcome === "erro") {
          summary.failed++;
          // relatório que falhou na Meta: o próximo tenta pedir de novo
          return back(job, "erro", r.error ?? "Falhou.", null, false);
        }
        await save(job, account, r.raw, r.rows ?? []);
        summary.concluded++;
      } catch (err) {
        waitingHere.delete(job.id);
        await failed(job, err);
      }
    });
    // tudo em pausa: não adianta pegar mais nesta rodada
    if (paused.has("meta") && (paused.has("google") || (googleOps ?? 0) >= googleCap)) break;
  }
  // a Meta passou de 75% da cota de relatórios: as outras funções também seguram
  if (paused.has("meta") && !shared.has("meta")) await pauseCalls("meta", RATE_LIMIT_PAUSE_SECONDS.meta);
  summary.durationMs = Date.now() - started;
  return summary;
}
