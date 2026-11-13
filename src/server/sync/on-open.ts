import "server-only";

// Atualização ao abrir: quem abre um dashboard com dados de mais de 6 h dispara a
// sincronização das contas dele, em segundo plano (a tela já mostra os números que tem).
// No máximo uma por conta por vez (o índice de sync_runs barra a segunda) e nunca a mesma
// conta de novo antes de 15 min (deu erro, bateu no limite da plataforma ou acabou de rodar).
// As mesmas 3 contas por vez do agendador.

import { ANALYTICS_PLATFORMS } from "@/features/sync/analytics";
import { CRM_PLATFORMS } from "@/features/sync/crm";
import { SYNC_PLATFORMS } from "@/features/sync/dataset";
import { needsRefresh, oldestSync, REFRESH_COOLDOWN_MS } from "@/features/sync/freshness";
import { ORGANIC_PLATFORMS } from "@/features/sync/organic";
import { runPool, summarizeRuns } from "@/features/sync/throttle";
import type { WorkspaceSession } from "@/features/workspace/session";
import { createAdminSupabase } from "@/server/supabase/admin";
import { createServerSupabase } from "@/server/supabase/server";
import { syncAdAccount } from "./run";
import { SCHEDULED_CONCURRENCY } from "./scheduled";

const API_PLATFORMS: readonly string[] = [...SYNC_PLATFORMS, ...ORGANIC_PLATFORMS, ...ANALYTICS_PLATFORMS, ...CRM_PLATFORMS];

export type RefreshOnOpen = ReturnType<typeof summarizeRuns> & {
  /** A sincronização mais antiga das contas do dashboard depois da rodada (o que o selo mostra). */
  lastSyncedAt: string | null;
};

export async function refreshDashboardOnOpen(dashboardId: string, session: WorkspaceSession): Promise<RefreshOnOpen> {
  const startedAt = Date.now();
  // com a sessão da pessoa: só vê as contas de um dashboard do workspace dela
  const db = await createServerSupabase();
  const accounts = async () => {
    const { data, error } = await db
      .from("dashboard_sources")
      .select("account:ad_accounts!dashboard_sources_workspace_id_ad_account_id_fkey(id, platform_id, is_enabled, connection_id, last_synced_at)")
      .eq("dashboard_id", dashboardId)
      .eq("workspace_id", session.workspace.id);
    if (error) throw error;
    return (data ?? []).map((s) => s.account).filter((a): a is NonNullable<typeof a> => !!a && a.is_enabled && API_PLATFORMS.includes(a.platform_id));
  };
  // a data do selo: a mesma regra da página (a sincronização mais antiga das contas pela API)
  const oldest = async () => oldestSync((await accounts()).map((a) => a.last_synced_at));
  const stale = (await accounts()).filter((a) => !!a.connection_id && needsRefresh(a.last_synced_at, startedAt));
  if (!stale.length) return { ...summarizeRuns(0, [], Date.now() - startedAt), lastSyncedAt: await oldest() };

  // tentou há pouco (qualquer gatilho, certa ou com erro): espera
  const admin = createAdminSupabase();
  const recent = await admin
    .from("sync_runs")
    .select("ad_account_id")
    .in(
      "ad_account_id",
      stale.map((a) => a.id),
    )
    .gte("created_at", new Date(startedAt - REFRESH_COOLDOWN_MS).toISOString());
  if (recent.error) throw recent.error;
  const tried = new Set((recent.data ?? []).map((r) => r.ad_account_id));
  const due = stale.filter((a) => !tried.has(a.id));

  const paused = new Set<string>();
  const ran = await runPool(
    due,
    SCHEDULED_CONCURRENCY,
    async (a) => {
      // "manual": os números novos aparecem na hora (o agendado serve o cache enquanto recalcula)
      const r = await syncAdAccount(a.id, "manual", { actorId: session.user.id });
      if (r.code === "sync:rate_limited") paused.add(a.platform_id);
      return r;
    },
    (a) => !paused.has(a.platform_id),
  );
  const summary = summarizeRuns(
    due.length,
    ran.map(({ item, result: r }) => ({ adAccountId: item.id, ok: r.ok, rowsWritten: r.rowsWritten, ...(r.code ? { code: r.code } : {}) })),
    Date.now() - startedAt,
  );
  return { ...summary, lastSyncedAt: await oldest() };
}
