import "server-only";

// Leitura dos projetos do workspace aberto (RLS de quem está logado).

import { cache } from "react";
import { ENTITLEMENTS } from "@/features/pricing/entitlements";
import type { ProjectDTO, ProjectsState } from "@/features/projects/types";
import { hasRole } from "@/features/workspace/session";
import { getWorkspaceSession } from "@/server/auth/workspace";
import { appError, unwrap } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

/** Projetos ativos, do mais antigo para o mais novo, com contas ligadas e dashboards. */
export const listProjects = cache(async (): Promise<ProjectDTO[]> => {
  const session = await getWorkspaceSession();
  if (!session) throw appError("auth:required");
  const db = await createServerSupabase();
  const ws = session.workspace.id;
  const [projects, accounts, dashboards] = await Promise.all([
    db.from("projects").select("id, name, created_at").eq("workspace_id", ws).is("archived_at", null).order("created_at").then(unwrap),
    db.from("ad_accounts").select("project_id").eq("workspace_id", ws).eq("is_enabled", true).then(unwrap),
    db.from("dashboards").select("project_id").eq("workspace_id", ws).then(unwrap),
  ]);
  const count = (rows: { project_id: string | null }[] | null, id: string) => (rows ?? []).filter((r) => r.project_id === id).length;
  return (projects ?? []).map((p) => ({ id: p.id, name: p.name, createdAt: p.created_at, enabledAccounts: count(accounts, p.id), dashboards: count(dashboards, p.id) }));
});

export async function getProjectsState(): Promise<ProjectsState> {
  const session = await getWorkspaceSession();
  if (!session) throw appError("auth:required");
  const ent = session.access.entitlements ?? ENTITLEMENTS[session.access.tier ?? "base"];
  return {
    projects: await listProjects(),
    quantity: session.access.accountsQuantity,
    maxAccountsPerPlatform: ent.maxAccountsPerPlatform,
    canEdit: hasRole(session.role, "member"),
    canArchive: hasRole(session.role, "admin"),
  };
}
