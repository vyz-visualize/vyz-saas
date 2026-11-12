import "server-only";

// Sincronização agendada: contas ativas, com a conexão ativa e a assinatura
// em dia, que não sincronizam (nem tentaram) há algumas horas. Da mais
// atrasada para a mais recente, uma de cada vez (sem pesar no banco) e dentro
// de um tempo máximo: o que não couber fica para a próxima rodada.
//
// Os filtros ficam na consulta, antes do limite: conta de workspace sem
// assinatura ou que falha toda vez (token vencido, API fora do ar) não ocupa
// o lugar das outras na fila. Quem falhou espera o mesmo intervalo para
// tentar de novo.

import { SYNC_PLATFORMS } from "@/features/sync/dataset";
import { ORGANIC_PLATFORMS } from "@/features/sync/organic";
import { ANALYTICS_PLATFORMS } from "@/features/sync/analytics";
import { CRM_PLATFORMS } from "@/features/sync/crm";
import type { Enums } from "@/lib/supabase/database.types";
import { createAdminSupabase } from "@/server/supabase/admin";
import { syncAdAccount, type SyncErrorCode } from "./run";

const HOUR = 60 * 60 * 1000;

/** Assinaturas que dão acesso (as de workspace_access.has_access). */
const ACCESS_STATUSES: Enums<"subscription_status">[] = ["active", "trialing", "past_due"];

export type ScheduledOptions = {
  /** Tempo máximo da rodada; não começa outra conta depois dele (padrão: 4 min). */
  budgetMs?: number;
  /** Só sincroniza a conta que não sincroniza (nem tentou) há este tempo (padrão: 6 h). */
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
  /** Ficaram para a próxima rodada (tempo esgotado). */
  pending: number;
  durationMs: number;
  results: { adAccountId: string; ok: boolean; rowsWritten: number; code?: SyncErrorCode }[];
};

export async function syncDueAccounts(opts: ScheduledOptions = {}): Promise<ScheduledSummary> {
  const startedAt = Date.now();
  const budget = opts.budgetMs ?? 4 * 60 * 1000;
  const cutoff = new Date(startedAt - (opts.minIntervalMs ?? 6 * HOUR)).toISOString();
  const db = createAdminSupabase();

  const { data: accounts, error } = await db
    .from("ad_accounts")
    .select(
      `id, workspace_id,
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

  const results: ScheduledSummary["results"] = [];
  for (const account of due) {
    if (Date.now() - startedAt > budget) break;
    const r = await syncAdAccount(account.id, "scheduled");
    results.push({ adAccountId: account.id, ok: r.ok, rowsWritten: r.rowsWritten, ...(r.code ? { code: r.code } : {}) });
  }

  const skipped = results.filter((r) => r.code === "sync:running").length;
  const failed = results.filter((r) => !r.ok).length - skipped;
  return {
    ok: failed === 0,
    due: due.length,
    synced: results.length - failed - skipped,
    failed,
    skipped,
    pending: due.length - results.length,
    durationMs: Date.now() - startedAt,
    results,
  };
}
