import "server-only";

// Página de um workspace (na tabela, um projeto): contas, dashboards e quem acessa.
// Tudo pelo RLS de quem está logado: quem não acessa o workspace recebe null (404).

import { ENTITLEMENTS } from "@/features/pricing/entitlements";
import type { ProjectDetail, ProjectPerson } from "@/features/projects/types";
import { hasRole, ROLE_RANK, type MemberRole } from "@/features/workspace/session";
import { getWorkspaceSession } from "@/server/auth/workspace";
import { appError, unwrap } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const session = await getWorkspaceSession();
  if (!session) throw appError("auth:required");
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return null;
  const db = await createServerSupabase();
  const ws = session.workspace.id;
  const canManage = hasRole(session.role, "admin");

  const project = unwrap(await db.from("projects").select("id, name, created_at").eq("id", projectId).eq("workspace_id", ws).is("archived_at", null).maybeSingle());
  if (!project) return null;

  const now = new Date().toISOString();
  const [accounts, dashboards, members, inProject, invitations, pending] = await Promise.all([
    db.from("ad_accounts").select("id, name, platform_id, is_enabled, last_synced_at").eq("workspace_id", ws).eq("project_id", projectId).order("name").then(unwrap),
    db.from("dashboards").select("id, name, template_id, updated_at").eq("workspace_id", ws).eq("project_id", projectId).order("updated_at", { ascending: false }).then(unwrap),
    db.from("workspace_members").select("user_id, role").eq("workspace_id", ws).then(unwrap),
    db.from("project_members").select("user_id").eq("project_id", projectId).then(unwrap),
    canManage
      ? db.from("workspace_invitations").select("id, email, role, expires_at").eq("workspace_id", ws).contains("project_ids", [projectId]).is("accepted_at", null).is("revoked_at", null).gt("expires_at", now).then(unwrap)
      : Promise.resolve([]),
    canManage
      ? db.from("workspace_invitations").select("id", { count: "exact", head: true }).eq("workspace_id", ws).is("accepted_at", null).is("revoked_at", null).gt("expires_at", now)
      : Promise.resolve({ count: 0 }),
  ]);

  const ids = (members ?? []).map((m) => m.user_id);
  const profiles = ids.length ? (unwrap(await db.from("profiles").select("id, full_name, email").in("id", ids)) ?? []) : [];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const inSet = new Set((inProject ?? []).map((m) => m.user_id));
  const people: ProjectPerson[] = (members ?? [])
    .map((m) => {
      const role = m.role as MemberRole;
      const p = byId.get(m.user_id);
      const allAccess = ROLE_RANK[role] >= ROLE_RANK.admin;
      return { userId: m.user_id, name: p?.full_name?.trim() || p?.email?.split("@")[0] || "Pessoa", email: p?.email ?? "", role, allAccess, inProject: allAccess || inSet.has(m.user_id), isYou: m.user_id === session.user.id };
    })
    .sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role] || a.name.localeCompare(b.name, "pt-BR"));

  const ent = session.access.entitlements ?? ENTITLEMENTS[session.access.tier ?? "base"];
  return {
    id: project.id,
    name: project.name,
    createdAt: project.created_at,
    accounts: (accounts ?? []).map((a) => ({ id: a.id, name: a.name, platformId: a.platform_id, isEnabled: a.is_enabled, lastSyncedAt: a.last_synced_at })),
    dashboards: (dashboards ?? []).map((d) => ({ id: d.id, name: d.name, templateId: d.template_id, updatedAt: d.updated_at })),
    people,
    invitations: (invitations ?? []).map((i) => ({ id: i.id, email: i.email, role: i.role as "viewer" | "member" | "admin", expiresAt: i.expires_at })),
    seats: { used: (members?.length ?? 0) + ((pending as { count: number | null }).count ?? 0), limit: ent.maxMembers },
    maxAccountsPerPlatform: ent.maxAccountsPerPlatform,
    canEdit: hasRole(session.role, "member"),
    canManage,
  };
}
