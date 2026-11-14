"use client";

// Telas de um workspace na bancada (/dev/painel?tela=workspace, workspace-dashboards,
// workspace-contas, workspace-pessoas, workspace-ajustes), com dados de exemplo.

import { DEFAULT_SETTINGS } from "@/features/dashboards/data";
import { DashboardsList } from "@/features/dashboards/DashboardsList";
import type { DashboardListItem } from "@/features/dashboards/model";
import type { AdAccountDTO, ConnectionDTO } from "@/features/integrations/types";
import { ENTITLEMENTS, TIER_LABEL } from "@/features/pricing/entitlements";
import type { ProjectAccountsData, ProjectHighlights, ProjectOverviewData, ProjectPeopleData, ProjectSummary } from "@/features/projects/types";
import { Highlights, Overview } from "@/features/projects/workspace/Overview";
import { WorkspaceAccounts } from "@/features/projects/workspace/WorkspaceAccounts";
import { WorkspaceHeader } from "@/features/projects/workspace/WorkspaceHeader";
import { WorkspacePeople } from "@/features/projects/workspace/WorkspacePeople";
import { WorkspaceSettings } from "@/features/projects/workspace/WorkspaceSettings";
import type { Screen } from "./types";

export const P1 = "11111111-1111-4111-8111-111111111111";
export const P2 = "22222222-2222-4222-8222-222222222222";
export const P3 = "33333333-3333-4333-8333-333333333333";
// logo de exemplo (um sol), sem arquivo: data URL de um SVG pequeno
export const AURORA_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="36" r="13" fill="#f59e0b"/><g stroke="#f59e0b" stroke-width="4" stroke-linecap="round"><path d="M32 9v7M12 18l5 5M52 18l-5 5M6 36h7M51 36h7"/></g><path d="M8 52h48" stroke="#1f2937" stroke-width="5" stroke-linecap="round"/></svg>')}`;
/** Os três casos: com logo, com cor e sem nada (a cor padrão). */
export const BENCH_PROJECTS = [
  { id: P1, name: "Loja Aurora", color: null, logoUrl: AURORA_LOGO },
  { id: P2, name: "Clínica Sol", color: "#2563eb", logoUrl: null },
  { id: P3, name: "Imobiliária Vista do Parque Empreendimentos", color: null, logoUrl: null },
];

const NOW = "2026-11-13T15:00:00.000Z";
const at = (min: number) => new Date(Date.parse(NOW) - min * 60_000).toISOString();
const day = (ago: number) => new Date(Date.parse(NOW) - ago * 86_400_000).toISOString();

const SUMMARY: ProjectSummary = { id: P1, name: "Loja Aurora", createdAt: day(90), color: null, logoUrl: AURORA_LOGO, enabledAccounts: 5, accounts: 6, dashboards: 2, people: 3, canEdit: true, canManage: true };

const OVERVIEW: ProjectOverviewData = {
  now: NOW,
  recent: [
    { id: "d1", name: "Loja Aurora · Vendas", templateId: "vyz-ecommerce", updatedAt: at(12) },
    { id: "d4", name: "Aurora · Black Friday", templateId: "pulso-ecommerce", updatedAt: at(60 * 24 * 4) },
  ],
  platforms: [
    { platformId: "meta", enabled: 2, total: 3, failing: 0, lastSyncedAt: at(42) },
    { platformId: "instagram", enabled: 1, total: 1, failing: 0, lastSyncedAt: at(42) },
    { platformId: "google", enabled: 1, total: 1, failing: 1, lastSyncedAt: at(60 * 9) },
    { platformId: "ga4", enabled: 1, total: 1, failing: 0, lastSyncedAt: at(60) },
  ],
  team: [
    { userId: "u1", name: "Pedro Freitas", role: "owner" },
    { userId: "u4", name: "Júlia Matos", role: "admin" },
    { userId: "u2", name: "Marina Alves", role: "member" },
  ],
  openTasks: 5,
  dueTasks: 1,
  activeLinks: 1,
};

const HIGHLIGHTS: ProjectHighlights = {
  spend: 18420,
  conversions: 214,
  currency: "BRL",
  insights: [
    { id: "h1", dashboardId: "d1", dashboardName: "Loja Aurora · Vendas", tone: "bad", title: "Custo por compra subiu 22%", body: "Foi de R$ 61 para R$ 74 nos últimos 7 dias, puxado pela campanha Remarketing.", weight: 9 },
    { id: "h2", dashboardId: "d1", dashboardName: "Loja Aurora · Vendas", tone: "good", title: "ROAS do Google em 5,6", body: "A campanha Pesquisa · Marca vendeu 38% a mais com o mesmo investimento.", weight: 7 },
    { id: "h3", dashboardId: "d4", dashboardName: "Aurora · Black Friday", tone: "info", title: "Criativo em vídeo cansando", body: "A frequência passou de 3,4 e o CTR caiu 18% na semana.", weight: 5 },
  ],
};

const sync = (ok: boolean) => ({ status: ok ? ("succeeded" as const) : ("failed" as const), trigger: "scheduled" as const, startedAt: at(ok ? 43 : 60 * 9), finishedAt: at(ok ? 42 : 60 * 9), rowsWritten: ok ? 120 : 0, error: ok ? null : "O Google recusou o acesso: reconecte o login.", createdAt: at(ok ? 43 : 60 * 9) });

const acc = (id: string, name: string, platformId: AdAccountDTO["platformId"], o: Partial<AdAccountDTO> = {}): AdAccountDTO => ({
  id,
  platformId,
  connectionId: platformId === "google" || platformId === "ga4" ? "cn2" : "cn1",
  name,
  externalId: `act_${id}`,
  businessExternalId: null,
  businessName: platformId === "meta" ? "BM Loja Aurora" : null,
  managerExternalId: null,
  managerName: null,
  currency: "BRL",
  timezone: "America/Sao_Paulo",
  status: "active",
  isEnabled: true,
  enabledAt: day(30),
  lastSyncedAt: at(42),
  lastSync: sync(true),
  manual: false,
  imported: null,
  fields: {},
  dashboards: [{ id: "d1", name: "Loja Aurora · Vendas" }],
  projectId: P1,
  ...o,
});

const conn = (id: string, provider: ConnectionDTO["provider"], userName: string, status: ConnectionDTO["status"] = "active", accountsCount = 6): ConnectionDTO => ({
  id,
  provider,
  status,
  userName,
  userEmail: null,
  isMock: false,
  connectedAt: day(60),
  connectedByName: "Pedro Freitas",
  tokenExpiresAt: null,
  lastSyncedAt: at(40),
  lastError: null,
  accountsCount,
});

const ACCOUNTS: ProjectAccountsData = {
  accounts: [
    acc("a1", "Loja Aurora · Vendas online", "meta"),
    acc("a2", "Loja Aurora · Catálogo", "meta"),
    acc("a3", "Aurora Outlet", "meta", { isEnabled: false, lastSyncedAt: null, lastSync: null, dashboards: [] }),
    acc("a4", "@lojaaurora", "instagram"),
    acc("a5", "Aurora Search", "google", { lastSync: sync(false), lastSyncedAt: at(60 * 9) }),
    acc("a6", "lojaaurora.com.br", "ga4"),
  ],
  candidates: [
    { ...acc("b1", "Clínica Sol · Leads", "meta", { projectId: P2, businessName: "BM Clínica Sol" }), projectName: "Clínica Sol" },
    { ...acc("b2", "Aurora · Testes de criativo", "meta", { projectId: null, isEnabled: false }), projectName: null },
    { ...acc("b3", "@aurora.outlet", "instagram", { projectId: null, isEnabled: false }), projectName: null },
    { ...acc("b4", "Aurora Shopping", "google", { projectId: null, isEnabled: false }), projectName: null },
  ],
  connections: [conn("cn1", "meta", "Pedro Freitas (Facebook)", "active", 9), conn("cn2", "google", "dados@agenciaexemplo.com", "active", 5), conn("cn3", "meta", "Facebook antigo da agência", "expired", 2)],
  providers: ["meta", "google", "ga4", "tiktok", "linkedin", "rdstation", "hubspot"],
  projects: [
    { id: P2, name: "Clínica Sol" },
    { id: P3, name: "Imobiliária Vista do Parque Empreendimentos" },
  ],
  maxAccountsPerPlatform: 3,
  canManage: true,
  canSync: true,
  mock: false,
  now: NOW,
  timeZone: "America/Sao_Paulo",
};

const PEOPLE: ProjectPeopleData = {
  people: [
    { userId: "u1", name: "Pedro Freitas", email: "pedro@exemplo.com", role: "owner", allAccess: true, inProject: true, isYou: true },
    { userId: "u4", name: "Júlia Matos", email: "julia@exemplo.com", role: "admin", allAccess: true, inProject: true, isYou: false },
    { userId: "u2", name: "Marina Alves", email: "marina@exemplo.com", role: "member", allAccess: false, inProject: true, isYou: false },
    { userId: "u3", name: "Rafael Costa", email: "rafael@exemplo.com", role: "viewer", allAccess: false, inProject: false, isYou: false },
  ],
  invitations: [{ id: "i1", email: "cliente@lojaaurora.com.br", role: "viewer", expiresAt: day(-5) }],
  seats: { used: 5, limit: 5 },
  actorRole: "owner",
  canManage: true,
};

const dash = (id: string, templateId: string, name: string, real: boolean): DashboardListItem => ({
  id,
  templateId,
  name,
  client: "Loja Aurora",
  pages: ["visao-geral", "campanhas", "funil"],
  settings: { ...DEFAULT_SETTINGS, goal: 12_000_000, budget: 3_000_000 },
  live: false,
  sources: real ? [{ id: "a1", name: "Loja Aurora · Vendas online", platformId: "meta", isEnabled: true }] : [],
  createdAt: day(30),
  updatedAt: day(1),
});

const withHeader = (node: React.ReactNode) => (
  <>
    <WorkspaceHeader summary={SUMMARY} orgName="Agência Exemplo" />
    {node}
  </>
);

export const SCREENS_WORKSPACE: Record<string, Screen> = {
  workspace: { path: `/painel/workspaces/${P1}`, node: () => withHeader(<Overview summary={SUMMARY} overview={OVERVIEW} highlights={<Highlights data={HIGHLIGHTS} projectId={P1} />} />) },
  "workspace-novo": {
    path: `/painel/workspaces/${P1}`,
    node: () =>
      withHeader(<Overview summary={{ ...SUMMARY, enabledAccounts: 0, accounts: 0, dashboards: 0, people: 2 }} overview={{ ...OVERVIEW, recent: [], platforms: [], openTasks: 0, dueTasks: 0, activeLinks: 0, team: OVERVIEW.team.slice(0, 2) }} highlights={<Highlights data={{ insights: [], spend: null, conversions: 0, currency: "BRL" }} projectId={P1} />} />),
  },
  "workspace-dashboards": {
    path: `/painel/workspaces/${P1}/dashboards`,
    node: (tier, role) =>
      withHeader(
        <DashboardsList
          items={[dash("d1", "vyz-ecommerce", "Loja Aurora · Vendas", true), dash("d4", "pulso-ecommerce", "Aurora · Black Friday", false)]}
          used={16}
          limit={ENTITLEMENTS[tier].maxDashboards}
          planLabel={TIER_LABEL[tier]}
          canEdit={role !== "viewer"}
          sources={[]}
          tier={tier}
          pagesTier={ENTITLEMENTS[tier].pages}
          hasProject
          brand={{ color: "#4B5320", logoUrl: null, canEdit: true }}
          workspaceName="Loja Aurora"
        />,
      ),
  },
  "workspace-contas": { path: `/painel/workspaces/${P1}/contas`, node: () => withHeader(<WorkspaceAccounts data={ACCOUNTS} projectId={P1} projectName="Loja Aurora" />) },
  "workspace-contas-vazio": { path: `/painel/workspaces/${P1}/contas`, node: () => withHeader(<WorkspaceAccounts data={{ ...ACCOUNTS, accounts: [] }} projectId={P1} projectName="Loja Aurora" />) },
  "workspace-pessoas": { path: `/painel/workspaces/${P1}/pessoas`, node: () => withHeader(<WorkspacePeople data={PEOPLE} projectId={P1} projectName="Loja Aurora" />) },
  "workspace-ajustes": { path: `/painel/workspaces/${P1}/ajustes`, node: () => withHeader(<WorkspaceSettings summary={SUMMARY} timeZone="America/Sao_Paulo" />) },
};
