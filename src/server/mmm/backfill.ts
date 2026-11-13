import "server-only";

// Carga do histórico do MMM (docs/MMM.md): conta × mês, só no nível de campanha e sem
// breakdown, gravando só em mmm.raw_insights e mmm.media_daily (pela função
// public.mmm_save_backfill, que também recalcula mmm.daily do mês). Nada de
// writeDataset/pruneStale: o histórico nunca apaga o que a sincronização de todo dia grava.
//
// Roda dentro do /api/cron/sync, no tempo que sobra da sincronização, 3 trabalhos por vez.
// Só anda com mmm.backfill_control.ativo (começa desligado; scripts/mmm/backfill.ts liga e pausa).
// Meta: relatório assíncrono (pede, acompanha, busca); acima de 75% do x-fb-ads-insights-throttle,
// a Meta para até a próxima rodada. Google: uma busca GAQL por mês, até o teto diário de
// operações do token (GOOGLE_ADS_DAILY_OPS, padrão 2.000; o Explorer permite 2.880).

import { createHmac } from "node:crypto";
import { isRateLimited, runPool } from "@/features/sync/throttle";
import { serverEnv } from "@/server/env";
import { ADS, adsHeaders } from "@/server/integrations/providers/google";
import { fetchJson } from "@/server/integrations/providers/http";
import { getValidAccessToken } from "@/server/integrations/tokens";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminSupabase } from "@/server/supabase/admin";
import type { GoogleRow, MetaInsight } from "@/server/sync/live/map";
import { googleMediaRows, META_THROTTLE_PAUSE, metaMediaRows, metaThrottle, monthRange, requestHash } from "./rows";

const GRAPH = "https://graph.facebook.com/v26.0";
const META_FIELDS = "campaign_id,campaign_name,date_start,spend,impressions,clicks,actions,action_values";
/** Espera pelo relatório da Meta dentro da mesma rodada (depois, fica para a próxima). */
const META_POLL_MS = 20_000;
export const BACKFILL_CONCURRENCY = 3;

type Job = { id: number; workspace_id: string; ad_account_id: string; platform_id: "meta" | "google"; mes: string; status: string; tentativas: number; report_run_id: string | null };
type Account = { id: string; external_id: string; connection_id: string; currency: string; metadata: unknown };
type Outcome = "concluido" | "aguardando" | "pausado" | "erro";
type RunResult = { outcome: Outcome; reportRunId?: string; error?: string; raw?: unknown; rows?: ReturnType<typeof metaMediaRows> };


export type BackfillSummary = { ran: number; concluded: number; waiting: number; paused: number; failed: number; durationMs: number; skipped?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function metaAuth(token: string): Record<string, string> {
  const secret = serverEnv().META_APP_SECRET;
  return { access_token: token, ...(secret ? { appsecret_proof: createHmac("sha256", secret).update(token).digest("hex") } : {}) };
}

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

async function runMeta(job: Job, account: Account, paused: Set<string>): Promise<RunResult> {
  const token = await getValidAccessToken(account.connection_id);
  const act = account.external_id.startsWith("act_") ? account.external_id : `act_${account.external_id}`;
  const { from, to } = monthRange(job.mes);
  let runId = job.report_run_id;
  if (!runId) {
    const { body, throttle } = await graph<{ report_run_id?: string }>(
      `${act}/insights`,
      { level: "campaign", fields: META_FIELDS, time_range: JSON.stringify({ since: from, until: to }), time_increment: "1", action_attribution_windows: '["7d_click","1d_view"]' },
      token,
      "POST",
    );
    if (throttle >= META_THROTTLE_PAUSE) paused.add("meta");
    if (!body.report_run_id) return { outcome: "erro", error: "A Meta não devolveu o relatório." };
    runId = body.report_run_id;
  }
  // acompanha o relatório por alguns segundos; sem terminar, fica para a próxima rodada
  const deadline = Date.now() + META_POLL_MS;
  for (;;) {
    const { body, throttle } = await graph<MetaRun>(runId, { fields: "async_status,async_percent_completion" }, token);
    if (throttle >= META_THROTTLE_PAUSE) paused.add("meta");
    if (body.async_status === "Job Completed") break;
    if (body.async_status === "Job Failed" || body.async_status === "Job Skipped") return { outcome: "erro", error: `Relatório da Meta: ${body.async_status}` };
    if (Date.now() > deadline || paused.has("meta")) return { outcome: "aguardando", reportRunId: runId };
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

/** Uma rodada da carga, dentro de budgetMs. Desligada (ou sem a migration), não faz nada. */
export async function runBackfillRound(opts: { budgetMs: number }): Promise<BackfillSummary> {
  const started = Date.now();
  const db = createAdminSupabase();
  const summary: BackfillSummary = { ran: 0, concluded: 0, waiting: 0, paused: 0, failed: 0, durationMs: 0 };
  const paused = new Set<string>();
  const googleCap = Number(process.env.GOOGLE_ADS_DAILY_OPS) || 2000;
  let googleOps: number | null = null;

  while (Date.now() - started < opts.budgetMs - 45_000) {
    // as funções public.mmm_* (o schema mmm não é exposto na API)
    const claimed = await db.rpc("mmm_claim_backfill", { p_limit: BACKFILL_CONCURRENCY });
    if (claimed.error) {
      // sem a migration aplicada (ou fora do ar): a sincronização segue normal
      summary.skipped = claimed.error.code === "PGRST202" || claimed.error.code === "42883" ? "sem a base do MMM" : claimed.error.message.slice(0, 120);
      break;
    }
    const jobs: Job[] = (claimed.data ?? []).map((j) => ({ ...j, platform_id: j.platform_id === "google" ? "google" : "meta", report_run_id: j.report_run_id ?? null }));
    if (!jobs.length) break;
    const ids = jobs.map((j) => j.ad_account_id);
    const accounts = new Map(((await db.from("ad_accounts").select("id, external_id, connection_id, currency, metadata").in("id", ids)).data ?? []).map((a) => [a.id, a as Account]));
    if (googleOps === null && jobs.some((j) => j.platform_id === "google")) googleOps = (await db.rpc("mmm_google_ops_today")).data ?? 0;

    await runPool(jobs, BACKFILL_CONCURRENCY, async (job) => {
      summary.ran++;
      const account = accounts.get(job.ad_account_id);
      const back = async (status: "aguardando" | "pendente" | "erro", erro: string | null, reportRunId: string | null, refund: boolean) => {
        // sem erro ou sem relatório: o padrão da função (null) limpa o campo
        await db.rpc("mmm_update_backfill", { p_id: job.id, p_status: status, p_erro: erro ?? undefined, p_report_run_id: reportRunId ?? undefined, p_refund: refund });
      };
      // plataforma em pausa (limite) ou teto do Google: volta para a fila sem gastar tentativa
      if (paused.has(job.platform_id) || (job.platform_id === "google" && (googleOps ?? 0) >= googleCap)) {
        summary.paused++;
        return back("pendente", null, job.report_run_id, true);
      }
      if (!account?.connection_id) {
        summary.failed++;
        return back("erro", "Conta sem conexão ativa.", null, false);
      }
      try {
        if (job.platform_id === "google") googleOps = (googleOps ?? 0) + 1;
        const r = job.platform_id === "meta" ? await runMeta(job, account, paused) : await runGoogle(job, account);
        if (r.outcome === "aguardando") {
          summary.waiting++;
          return back("aguardando", null, r.reportRunId ?? null, true);
        }
        if (r.outcome === "erro") {
          summary.failed++;
          return back("erro", r.error ?? "Falhou.", null, false);
        }
        const { from, to } = monthRange(job.mes);
        const raw = [{ date_from: from, date_to: to, request_hash: requestHash([job.platform_id, account.external_id, from, to, "campaign"]), payload: r.raw }];
        const saved = await db.rpc("mmm_save_backfill", { p_id: job.id, p_raw: raw as Json, p_rows: (r.rows ?? []) as Json });
        if (saved.error) throw new Error(saved.error.message);
        summary.concluded++;
      } catch (err) {
        if (isRateLimited(err)) {
          paused.add(job.platform_id);
          summary.paused++;
          return back("pendente", null, job.report_run_id, true);
        }
        summary.failed++;
        console.error("[vyz] MMM: carga falhou", job.platform_id, job.mes, err instanceof Error ? err.message.slice(0, 200) : err);
        return back("erro", err instanceof Error ? err.message.slice(0, 300) : "Falhou.", null, false);
      }
    });
    // tudo em pausa: não adianta pegar mais nesta rodada
    if (paused.has("meta") && (paused.has("google") || (googleOps ?? 0) >= googleCap)) break;
  }
  summary.durationMs = Date.now() - started;
  return summary;
}
