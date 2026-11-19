import "server-only";

// Acessos do cliente (aba Acessos do workspace e a lista de workspaces): os links dos
// dashboards do workspace e as visitas a eles nos últimos 90 dias, pelo RLS de quem está
// logado (cada membro só vê os dashboards que acessa). O resumo é puro
// (src/features/projects/client-activity.ts).

import { cache } from "react";
import { projectPulses, summarizeClientActivity, type ClientLink, type ClientVisit, type ProjectClientActivity, type ProjectClientPulse, type VisitDevice } from "@/features/projects/client-activity";
import { PAGES } from "@/features/templates/pages";
import type { PageId } from "@/features/templates/types";
import { currentWorkspaceSession } from "@/server/auth/workspace";
import { unwrap } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

const DAY = 86_400_000;
const WINDOW_DAYS = 90;
const MAX_LINKS = 300;
const MAX_VISITS = 2000;

const pageName = (id: string) => PAGES[id as PageId]?.name ?? id;

export const getProjectClientActivity = cache(async (projectId: string): Promise<ProjectClientActivity> => {
  const s = await currentWorkspaceSession();
  const db = await createServerSupabase();
  const ws = s.workspace.id;
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY).toISOString();

  const [links, visits] = await Promise.all([
    db
      .from("share_links")
      .select("id, dashboard_id, recipient_name, token_hint, created_at, expires_at, revoked_at, dashboard:dashboards!share_links_workspace_id_dashboard_id_fkey!inner(name, project_id)")
      .eq("workspace_id", ws)
      .eq("dashboard.project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(MAX_LINKS)
      .then(unwrap),
    db
      .from("share_visits")
      .select("id, share_link_id, dashboard_id, started_at, last_seen_at, seconds, pages, device")
      .eq("workspace_id", ws)
      .eq("project_id", projectId)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(MAX_VISITS)
      .then(unwrap),
  ]);

  const clientLinks: ClientLink[] = (links ?? []).map((l) => ({
    id: l.id,
    dashboardId: l.dashboard_id,
    dashboardName: l.dashboard?.name ?? "Dashboard",
    recipientName: l.recipient_name,
    tokenHint: l.token_hint,
    createdAt: l.created_at,
    expiresAt: l.expires_at,
    revokedAt: l.revoked_at,
  }));
  const clientVisits: ClientVisit[] = (visits ?? []).map((v) => ({
    id: v.id,
    linkId: v.share_link_id,
    dashboardId: v.dashboard_id,
    startedAt: v.started_at,
    lastSeenAt: v.last_seen_at,
    seconds: v.seconds,
    pages: v.pages.map(pageName),
    device: (v.device as VisitDevice | null) ?? null,
  }));

  return {
    ...summarizeClientActivity(clientLinks, clientVisits, now),
    now: now.toISOString(),
    timeZone: s.workspace.timezone || "America/Sao_Paulo",
    canShare: s.role !== "viewer",
  };
});

/** Situação do cliente em cada workspace (lista de workspaces). Falha de leitura não derruba a lista. */
export const getProjectPulses = cache(async (): Promise<Record<string, ProjectClientPulse>> => {
  const s = await currentWorkspaceSession();
  const db = await createServerSupabase();
  const ws = s.workspace.id;
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY).toISOString();
  const [links, visits] = await Promise.all([
    db.from("share_links").select("dashboard:dashboards!share_links_workspace_id_dashboard_id_fkey!inner(project_id)").eq("workspace_id", ws).is("revoked_at", null).limit(MAX_LINKS * 3),
    db.from("share_visits").select("project_id, started_at").eq("workspace_id", ws).gte("started_at", since).order("started_at", { ascending: false }).limit(MAX_VISITS * 2),
  ]);
  if (links.error || visits.error) {
    console.error("[vyz] acessos dos workspaces", links.error?.message ?? visits.error?.message);
    return {};
  }
  const pulses = projectPulses(
    links.data.map((l) => ({ projectId: l.dashboard?.project_id ?? null })),
    visits.data.map((v) => ({ projectId: v.project_id, startedAt: v.started_at })),
    now,
  );
  return Object.fromEntries(pulses);
});
