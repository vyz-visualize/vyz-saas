import "server-only";

// Leituras de dashboards do workspace aberto, com o RLS de quem está logado
// (membros leem). DTOs no formato da UI (src/features/dashboards/model.ts).

import { cache } from "react";
import { z } from "zod";
import type { PlatformId } from "@/features/accounts/platforms";
import { toDashboard, type DashboardDetail, type DashboardListItem, type DashboardRow, type PageRow, type SourceOption, type SourceRow } from "@/features/dashboards/model";
import { getWorkspaceSession } from "@/server/auth/workspace";
import { appError, unwrap } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

const DASHBOARD_COLUMNS =
  "id, template_id, name, client_name, goal_cents, margin, monthly_budget_cents, period, custom_days, attribution, brand_color, hide_vyz_brand, metric_prefs, layout, created_at, updated_at";

// Páginas e contas embutidas: uma ida ao banco por lista.
export const DASHBOARD_SELECT = `${DASHBOARD_COLUMNS},
  pages:dashboard_pages!dashboard_pages_workspace_id_dashboard_id_fkey(page_type_id, position),
  sources:dashboard_sources!dashboard_sources_workspace_id_dashboard_id_fkey(account:ad_accounts!dashboard_sources_workspace_id_ad_account_id_fkey(id, name, platform_id, is_enabled))`;

export type JoinedDashboard = DashboardRow & { pages: PageRow[]; sources: { account: SourceRow | null }[] };

/** Linha com páginas e contas embutidas → DTO. */
export const fromJoined = (r: JoinedDashboard): DashboardDetail =>
  toDashboard(
    r,
    r.pages,
    r.sources.map((s) => s.account).filter((a): a is SourceRow => !!a),
  );

async function currentWorkspace() {
  const session = await getWorkspaceSession();
  if (!session) throw appError("auth:required");
  return session;
}

/** Dashboards do workspace, mais recentes primeiro. */
export const listDashboards = cache(async (): Promise<DashboardListItem[]> => {
  const session = await currentWorkspace();
  const supabase = await createServerSupabase();
  const rows = unwrap(await supabase.from("dashboards").select(DASHBOARD_SELECT).eq("workspace_id", session.workspace.id).order("created_at", { ascending: false }).limit(200)) ?? [];
  return (rows as unknown as JoinedDashboard[]).map(fromJoined).map(({ id, templateId, name, client, pages, settings, live, sources, createdAt, updatedAt }) => ({
    id,
    templateId,
    name,
    client,
    pages,
    settings,
    live,
    sources,
    createdAt,
    updatedAt,
  }));
});

const Uuid = z.uuid();

/** Um dashboard do workspace aberto; null quando não existe ou é de outro workspace. */
export const getDashboard = cache(async (id: string): Promise<DashboardDetail | null> => {
  if (!Uuid.safeParse(id).success) return null;
  const session = await currentWorkspace();
  const supabase = await createServerSupabase();
  const row = unwrap(await supabase.from("dashboards").select(DASHBOARD_SELECT).eq("id", id).eq("workspace_id", session.workspace.id).maybeSingle());
  return row ? fromJoined(row as unknown as JoinedDashboard) : null;
});

/** Todas as contas do workspace (Meta, Google, GA4, orgânico, planilha): o assistente filtra pelas plataformas do modelo. Ativas primeiro. */
export const listSourceOptions = cache(async (): Promise<SourceOption[]> => {
  const session = await currentWorkspace();
  const supabase = await createServerSupabase();
  const rows =
    unwrap(
      await supabase
        .from("ad_accounts")
        .select("id, name, platform_id, business_name, is_enabled, last_synced_at")
        .eq("workspace_id", session.workspace.id)
        .order("is_enabled", { ascending: false })
        .order("name"),
    ) ?? [];
  return rows.map((r) => ({ id: r.id, name: r.name, platformId: r.platform_id as PlatformId, businessName: r.business_name, isEnabled: r.is_enabled, lastSyncedAt: r.last_synced_at }));
});
