import "server-only";

// A tela de um workspace (na tabela, um projeto): o cabeçalho (vale para todas as abas) e os
// dados de cada aba. Tudo pelo RLS de quem está logado: quem não acessa o workspace recebe
// null (404) no cabeçalho, e as abas só enxergam o que é dele.

import { cache } from "react";
import type { SourceOption } from "@/features/dashboards/model";
import { syncSummary } from "@/features/integrations/sync-label";
import { ENTITLEMENTS, TIER_LABEL } from "@/features/pricing/entitlements";
import type { ProjectAccountsData, ProjectDashboardsData, ProjectHighlights, ProjectOverviewData, ProjectPeopleData, ProjectPerson, ProjectSummary } from "@/features/projects/types";
import { hasRole, ROLE_RANK, type MemberRole } from "@/features/workspace/session";
import { getWorkspaceSession } from "@/server/auth/workspace";
import { listDashboards, listSourceOptions } from "@/server/dashboards/queries";
import { loadWorkspaceInsights } from "@/server/insights/load";
import { getConnectState, listAdAccounts } from "@/server/integrations/queries";
import { appError, unwrap } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function session() {
  const s = await getWorkspaceSession();
  if (!s) throw appError("auth:required");
  return s;
}

const nameOf = (p: { full_name: string | null; email: string | null } | undefined) => p?.full_name?.trim() || p?.email?.split("@")[0] || "Pessoa";

/** Quem acessa o workspace: dono e admins da organização (todos) e quem está nele. */
async function loadPeople(projectId: string) {
  const s = await session();
  const db = await createServerSupabase();
  const [members, inProject] = await Promise.all([
    db.from("workspace_members").select("user_id, role").eq("workspace_id", s.workspace.id).then(unwrap),
    db.from("project_members").select("user_id").eq("project_id", projectId).then(unwrap),
  ]);
  const ids = (members ?? []).map((m) => m.user_id);
  const profiles = ids.length ? (unwrap(await db.from("profiles").select("id, full_name, email").in("id", ids)) ?? []) : [];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const inSet = new Set((inProject ?? []).map((m) => m.user_id));
  const people: ProjectPerson[] = (members ?? [])
    .map((m) => {
      const role = m.role as MemberRole;
      const allAccess = ROLE_RANK[role] >= ROLE_RANK.admin;
      return { userId: m.user_id, name: nameOf(byId.get(m.user_id)), email: byId.get(m.user_id)?.email ?? "", role, allAccess, inProject: allAccess || inSet.has(m.user_id), isYou: m.user_id === s.user.id };
    })
    .sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.name.localeCompare(b.name, "pt-BR"));
  return { people, members: members?.length ?? 0 };
}

/** Cabeçalho do workspace. null = não existe, arquivado ou a pessoa não acessa. */
export const getProjectSummary = cache(async (projectId: string): Promise<ProjectSummary | null> => {
  const s = await session();
  if (!UUID.test(projectId)) return null;
  const db = await createServerSupabase();
  const ws = s.workspace.id;
  const project = unwrap(await db.from("projects").select("id, name, created_at").eq("id", projectId).eq("workspace_id", ws).is("archived_at", null).maybeSingle());
  if (!project) return null;
  const [accounts, dashboards, { people }] = await Promise.all([
    db.from("ad_accounts").select("is_enabled").eq("workspace_id", ws).eq("project_id", projectId).then(unwrap),
    db.from("dashboards").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("project_id", projectId),
    loadPeople(projectId),
  ]);
  return {
    id: project.id,
    name: project.name,
    createdAt: project.created_at,
    enabledAccounts: (accounts ?? []).filter((a) => a.is_enabled).length,
    accounts: accounts?.length ?? 0,
    dashboards: dashboards.count ?? 0,
    people: people.filter((p) => p.inProject).length,
    canEdit: hasRole(s.role, "member"),
    canManage: hasRole(s.role, "admin"),
  };
});

/** Aba Pessoas. */
export async function getProjectPeople(projectId: string): Promise<ProjectPeopleData> {
  const s = await session();
  const db = await createServerSupabase();
  const canManage = hasRole(s.role, "admin");
  const now = new Date().toISOString();
  const [{ people, members }, invitations, pending] = await Promise.all([
    loadPeople(projectId),
    canManage
      ? db.from("workspace_invitations").select("id, email, role, expires_at").eq("workspace_id", s.workspace.id).contains("project_ids", [projectId]).is("accepted_at", null).is("revoked_at", null).gt("expires_at", now).then(unwrap)
      : Promise.resolve([]),
    canManage ? db.from("workspace_invitations").select("id", { count: "exact", head: true }).eq("workspace_id", s.workspace.id).is("accepted_at", null).is("revoked_at", null).gt("expires_at", now) : Promise.resolve({ count: 0 }),
  ]);
  const ent = s.access.entitlements ?? ENTITLEMENTS[s.access.tier ?? "base"];
  return {
    people,
    invitations: (invitations ?? []).map((i) => ({ id: i.id, email: i.email, role: i.role as "viewer" | "member" | "admin", expiresAt: i.expires_at })),
    seats: { used: members + ((pending as { count: number | null }).count ?? 0), limit: ent.maxMembers },
    actorRole: s.role,
    canManage,
  };
}

/** Aba Contas: as contas deste workspace, as que dá para trazer (dos logins) e os logins. */
export async function getProjectAccounts(projectId: string): Promise<ProjectAccountsData> {
  const s = await session();
  const [state, all] = await Promise.all([getConnectState(), listAdAccounts()]);
  const nameOf = new Map(state.projects.map((p) => [p.id, p.name]));
  const connections = [...new Map(Object.values(state.platforms).flatMap((p) => p.connections).map((c) => [c.id, c])).values()];
  return {
    accounts: all.filter((a) => a.projectId === projectId),
    candidates: all.filter((a) => a.projectId !== projectId && !a.manual && !a.imported && !!a.connectionId && a.status === "active").map((a) => ({ ...a, projectName: a.projectId ? (nameOf.get(a.projectId) ?? null) : null })),
    connections,
    providers: state.providers,
    projects: state.projects.filter((p) => p.id !== projectId),
    maxAccountsPerPlatform: state.limit.maxAccountsPerPlatform,
    canManage: state.canManage,
    canSync: state.canSync,
    mock: state.mock,
    now: new Date().toISOString(),
    timeZone: s.workspace.timezone || "America/Sao_Paulo",
  };
}

/** Aba Dashboards: os deste workspace e as contas dele para o dashboard novo. */
export async function getProjectDashboards(projectId: string): Promise<ProjectDashboardsData> {
  const s = await session();
  const db = await createServerSupabase();
  const [items, sources, ids, accountIds] = await Promise.all([
    listDashboards(),
    listSourceOptions(),
    db.from("dashboards").select("id").eq("workspace_id", s.workspace.id).eq("project_id", projectId).then(unwrap),
    db.from("ad_accounts").select("id").eq("workspace_id", s.workspace.id).eq("project_id", projectId).then(unwrap),
  ]);
  const mine = new Set((ids ?? []).map((d) => d.id));
  const accs = new Set((accountIds ?? []).map((a) => a.id));
  const tier = s.access.tier ?? "base";
  return {
    items: items.filter((d) => mine.has(d.id)),
    sources: sources.filter((o: SourceOption) => accs.has(o.id)),
    limit: s.access.entitlements?.maxDashboards ?? 0,
    used: items.length,
    planLabel: TIER_LABEL[tier],
    tier,
    pagesTier: s.access.entitlements?.pages ?? "base",
    canEdit: hasRole(s.role, "member"),
    brand: { color: s.workspace.brandColor, logoUrl: s.workspace.brandLogoUrl ?? null, canEdit: hasRole(s.role, "admin") },
  };
}

/** Visão geral: dashboards recentes, saúde das contas, equipe, tarefas e links. */
export async function getProjectOverview(projectId: string): Promise<ProjectOverviewData> {
  const s = await session();
  const db = await createServerSupabase();
  const ws = s.workspace.id;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const [recent, all, { people }, open, due] = await Promise.all([
    db.from("dashboards").select("id, name, template_id, updated_at").eq("workspace_id", ws).eq("project_id", projectId).order("updated_at", { ascending: false }).limit(5).then(unwrap),
    listAdAccounts(),
    loadPeople(projectId),
    db.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("project_id", projectId).in("status", ["planejado", "em_andamento"]),
    db.from("tasks").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("project_id", projectId).in("status", ["planejado", "em_andamento"]).lte("due_date", today),
  ]);
  const dashIds = (recent ?? []).map((d) => d.id);
  const allDash = dashIds.length ? (unwrap(await db.from("dashboards").select("id").eq("workspace_id", ws).eq("project_id", projectId)) ?? []).map((d) => d.id) : [];
  const links = allDash.length
    ? await db.from("share_links").select("id", { count: "exact", head: true }).in("dashboard_id", allDash).is("revoked_at", null).or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
    : { count: 0 };

  const accounts = all.filter((a) => a.projectId === projectId);
  const tz = s.workspace.timezone || "America/Sao_Paulo";
  const byPlatform = new Map<string, ProjectOverviewData["platforms"][number]>();
  for (const a of accounts) {
    const row = byPlatform.get(a.platformId) ?? { platformId: a.platformId, enabled: 0, total: 0, failing: 0, lastSyncedAt: null };
    row.total++;
    if (a.isEnabled) {
      row.enabled++;
      if (syncSummary(a, now.toISOString(), tz)?.tone === "error") row.failing++;
      if (a.lastSyncedAt && (!row.lastSyncedAt || a.lastSyncedAt > row.lastSyncedAt)) row.lastSyncedAt = a.lastSyncedAt;
    }
    byPlatform.set(a.platformId, row);
  }
  return {
    now: now.toISOString(),
    recent: (recent ?? []).map((d) => ({ id: d.id, name: d.name, templateId: d.template_id, updatedAt: d.updated_at })),
    platforms: [...byPlatform.values()].sort((a, b) => b.enabled - a.enabled),
    team: people.filter((p) => p.inProject).map((p) => ({ userId: p.userId, name: p.name, role: p.role })),
    openTasks: open.count ?? 0,
    dueTasks: due.count ?? 0,
    activeLinks: (links as { count: number | null }).count ?? 0,
  };
}

/** Destaques dos últimos 7 dias: as análises dos dashboards com dados reais deste workspace. */
export async function getProjectHighlights(projectId: string): Promise<ProjectHighlights> {
  const s = await session();
  const db = await createServerSupabase();
  const loaded = await loadWorkspaceInsights(db, s.workspace.id, "7d", 8, [projectId]).catch(() => null);
  const pulse = loaded?.pulse ?? [];
  return {
    insights: (loaded?.insights ?? []).slice(0, 4),
    spend: pulse.length ? pulse.reduce((n, p) => n + (p.spend ?? 0), 0) : null,
    conversions: pulse.reduce((n, p) => n + p.conversions, 0),
    currency: pulse[0]?.currency ?? s.workspace.currency ?? "BRL",
  };
}
