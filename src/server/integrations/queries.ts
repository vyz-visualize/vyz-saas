import "server-only";

// Leituras de conexões e contas do workspace aberto, com o RLS de quem está
// logado (membros leem). DTOs em camelCase, sem token nem metadado cru do
// provedor. Uma consulta por tipo por requisição (React cache).

import { cache } from "react";
import type { PlatformId } from "@/features/accounts/platforms";
import { countUnits } from "@/features/integrations/limits";
import { PROVIDER_IDS, PROVIDERS, type ProviderId } from "@/features/integrations/providers";
import type { AdAccountDTO, AdAccountStatus, ConnectionDTO, ConnectionStatus, ConnectState, PlatformConnectState, SyncTrigger } from "@/features/integrations/types";
import { ENTITLEMENTS } from "@/features/pricing/entitlements";
import { hasRole } from "@/features/workspace/session";
import { listProjects } from "@/server/projects/queries";
import { getWorkspaceSession } from "@/server/auth/workspace";
import { isMockIntegrations } from "@/server/env";
import { appError, unwrap } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

async function currentSession() {
  const session = await getWorkspaceSession();
  if (!session) throw appError("auth:required");
  return session;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function stringFields(v: unknown): Record<string, string> {
  if (!isRecord(v)) return {};
  return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === "string"));
}

// A última sincronização vem embutida (1 por conta); os dashboards, pelo dashboard_sources.
const ACCOUNT_SELECT = `id, platform_id, connection_id, name, external_id, business_external_id, business_name, manager_external_id,
  currency, timezone, status, is_enabled, enabled_at, last_synced_at, metadata, project_id,
  last_sync:sync_runs!sync_runs_workspace_id_ad_account_id_fkey(status, trigger, started_at, finished_at, rows_written, error, created_at),
  sources:dashboard_sources!dashboard_sources_workspace_id_ad_account_id_fkey(dashboard:dashboards!dashboard_sources_workspace_id_dashboard_id_fkey(id, name))`;

const loadAdAccounts = cache(async (): Promise<AdAccountDTO[]> => {
  const session = await currentSession();
  const supabase = await createServerSupabase();
  const rows = unwrap(
    await supabase
      .from("ad_accounts")
      .select(ACCOUNT_SELECT)
      .eq("workspace_id", session.workspace.id)
      .order("created_at", { referencedTable: "last_sync", ascending: false })
      .limit(1, { referencedTable: "last_sync" })
      .order("business_name", { nullsFirst: false })
      .order("name"),
  ) ?? [];

  return rows.map((r): AdAccountDTO => {
    const meta = isRecord(r.metadata) ? r.metadata : {};
    const manual = r.connection_id === null && (r.status === "pending" || meta.source === "manual");
    const run = r.last_sync[0];
    return {
      id: r.id,
      platformId: r.platform_id as PlatformId,
      connectionId: r.connection_id,
      name: r.name,
      externalId: r.external_id,
      businessExternalId: r.business_external_id,
      businessName: r.business_name,
      managerExternalId: r.manager_external_id,
      managerName: typeof meta.manager_name === "string" ? meta.manager_name : null,
      currency: r.currency,
      timezone: r.timezone,
      status: r.status as AdAccountStatus,
      isEnabled: r.is_enabled,
      enabledAt: r.enabled_at,
      lastSyncedAt: r.last_synced_at,
      lastSync: run
        ? {
            status: run.status,
            trigger: run.trigger as SyncTrigger,
            startedAt: run.started_at,
            finishedAt: run.finished_at,
            rowsWritten: run.rows_written,
            error: run.error,
            createdAt: run.created_at,
          }
        : null,
      manual,
      fields: manual ? stringFields(meta.fields) : {},
      dashboards: r.sources.flatMap((s) => (s.dashboard ? [{ id: s.dashboard.id, name: s.dashboard.name }] : [])),
      projectId: r.project_id,
    };
  });
});

const loadConnections = cache(async (): Promise<ConnectionDTO[]> => {
  const session = await currentSession();
  const supabase = await createServerSupabase();
  const [rows, accounts] = await Promise.all([
    supabase
      .from("connections")
      .select("id, provider, status, external_user_name, external_user_email, is_mock, connected_by, connected_at, token_expires_at, last_synced_at, last_error")
      .eq("workspace_id", session.workspace.id)
      .order("connected_at")
      .then((r) => unwrap(r) ?? []),
    loadAdAccounts(),
  ]);

  // Nome de quem conectou (perfis da equipe; quem saiu do workspace fica sem nome).
  const ids = [...new Set(rows.map((r) => r.connected_by).filter((v): v is string => !!v))];
  const people = ids.length ? (unwrap(await supabase.from("profiles").select("id, full_name, email").in("id", ids)) ?? []) : [];
  const nameOf = new Map(people.map((p) => [p.id, p.full_name || p.email]));

  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    status: r.status as ConnectionStatus,
    userName: r.external_user_name,
    userEmail: r.external_user_email,
    isMock: r.is_mock,
    connectedAt: r.connected_at,
    connectedByName: (r.connected_by && nameOf.get(r.connected_by)) || null,
    tokenExpiresAt: r.token_expires_at,
    lastSyncedAt: r.last_synced_at,
    lastError: r.last_error,
    accountsCount: accounts.filter((a) => a.connectionId === r.id).length,
  }));
});

/** Conexões OAuth do workspace (Meta, Google). */
export async function listConnections(): Promise<ConnectionDTO[]> {
  return loadConnections();
}

/** Contas do workspace (conectadas e cadastradas pelo ID), com a última sincronização. */
export async function listAdAccounts(filter: { platformId?: string; manual?: boolean } = {}): Promise<AdAccountDTO[]> {
  const all = await loadAdAccounts();
  return all.filter((a) => (!filter.platformId || a.platformId === filter.platformId) && (filter.manual === undefined || a.manual === filter.manual));
}

/** Estado da conexão por plataforma (Meta Ads, Google Ads) e o limite do plano. */
export async function getConnectState(): Promise<ConnectState> {
  const session = await currentSession();
  const [connections, accounts, projects] = await Promise.all([loadConnections(), loadAdAccounts(), listProjects()]);
  const ent = session.access.entitlements ?? ENTITLEMENTS[session.access.tier ?? "base"];

  const platform = (provider: ProviderId): PlatformConnectState => {
    const platformId = PROVIDERS[provider].platformId;
    const list = accounts.filter((a) => a.platformId === platformId && !a.manual);
    const conns = connections.filter((c) => c.provider === provider);
    return {
      platformId,
      provider,
      connected: conns.some((c) => c.status === "active"),
      connections: conns,
      accounts: list,
      enabledCount: list.filter((a) => a.isEnabled).length,
    };
  };

  return {
    platforms: Object.fromEntries(PROVIDER_IDS.map((p) => [p, platform(p)])) as Record<ProviderId, PlatformConnectState>,
    limit: {
      accountsQuantity: session.access.accountsQuantity,
      billableAccounts: countUnits(accounts.filter((a) => a.isEnabled)),
      maxAccountsPerPlatform: ent.maxAccountsPerPlatform,
    },
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
    canManage: hasRole(session.role, "admin"),
    canSync: hasRole(session.role, "member"),
    mock: isMockIntegrations(),
  };
}
