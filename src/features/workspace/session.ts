// Formato da sessão do workspace que o servidor entrega aos componentes
// (src/server/auth/workspace.ts monta; WorkspaceProvider distribui). Só tipos
// e funções puras: pode ser importado no navegador.

import type { Product } from "@/features/pricing/pricing";
import type { Entitlements, Tier } from "@/features/pricing/entitlements";

export type MemberRole = "viewer" | "member" | "admin" | "owner";

export const ROLE_RANK: Record<MemberRole, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
export const ROLE_LABEL: Record<MemberRole, string> = { viewer: "Leitura", member: "Editor", admin: "Admin", owner: "Dono" };

export const hasRole = (role: MemberRole, min: MemberRole) => ROLE_RANK[role] >= ROLE_RANK[min];

export type OnboardingStep = "business" | "platforms" | "connect" | "dashboard" | "done";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "unpaid" | "paused" | "incomplete" | "incomplete_expired" | "canceled";

export type WorkspaceAccess = {
  /** Assinatura ativa, em teste ou em atraso (carência). */
  hasAccess: boolean;
  tier: Tier | null;
  status: SubscriptionStatus | null;
  interval: "month" | "year" | null;
  /** Contas contratadas (limite de contas ativas). */
  accountsQuantity: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  entitlements: Entitlements | null;
};

export type WorkspaceUsage = {
  dashboards: number;
  landingPages: number;
  publishedLandingPages: number;
  enabledAdAccounts: number;
  /** Contas que contam no limite (cada BM do Meta conta uma vez). */
  billableAccounts: number;
  activeConnections: number;
  /** Projetos ativos (clientes ou marcas): é o que o plano limita. */
  projects: number;
};

export type WorkspaceSession = {
  user: { id: string; email: string; fullName: string; avatarUrl: string | null };
  workspace: {
    id: string;
    name: string;
    slug: string;
    businessTypeId: string | null;
    brandColor: string;
    brandLogoUrl: string | null;
    hideVyzBrand: boolean;
    onboardingStep: OnboardingStep;
    onboardingCompletedAt: string | null;
    timezone: string;
    currency: string;
    /** Lado da plataforma: dashboards ou landing pages. */
    product: Product;
  };
  role: MemberRole;
  access: WorkspaceAccess;
  usage: WorkspaceUsage;
  memberships: { id: string; name: string; role: MemberRole }[];
  /** Workspaces (clientes; na tabela, projetos) que a pessoa acessa, do mais antigo para o mais novo. */
  projects?: { id: string; name: string }[];
  /** Workspace aberto por último (cookie vyz-project), se a pessoa ainda acessa; null sem nenhum. */
  currentProjectId?: string | null;
};
