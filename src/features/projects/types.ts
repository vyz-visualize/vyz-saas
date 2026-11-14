// Workspace = cliente ou marca (na tabela, projeto): agrupa as contas (Meta, Google Ads, GA4...),
// os dashboards e as pessoas dele. O plano cobra e limita por workspace (accounts_quantity).

import type { DashboardListItem, SourceOption } from "@/features/dashboards/model";
import type { Tier } from "@/features/pricing/entitlements";
import type { AdAccountDTO, ConnectionDTO } from "@/features/integrations/types";
import type { ProviderId } from "@/features/integrations/providers";
import type { Insight } from "@/features/insights/insights";

export type ProjectDTO = {
  id: string;
  name: string;
  createdAt: string;
  /** Identidade (cor #rrggbb e logo); sem elas, as iniciais na cor padrão. */
  color?: string | null;
  logoUrl?: string | null;
  /** Contas ligadas no projeto. */
  enabledAccounts: number;
  dashboards: number;
};

export type ProjectsState = {
  projects: ProjectDTO[];
  /** Projetos contratados no plano. */
  quantity: number;
  /** Contas da mesma plataforma em cada projeto. */
  maxAccountsPerPlatform: number;
  /** Member cria e renomeia; admin arquiva. */
  canEdit: boolean;
  canArchive: boolean;
};

/** Pessoa da organização vista de dentro de um workspace. */
export type ProjectPerson = {
  userId: string;
  name: string;
  email: string;
  role: "viewer" | "member" | "admin" | "owner";
  /** Dono e admin acessam todos os workspaces (não dá para tirar daqui). */
  allAccess: boolean;
  /** Member/viewer que está neste workspace. */
  inProject: boolean;
  isYou: boolean;
};

/** Cabeçalho do workspace (vale para todas as abas). */
export type ProjectSummary = {
  id: string;
  name: string;
  createdAt: string;
  color?: string | null;
  logoUrl?: string | null;
  enabledAccounts: number;
  accounts: number;
  dashboards: number;
  /** Quem acessa: dono e admins da organização e quem está no workspace. */
  people: number;
  canEdit: boolean;
  canManage: boolean;
};

/** Aba Pessoas. */
export type ProjectPeopleData = {
  people: ProjectPerson[];
  /** Convites pendentes que já incluem este workspace (só admin vê). */
  invitations: { id: string; email: string; role: "viewer" | "member" | "admin"; expiresAt: string }[];
  /** Vagas de usuário do plano (membros + convites pendentes contam). */
  seats: { used: number; limit: number };
  /** Papel de quem está vendo (para saber o que pode mudar). */
  actorRole: ProjectPerson["role"];
  canManage: boolean;
};

/** Aba Contas: as contas deste workspace, as que dá para trazer de outros e os logins. */
export type ProjectAccountsData = {
  accounts: AdAccountDTO[];
  /** Contas vistas pelos logins que não estão neste workspace (sem workspace ou em outro). */
  candidates: (AdAccountDTO & { projectName: string | null })[];
  connections: ConnectionDTO[];
  /** Logins disponíveis (com credencial no servidor ou já conectados). */
  providers: ProviderId[];
  /** Os outros workspaces (para mover uma conta). */
  projects: { id: string; name: string }[];
  maxAccountsPerPlatform: number;
  canManage: boolean;
  canSync: boolean;
  mock: boolean;
  now: string;
  timeZone: string;
};

/** Aba Dashboards. */
export type ProjectDashboardsData = {
  items: DashboardListItem[];
  /** Só as contas deste workspace (um dashboard novo nasce com elas). */
  sources: SourceOption[];
  /** Limite e uso do plano: dashboards contam na organização inteira. */
  limit: number;
  used: number;
  planLabel: string;
  tier: Tier;
  pagesTier: Tier;
  canEdit: boolean;
  brand: { color: string; logoUrl: string | null; canEdit: boolean };
};

/** Visão geral do workspace. */
export type ProjectOverviewData = {
  now: string;
  recent: { id: string; name: string; templateId: string; updatedAt: string }[];
  /** Saúde das contas, por plataforma. */
  platforms: { platformId: string; enabled: number; total: number; failing: number; lastSyncedAt: string | null }[];
  team: { userId: string; name: string; role: ProjectPerson["role"] }[];
  openTasks: number;
  dueTasks: number;
  activeLinks: number;
};

/** Destaques da semana (calculados dos dashboards com dados reais deste workspace). */
export type ProjectHighlights = { insights: Insight[]; spend: number | null; conversions: number; currency: string };
