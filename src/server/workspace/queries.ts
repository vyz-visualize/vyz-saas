import "server-only";

// Leituras do painel com o RLS de quem está logado: Início (recentes,
// conexões, links) e Configurações (perfil, equipe, histórico de acessos e
// atividade do workspace). DTOs no formato da tela, sem IP de terceiros nem
// linhas cruas da auditoria.

import { CORE_PROVIDER_IDS, PROVIDERS } from "@/features/integrations/providers";
import { anyDashboardTemplate } from "@/features/templates/live";
import { landingTemplate } from "@/features/templates/landing-pages";
import type { AccessEvent, ActivityItem, HomeConnection, HomeData, SettingsData, TeamMember } from "@/features/workspace/dto";
import { activityLabel, activityTone, auditLabel, authEventLabel, deviceLabel } from "@/features/workspace/history";
import { hasRole, type MemberRole } from "@/features/workspace/session";
import { getWorkspaceSession } from "@/server/auth/workspace";
import { getConnectState } from "@/server/integrations/queries";
import { appError } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

async function currentSession() {
  const session = await getWorkspaceSession();
  if (!session) throw appError("auth:required");
  return session;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

// ---- Início ----------------------------------------------------------------------

/** Recentes (dashboards e landing pages), conexões com a última sincronização e links ativos. */
export async function getHomeData(): Promise<HomeData> {
  const session = await currentSession();
  const ws = session.workspace.id;
  const supabase = await createServerSupabase();
  const [dashboards, pages, links, connect] = await Promise.all([
    supabase.from("dashboards").select("id, name, client_name, template_id, updated_at").eq("workspace_id", ws).order("updated_at", { ascending: false }).limit(5),
    supabase.from("landing_pages").select("id, name, template_id, status, updated_at").eq("workspace_id", ws).neq("status", "archived").order("updated_at", { ascending: false }).limit(5),
    supabase.from("share_links").select("id", { count: "exact", head: true }).eq("workspace_id", ws).is("revoked_at", null),
    getConnectState(),
  ]);
  for (const r of [dashboards, pages, links]) if (r.error) console.error("[vyz] início", r.error);

  const recent: HomeData["recent"] = [
    ...(dashboards.data ?? []).map((d) => ({
      kind: "dashboard" as const,
      id: d.id,
      title: d.client_name ? `${d.client_name} · ${d.name}` : d.name,
      sub: `Dashboard · ${anyDashboardTemplate(d.template_id)?.name ?? "template"}`,
      href: `/painel/dashboards/${d.id}`,
      updatedAt: d.updated_at,
    })),
    ...(pages.data ?? []).map((p) => ({
      kind: "landing" as const,
      id: p.id,
      title: p.name,
      sub: `Landing page · ${p.status === "published" ? "publicada" : "rascunho"}${landingTemplate(p.template_id) ? ` · ${landingTemplate(p.template_id)?.name}` : ""}`,
      href: `/painel/landing-pages/${p.id}`,
      updatedAt: p.updated_at,
    })),
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  const connections: HomeConnection[] = CORE_PROVIDER_IDS.map((p) => {
    const state = connect.platforms[p];
    const enabled = state.accounts.filter((a) => a.isEnabled);
    const synced = enabled.map((a) => a.lastSyncedAt).filter((v): v is string => !!v);
    return {
      provider: p,
      name: PROVIDERS[p].name,
      connected: state.connected,
      enabledCount: enabled.length,
      accountsCount: state.accounts.length,
      lastSyncedAt: synced.length ? synced.reduce((a, b) => (a > b ? a : b)) : null,
      syncFailed: enabled.some((a) => a.lastSync?.status === "failed"),
      syncing: enabled.some((a) => a.lastSync?.status === "running" || a.lastSync?.status === "queued"),
    };
  });

  return { now: new Date().toISOString(), recent, connections, activeShareLinks: links.count ?? 0 };
}

// ---- Configurações ---------------------------------------------------------------

// Tabelas cuja história já aparece pelos eventos de atividade (cobrança e
// conexões): a auditoria delas repetiria a mesma linha.
const AUDIT_SKIP = ["subscriptions", "subscription_items", "invoices", "payment_transactions", "billing_customers", "checkout_sessions", "checkout_items", "connections"];

/** Perfil, equipe, acessos da conta e, para admin, a atividade do workspace. */
export async function getSettingsData(): Promise<SettingsData> {
  const session = await currentSession();
  const ws = session.workspace.id;
  const admin = hasRole(session.role, "admin");
  const supabase = await createServerSupabase();

  const [profile, members, invitations, access, activity, audit] = await Promise.all([
    supabase.from("profiles").select("full_name, email, phone").eq("id", session.user.id).maybeSingle(),
    supabase.from("workspace_members").select("user_id, role, created_at").eq("workspace_id", ws).order("created_at"),
    admin
      ? supabase
          .from("workspace_invitations")
          .select("id, email, role, expires_at")
          .eq("workspace_id", ws)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : null,
    supabase.from("auth_events").select("id, created_at, event, method, ip, user_agent, metadata").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(30),
    // membros leem a atividade sem IP nem navegador (o grant é por coluna)
    admin
      ? supabase.from("activity_events").select("id, created_at, actor_id, event, metadata").eq("workspace_id", ws).order("created_at", { ascending: false }).limit(40)
      : null,
    admin
      ? supabase
          .from("audit_events")
          .select("id, created_at, actor_id, action, table_name, changed_columns, new_name:new_data->>name, old_name:old_data->>name")
          .eq("workspace_id", ws)
          .not("table_name", "in", `(${AUDIT_SKIP.join(",")})`)
          .order("created_at", { ascending: false })
          .limit(60)
      : null,
  ]);
  for (const r of [profile, members, invitations, access, activity, audit]) if (r?.error) console.error("[vyz] configurações", r.error);

  // nomes da equipe e de quem fez cada coisa (o RLS mostra só quem divide workspace)
  const ids = new Set<string>([...(members.data ?? []).map((m) => m.user_id)]);
  for (const a of activity?.data ?? []) if (a.actor_id) ids.add(a.actor_id);
  for (const a of audit?.data ?? []) if (a.actor_id) ids.add(a.actor_id);
  const people = ids.size ? ((await supabase.from("profiles").select("id, full_name, email").in("id", [...ids])).data ?? []) : [];
  const person = new Map(people.map((p) => [p.id, p]));
  const nameOf = (id: string | null) => {
    const p = id ? person.get(id) : undefined;
    return p ? p.full_name || p.email : null;
  };

  const team: TeamMember[] = (members.data ?? []).map((m) => ({
    userId: m.user_id,
    name: person.get(m.user_id)?.full_name || person.get(m.user_id)?.email || "Membro",
    email: person.get(m.user_id)?.email ?? "",
    role: m.role as MemberRole,
    joinedAt: m.created_at,
    isYou: m.user_id === session.user.id,
  }));

  const accessEvents: AccessEvent[] = (access.data ?? []).map((e) => ({
    id: e.id,
    at: e.created_at,
    ...authEventLabel(e.event, e.method, isRecord(e.metadata) ? e.metadata : {}),
    device: deviceLabel(e.user_agent),
    ip: e.ip ? String(e.ip) : null,
  }));

  let items: ActivityItem[] | null = null;
  if (admin) {
    const fromActivity: ActivityItem[] = (activity?.data ?? []).map((a) => ({
      id: `a${a.id}`,
      at: a.created_at,
      label: activityLabel(a.event, isRecord(a.metadata) ? a.metadata : {}),
      tone: activityTone(a.event),
      actorName: nameOf(a.actor_id),
    }));
    const fromAudit: ActivityItem[] = (audit?.data ?? []).flatMap((a) => {
      const label = auditLabel({ action: a.action, table: a.table_name, name: a.new_name ?? a.old_name, changedColumns: a.changed_columns });
      return label ? [{ id: `u${a.id}`, at: a.created_at, label, tone: "neutral" as const, actorName: nameOf(a.actor_id) }] : [];
    });
    items = [...fromActivity, ...fromAudit].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
  }

  return {
    now: new Date().toISOString(),
    profile: { fullName: profile.data?.full_name ?? session.user.fullName, email: profile.data?.email ?? session.user.email, phone: profile.data?.phone ?? null },
    team,
    invitations: (invitations?.data ?? []).map((i) => ({ id: i.id, email: i.email, role: i.role as MemberRole, expiresAt: i.expires_at })),
    access: accessEvents,
    activity: items,
  };
}
