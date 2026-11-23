import "server-only";

// Sincronização agendada: contas ativas, com a conexão ativa e a assinatura
// em dia, que não sincronizam (nem tentaram) há algumas horas. Da mais
// atrasada para a mais recente, 3 contas ao mesmo tempo e dentro de um tempo
// máximo: o que não couber fica para a próxima rodada.
//
// Limite de taxa (Meta ou Google pedem uma pausa): a conta não é tentada de
// novo nesta rodada, e a plataforma dela também para de receber contas novas
// até o fim da rodada (o limite costuma valer para o app inteiro). Elas
// entram na próxima.
//
// Os filtros ficam na consulta, antes do limite: conta de workspace sem
// assinatura ou que falha toda vez (token vencido, API fora do ar) não ocupa
// o lugar das outras na fila. Quem falhou espera o mesmo intervalo para
// tentar de novo.
//
// Tempo (features/sync/round.ts): cada grupo (anúncios e orgânico) tem o cron dele. A rodada
// só começa uma conta se couber o tempo que ela costuma levar; uma conta que passa do limite
// duro é encerrada aqui ("Tempo esgotado", volta na próxima rodada), antes de a Vercel cortar a
// função. No começo, fecha as sincronizações que ficaram abertas por uma rodada que morreu, e no
// fim avisa as contas sem sincronizar com sucesso há mais de 24 h.

import { pauseAfterRateLimit, sharedPauses } from "@/server/cache/redis";
import { SYNC_PLATFORMS } from "@/features/sync/dataset";
import { ORGANIC_PLATFORMS } from "@/features/sync/organic";
import { ANALYTICS_PLATFORMS } from "@/features/sync/analytics";
import { CRM_PLATFORMS } from "@/features/sync/crm";
import { runPool, summarizeRuns } from "@/features/sync/throttle";
import type { Enums } from "@/lib/supabase/database.types";
import { createAdminSupabase } from "@/server/supabase/admin";
import { fitsInRound, STALE_ACCOUNT_MS, STALE_RUN_MS, SYNC_GROUPS, type SyncGroup } from "@/features/sync/round";
import { syncAdAccount, type SyncErrorCode } from "./run";

const HOUR = 60 * 60 * 1000;

/** Contas sincronizando ao mesmo tempo (cada uma usa até 3 requisições ao banco por vez). */
export const SCHEDULED_CONCURRENCY = 3;

/** Assinaturas que dão acesso (as de workspace_access.has_access). */
const ACCESS_STATUSES: Enums<"subscription_status">[] = ["active", "trialing", "past_due"];

export type ScheduledOptions = {
  /** Tempo máximo da rodada; não começa outra conta depois dele (padrão: 4 min). */
  budgetMs?: number;
  /**
   * Só sincroniza a conta que não sincroniza (nem tentou) há este tempo (padrão: 3 h). Os
   * crons rodam às 09, 15 e 21 UTC, mas no Hobby cada um dispara em algum momento da hora
   * (até 59 min depois): duas rodadas podem ficar a menos de 4 h uma da outra.
   */
  minIntervalMs?: number;
  /** Máximo de contas por rodada (padrão: 200). */
  limit?: number;
  /** Só as plataformas do grupo (cron próprio). Sem isso, todas. */
  group?: SyncGroup;
  /** Limite duro da conta que já começou (padrão: budgetMs + 40 s): depois dele a conta é encerrada aqui. */
  hardStopMs?: number;
};

export type ScheduledSummary = {
  ok: boolean;
  /** Contas que estavam na fila. */
  due: number;
  synced: number;
  failed: number;
  /** Já estavam sincronizando (outra rodada ou um pedido manual). */
  skipped: number;
  /** Limite de taxa da plataforma: tentam de novo na próxima rodada. */
  rateLimited: number;
  /** Ficaram para a próxima rodada (tempo esgotado ou plataforma em pausa). */
  pending: number;
  durationMs: number;
  results: { adAccountId: string; ok: boolean; rowsWritten: number; code?: SyncErrorCode }[];
  /** Sincronizações abertas de rodadas que morreram, fechadas agora. */
  closedStale?: number;
  /** Contas sem sincronizar com sucesso há mais de 24 h (o aviso também vai para o log). */
  staleAccounts?: { adAccountId: string; platform: string; name: string; hours: number | null }[];
};

export async function syncDueAccounts(opts: ScheduledOptions = {}): Promise<ScheduledSummary> {
  const startedAt = Date.now();
  const budget = opts.budgetMs ?? 4 * 60 * 1000;
  const cutoff = new Date(startedAt - (opts.minIntervalMs ?? 3 * HOUR)).toISOString();
  const db = createAdminSupabase();
  const hardStop = opts.hardStopMs ?? budget + 40_000;
  const platforms = opts.group ? SYNC_GROUPS[opts.group] : [...SYNC_PLATFORMS, ...ORGANIC_PLATFORMS, ...ANALYTICS_PLATFORMS, ...CRM_PLATFORMS];

  // sincronizações abertas há mais de 15 min, de qualquer conta: a rodada delas morreu
  const stale = await db
    .from("sync_runs")
    .update({ status: "failed", error: "Tempo esgotado", finished_at: new Date().toISOString() })
    .in("status", ["queued", "running"])
    .lt("created_at", new Date(startedAt - STALE_RUN_MS).toISOString())
    .select("id");
  if (stale.error) console.error("[vyz] sincronização: fechar execuções presas", stale.error.code, stale.error.message);

  const { data: accounts, error } = await db
    .from("ad_accounts")
    .select(
      `id, workspace_id, platform_id, external_id,
      connection:connections!ad_accounts_workspace_id_connection_id_fkey!inner(status),
      workspace:workspaces!ad_accounts_workspace_id_fkey!inner(subscriptions!subscriptions_workspace_id_fkey!inner(status)),
      recent:sync_runs!sync_runs_workspace_id_ad_account_id_fkey(id)`,
    )
    .eq("is_enabled", true)
    .in("platform_id", [...platforms])
    .eq("connection.status", "active")
    .in("workspace.subscriptions.status", ACCESS_STATUSES)
    // nenhuma tentativa (certa ou com erro) depois do corte
    .gte("recent.created_at", cutoff)
    .is("recent", null)
    .or(`last_synced_at.is.null,last_synced_at.lt."${cutoff}"`)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(opts.limit ?? 200);
  if (error) throw error;

  // a palavra final do acesso é da view (vale a assinatura mais recente do workspace)
  const workspaceIds = [...new Set((accounts ?? []).map((a) => a.workspace_id))];
  const access = workspaceIds.length ? await db.from("workspace_access").select("workspace_id, has_access").in("workspace_id", workspaceIds) : { data: [], error: null };
  if (access.error) throw access.error;
  const active = new Set((access.data ?? []).filter((w) => w.has_access).map((w) => w.workspace_id));
  const due = (accounts ?? []).filter((a) => active.has(a.workspace_id));

  // plataformas que pediram pausa nesta rodada: as contas delas ficam para a próxima.
  // Com Redis, também as pausas de outras funções (limite da Meta ou do Google, cota do dia)
  const paused = new Set<string>();
  const sharedPaused = await sharedPauses(due);
  const ran = await runPool(
    due,
    SCHEDULED_CONCURRENCY,
    async (account) => {
      // passou do limite duro: encerra aqui (a Vercel cortaria a função e a sincronização ficaria aberta)
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), Math.max(1_000, hardStop - (Date.now() - startedAt)));
      });
      const r = await Promise.race([syncAdAccount(account.id, "scheduled"), timeout]);
      clearTimeout(timer);
      if (r === "timeout") {
        const closed = await db
          .from("sync_runs")
          .update({ status: "failed", error: "Tempo esgotado: continua na próxima rodada", finished_at: new Date().toISOString() })
          .eq("ad_account_id", account.id)
          .in("status", ["queued", "running"]);
        if (closed.error) console.error("[vyz] sincronização: encerrar conta no limite", closed.error.code, closed.error.message);
        console.warn("[vyz] sincronização: conta passou do limite da rodada", account.platform_id, account.id);
        return { ok: false, rowsWritten: 0, code: "sync:failed" as const };
      }
      if (r.code === "sync:rate_limited") {
        paused.add(account.platform_id);
        await pauseAfterRateLimit(account.platform_id);
      }
      return r;
    },
    // só começa a conta se o tempo que ela costuma levar couber no que falta da rodada
    (account) => fitsInRound(account.platform_id, Date.now() - startedAt, budget) && !paused.has(account.platform_id) && !sharedPaused(account),
  );
  const results: ScheduledSummary["results"] = ran.map(({ item, result: r }) => ({ adAccountId: item.id, ok: r.ok, rowsWritten: r.rowsWritten, ...(r.code ? { code: r.code } : {}) }));

  // contas sem sincronizar com sucesso há mais de 24 h (do grupo): o aviso da rodada
  const staleCut = new Date(startedAt - STALE_ACCOUNT_MS).toISOString();
  const late = await db
    .from("ad_accounts")
    .select("id, workspace_id, platform_id, name, last_synced_at, connection:connections!ad_accounts_workspace_id_connection_id_fkey!inner(status)")
    .eq("is_enabled", true)
    .in("platform_id", [...platforms])
    .eq("connection.status", "active")
    .or(`last_synced_at.is.null,last_synced_at.lt."${staleCut}"`)
    .limit(50);
  // só de workspace com acesso (assinatura em dia): sem acesso, a conta não sincroniza mesmo
  const lateWs = [...new Set((late.data ?? []).map((a) => a.workspace_id))];
  const lateAccess = lateWs.length ? await db.from("workspace_access").select("workspace_id, has_access").in("workspace_id", lateWs) : { data: [] };
  const withAccess = new Set((lateAccess.data ?? []).filter((w) => w.has_access).map((w) => w.workspace_id));
  const staleAccounts = (late.data ?? [])
    .filter((a) => withAccess.has(a.workspace_id))
    .map((a) => ({ adAccountId: a.id, platform: a.platform_id, name: a.name, hours: a.last_synced_at ? Math.round((startedAt - Date.parse(a.last_synced_at)) / 3_600_000) : null }));
  if (staleAccounts.length) console.warn("[vyz] sincronização: contas há mais de 24 h sem sincronizar", staleAccounts.map((a) => `${a.platform}:${a.name} (${a.hours ?? "nunca"} h)`).join(", "));

  return { ...summarizeRuns(due.length, results, Date.now() - startedAt), closedStale: stale.data?.length ?? 0, staleAccounts };
}
