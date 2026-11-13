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

import { SYNC_PLATFORMS } from "@/features/sync/dataset";
import { ORGANIC_PLATFORMS } from "@/features/sync/organic";
import { ANALYTICS_PLATFORMS } from "@/features/sync/analytics";
import { CRM_PLATFORMS } from "@/features/sync/crm";
import { runPool, summarizeRuns } from "@/features/sync/throttle";
import type { Enums } from "@/lib/supabase/database.types";
import { createAdminSupabase } from "@/server/supabase/admin";
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
};

export async function syncDueAccounts(opts: ScheduledOptions = {}): Promise<ScheduledSummary> {
  const startedAt = Date.now();
  const budget = opts.budgetMs ?? 4 * 60 * 1000;
  const cutoff = new Date(startedAt - (opts.minIntervalMs ?? 3 * HOUR)).toISOString();
  const db = createAdminSupabase();

  const { data: accounts, error } = await db
    .from("ad_accounts")
    .select(
      `id, workspace_id, platform_id,
      connection:connections!ad_accounts_workspace_id_connection_id_fkey!inner(status),
      workspace:workspaces!ad_accounts_workspace_id_fkey!inner(subscriptions!subscriptions_workspace_id_fkey!inner(status)),
      recent:sync_runs!sync_runs_workspace_id_ad_account_id_fkey(id)`,
    )
    .eq("is_enabled", true)
    .in("platform_id", [...SYNC_PLATFORMS, ...ORGANIC_PLATFORMS, ...ANALYTICS_PLATFORMS, ...CRM_PLATFORMS])
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

  // plataformas que pediram pausa nesta rodada: as contas delas ficam para a próxima
  const paused = new Set<string>();
  const ran = await runPool(
    due,
    SCHEDULED_CONCURRENCY,
    async (account) => {
      const r = await syncAdAccount(account.id, "scheduled");
      if (r.code === "sync:rate_limited") paused.add(account.platform_id);
      return r;
    },
    (account) => Date.now() - startedAt <= budget && !paused.has(account.platform_id),
  );
  const results: ScheduledSummary["results"] = ran.map(({ item, result: r }) => ({ adAccountId: item.id, ok: r.ok, rowsWritten: r.rowsWritten, ...(r.code ? { code: r.code } : {}) }));
  return summarizeRuns(due.length, results, Date.now() - startedAt);
}
