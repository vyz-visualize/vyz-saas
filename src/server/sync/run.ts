import "server-only";

// Motor de sincronização de uma conta de anúncio: busca os dados na fonte
// (simulada ou API), grava no armazém, recalcula no banco o total por dia
// (rollup_account_insights), marca a conta e a conexão como sincronizadas e
// invalida o cache dos dashboards da conta. Uma por conta por vez: o índice
// único de sync_runs barra a segunda.
//
// Usa a chave de serviço. Quem chama já autorizou: Server Action com
// authorize() (área integrations), a rota do cron (CRON_SECRET) ou um script
// de desenvolvimento. Nunca lança: devolve { ok: false, error } em português.
// Os horários do histórico (sync_runs, last_synced_at) seguem o relógio do
// banco, o mesmo de created_at: o fim nunca fica antes do início.

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { PLATFORMS } from "@/features/accounts/platforms";
import { isSyncPlatform } from "@/features/sync/dataset";
import { isOrganicSyncPlatform } from "@/features/sync/organic";
import { isAnalyticsSyncPlatform } from "@/features/sync/analytics";
import { isCrmSyncPlatform } from "@/features/sync/crm";
import { syncRange, type SyncRange, type SyncTrigger } from "@/features/sync/dates";
import { insightsTag } from "@/features/sync/tags";
import { logActivity } from "@/server/history/log";
import { requestContext } from "@/server/http/request";
import { createAdminSupabase } from "@/server/supabase/admin";
import { AppError, appError } from "@/server/supabase/errors";
import type { DB } from "@/server/supabase/server";
import { sourceFor, type SyncAccount } from "./source";
import { rollupAccount, writeAnalytics, writeCrm, writeDataset, writeOrganic } from "./write";

export type { SyncTrigger } from "@/features/sync/dates";

export type SyncErrorCode =
  | "sync:not_found"
  | "sync:unsupported_platform"
  | "sync:account_disabled"
  | "sync:connection_inactive"
  | "sync:running"
  | "sync:not_configured"
  | "sync:failed";

export type SyncResult = {
  ok: boolean;
  /** Linhas gravadas: entidades, fatos e totais por dia. */
  rowsWritten: number;
  /** Mensagem para a pessoa (quando ok = false). */
  error?: string;
  code?: SyncErrorCode;
  runId?: string;
  range?: { from: string; to: string };
  durationMs?: number;
};

export type SyncOptions = {
  /** Quem pediu (vai para a auditoria e o histórico). Vazio = o agendador. */
  actorId?: string | null;
};

const MESSAGES: Record<SyncErrorCode, string> = {
  "sync:not_found": "Conta de anúncio não encontrada.",
  "sync:unsupported_platform": "Esta plataforma ainda não importa dados automaticamente.",
  "sync:account_disabled": "Ative a conta para importar os dados.",
  "sync:connection_inactive": "A conexão desta conta precisa ser refeita. Conecte de novo para importar os dados.",
  "sync:running": "Esta conta já está sincronizando. Aguarde alguns instantes.",
  "sync:not_configured": "A importação de dados reais ainda não está configurada.",
  "sync:failed": "Não foi possível importar os dados agora. Tente de novo em alguns minutos.",
};

/** Sincronização "running" mais velha que isto morreu no meio (processo encerrado): a conta é liberada. */
const STALE_RUN_MS = 15 * 60 * 1000;

const syncError = (code: SyncErrorCode, message?: string) => appError(code, message ?? MESSAGES[code]);

const Uuid = z.uuid();

async function loadAccount(db: DB, adAccountId: string): Promise<SyncAccount> {
  const { data, error } = await db
    .from("ad_accounts")
    .select(
      "id, workspace_id, connection_id, platform_id, external_id, name, currency, timezone, is_enabled, created_at, connection:connections!ad_accounts_workspace_id_connection_id_fkey(status, is_mock)",
    )
    .eq("id", adAccountId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw syncError("sync:not_found");
  if (!isSyncPlatform(data.platform_id) && !isOrganicSyncPlatform(data.platform_id) && !isAnalyticsSyncPlatform(data.platform_id) && !isCrmSyncPlatform(data.platform_id)) throw syncError("sync:unsupported_platform");
  if (!data.is_enabled) throw syncError("sync:account_disabled");
  const connection = data.connection;
  if (!data.connection_id || !connection || connection.status !== "active") {
    throw syncError("sync:connection_inactive", `A conexão com o ${PLATFORMS[data.platform_id].name} precisa ser refeita. Conecte de novo para importar os dados.`);
  }
  return {
    id: data.id,
    workspaceId: data.workspace_id,
    connectionId: data.connection_id,
    platform: data.platform_id,
    externalId: data.external_id,
    name: data.name,
    currency: data.currency,
    timezone: data.timezone,
    createdAt: data.created_at,
    isMock: connection.is_mock,
  };
}

type Run = {
  id: string;
  /** Início no relógio do banco: vai em synced_at de cada linha gravada. */
  createdAt: string;
  /** Relógio do banco menos o deste servidor. */
  clockOffsetMs: number;
};

const dbNow = (run: Run) => new Date(Date.now() + run.clockOffsetMs).toISOString();

async function startRun(db: DB, account: SyncAccount, trigger: SyncTrigger, range: SyncRange): Promise<Run> {
  const now = new Date();
  const stale = await db
    .from("sync_runs")
    .update({ status: "failed", error: "Tempo esgotado", finished_at: now.toISOString() })
    .eq("ad_account_id", account.id)
    .in("status", ["queued", "running"])
    .lt("created_at", new Date(now.getTime() - STALE_RUN_MS).toISOString());
  if (stale.error) console.error("[vyz] sincronização: liberar execução presa", stale.error.code, stale.error.message);

  const { data, error } = await db
    .from("sync_runs")
    .insert({
      workspace_id: account.workspaceId,
      connection_id: account.connectionId,
      ad_account_id: account.id,
      trigger,
      status: "running",
      range_start: range.from,
      range_end: range.to,
      started_at: now.toISOString(),
    })
    .select("id, created_at")
    .single();
  // o índice parcial sync_runs_one_active_per_account: já há uma em andamento
  if (error?.code === "23505") throw syncError("sync:running");
  if (error) throw error;
  return { id: data.id, createdAt: data.created_at, clockOffsetMs: Date.parse(data.created_at) - Date.now() };
}

/** Fecha a execução com início e fim no relógio do banco. `error` é o texto que a tela mostra. */
async function finishRun(db: DB, run: Run, patch: { status: "succeeded" | "failed"; rowsWritten: number; error?: string; finishedAt?: string }) {
  const { error } = await db
    .from("sync_runs")
    .update({
      status: patch.status,
      rows_written: patch.rowsWritten,
      error: patch.error ?? null,
      started_at: run.createdAt,
      finished_at: patch.finishedAt ?? dbNow(run),
    })
    .eq("id", run.id);
  if (error) console.error("[vyz] sincronização: fechar execução", run.id, error.code, error.message);
}

/** Erro conhecido vira a mensagem dele; o resto vira a genérica (o detalhe fica só no log do servidor). */
function toFailure(err: unknown): { code: SyncErrorCode; message: string; detail: string | null; technical: string | null } {
  if (err instanceof AppError && err.code.startsWith("sync:")) return { code: err.code as SyncErrorCode, message: err.message, detail: null, technical: null };
  const e = (err ?? {}) as { code?: unknown; message?: unknown };
  const detail = typeof e.code === "string" && e.code ? e.code : null;
  // o motivo técnico (já sem token: ProviderError só leva status e diagnóstico) fica no histórico,
  // porque o log do servidor some em poucas horas
  const technical = typeof e.message === "string" ? e.message.slice(0, 300) : null;
  console.error("[vyz] sincronização falhou", detail ?? "", technical ?? err);
  return { code: "sync:failed", message: MESSAGES["sync:failed"], detail, technical };
}

/**
 * Invalida o cache dos dashboards da conta. Sincronização pedida por alguém
 * (inicial ou manual) expira na hora: o próximo dashboard aberto já mostra os
 * números novos. A agendada serve o cache enquanto recalcula ("max").
 * Fora de uma requisição (scripts) não há cache do Next neste processo: ele
 * expira sozinho pelo cacheLife.
 */
function invalidateInsights(adAccountId: string, trigger: SyncTrigger, inRequest: boolean) {
  try {
    revalidateTag(insightsTag(adAccountId), trigger === "scheduled" ? "max" : { expire: 0 });
  } catch (err) {
    if (inRequest) console.warn("[vyz] sincronização: cache dos dashboards não invalidado", adAccountId, err instanceof Error ? err.message : err);
  }
}

/**
 * Sincroniza uma conta. initial = 90 dias até ontem; scheduled e manual = os
 * últimos 7 dias (cobrem as conversões que chegam atrasadas). Ontem no fuso
 * da conta.
 */
export async function syncAdAccount(adAccountId: string, trigger: SyncTrigger, opts: SyncOptions = {}): Promise<SyncResult> {
  const startedAt = Date.now();
  if (!Uuid.safeParse(adAccountId).success) return { ok: false, rowsWritten: 0, code: "sync:not_found", error: MESSAGES["sync:not_found"] };

  const ctx = await requestContext();
  const db = createAdminSupabase({ actorId: opts.actorId, forwardHeaders: ctx.forwardHeaders });
  let account: SyncAccount | null = null;
  let run: Run | null = null;
  let range: SyncRange | null = null;

  try {
    account = await loadAccount(db, adAccountId);
    // CRM: os negócios mudam de etapa e fecham depois de criados, então relê sempre os 90 dias
    range = syncRange(isCrmSyncPlatform(account.platform) ? "initial" : trigger, { timeZone: account.timezone });
    run = await startRun(db, account, trigger, range);

    const source = sourceFor(account);
    let rowsWritten: number;
    let byTable: Record<string, number>;
    const current = account;
    if (isCrmSyncPlatform(current.platform)) {
      // CRM: tabela própria, por dia e etapa
      const crm = await source.fetchCrm({ ...current, platform: current.platform }, range);
      rowsWritten = await writeCrm(db, current, crm, run.createdAt);
      byTable = { crm_daily: rowsWritten };
    } else if (isAnalyticsSyncPlatform(current.platform)) {
      // site (GA4): tabela própria, por dia e canal
      const analytics = await source.fetchAnalytics({ ...current, platform: current.platform }, range);
      rowsWritten = await writeAnalytics(db, current, analytics, run.createdAt);
      byTable = { analytics_daily: rowsWritten };
    } else if (isOrganicSyncPlatform(current.platform)) {
      // orgânico: tabelas próprias, sem rollup (o total por dia já vem da plataforma)
      const organic = await source.fetchOrganic({ ...current, platform: current.platform }, range);
      const written = await writeOrganic(db, current, organic, run.createdAt);
      rowsWritten = written.days + written.posts;
      byTable = { organic_daily: written.days, organic_posts: written.posts };
    } else {
      const ads = { ...current, platform: current.platform as Exclude<typeof current.platform, "instagram" | "facebook" | "ga4" | "rdstation" | "hubspot" | "pipedrive" | "kommo"> };
      const dataset = await source.fetch(ads, range);
      const written = await writeDataset(db, current, dataset, run.createdAt);
      const days = await rollupAccount(db, current, dataset, range, run.createdAt);
      rowsWritten = written.entities + written.facts + days;
      byTable = { ...written.byTable, insights_account_daily: days };
    }

    const finishedAt = dbNow(run);
    const [accountUpdate, connectionUpdate] = await Promise.all([
      db.from("ad_accounts").update({ last_synced_at: finishedAt }).eq("id", account.id),
      db.from("connections").update({ last_synced_at: finishedAt }).eq("id", account.connectionId),
    ]);
    for (const { error } of [accountUpdate, connectionUpdate]) if (error) console.error("[vyz] sincronização: marcar última sincronização", error.code, error.message);
    await finishRun(db, run, { status: "succeeded", rowsWritten, finishedAt });
    invalidateInsights(account.id, trigger, ctx.userAgent !== null || ctx.ip !== null);

    const durationMs = Date.now() - startedAt;
    await logActivity({
      workspaceId: account.workspaceId,
      actorId: opts.actorId ?? null,
      event: "sync.finished",
      entityType: "ad_account",
      entityId: account.id,
      metadata: {
        trigger,
        run_id: run.id,
        connection_id: account.connectionId,
        source: source.kind,
        range_start: range.from,
        range_end: range.to,
        rows_written: rowsWritten,
        rows_by_table: byTable,
        duration_ms: durationMs,
      },
    });
    return { ok: true, rowsWritten, runId: run.id, range: { from: range.from, to: range.to }, durationMs };
  } catch (err) {
    const failure = toFailure(err);
    // a tela mostra sync_runs.error: só a mensagem; o código técnico fica no log e na atividade
    if (run) await finishRun(db, run, { status: "failed", rowsWritten: 0, error: failure.message });
    if (account && failure.code !== "sync:running") {
      await logActivity({
        workspaceId: account.workspaceId,
        actorId: opts.actorId ?? null,
        event: "sync.failed",
        entityType: "ad_account",
        entityId: account.id,
        metadata: {
          trigger,
          run_id: run?.id ?? null,
          connection_id: account.connectionId,
          code: failure.code,
          error: failure.message,
          error_code: failure.detail,
          error_detail: failure.technical,
          range_start: range?.from ?? null,
          range_end: range?.to ?? null,
        },
      });
    }
    return {
      ok: false,
      rowsWritten: 0,
      error: failure.message,
      code: failure.code,
      ...(run ? { runId: run.id } : {}),
      ...(range ? { range: { from: range.from, to: range.to } } : {}),
      durationMs: Date.now() - startedAt,
    };
  }
}

/** Várias contas, uma de cada vez (a sincronização usa no máximo 3 requisições ao banco por vez). */
export async function syncAdAccounts(adAccountIds: readonly string[], trigger: SyncTrigger, opts: SyncOptions = {}): Promise<(SyncResult & { adAccountId: string })[]> {
  const out: (SyncResult & { adAccountId: string })[] = [];
  for (const adAccountId of new Set(adAccountIds)) out.push({ adAccountId, ...(await syncAdAccount(adAccountId, trigger, opts)) });
  return out;
}
