// Limites por plano. A LP (cartões de planos) e o painel (bloqueios) usam as
// mesmas funções daqui.

import { PLAN_PROJECTS, type PlanId } from "@/features/pricing/pricing";
import { LANDING_TEMPLATES } from "@/features/templates/landing-pages";
import { VISUALS } from "@/features/templates/dashboards/composed";
import { SHOW_LANDING_PAGES } from "@/lib/flags";

export type Tier = "base" | "pro" | "avancado" | "personalizado";

export const TIERS: Tier[] = ["base", "pro", "avancado", "personalizado"];

export const TIER_LABEL: Record<Tier, string> = {
  base: "Básico",
  pro: "Padrão",
  avancado: "Avançado",
  personalizado: "Personalizado",
};

const RANK: Record<Tier, number> = { base: 0, pro: 1, avancado: 2, personalizado: 3 };

export type Entitlements = {
  dashboardTemplates: number;
  landingTemplates: number;
  /** "all" em todos os planos de dashboards (sem restrição de plataforma); "core" só nas LPs, que não conectam contas. */
  platforms: "core" | "all";
  /** Páginas do dashboard liberadas até este nível. */
  pages: Tier;
  whiteLabel: boolean;
  audio: "none" | "soon";
  customDashboards: boolean;
  /** Página de Criativos: lista, galeria com preview, ou galeria + comparativo. */
  creatives: "list" | "gallery" | "compare";
  /** Assistente VYZ no painel: chat por texto. */
  agentChat: boolean;
  /** Assistente VYZ por voz: microfone e leitura em voz alta. */
  agentVoice: boolean;
  /** A Fazer: "basic" = tarefas automáticas, status e prioridade; "full" = + responsáveis, cronograma, grupos e playbooks. */
  todo: "basic" | "full";
  /** Relatórios pelo WhatsApp da VYZ (boas-vindas, diário, semanal, alertas, à escolha do cliente). */
  whatsappReports: boolean;
  /** Otimizações automáticas nas plataformas (com limites por projeto). Aplicar com aprovação vale para todos. */
  autoOptimize: boolean;
  // Quantidades (ver docs/PENDENCIAS.md)
  maxDashboards: number;
  maxLandingPages: number;
  /** Pessoas com acesso ao workspace (membros; convites pendentes também contam). UNLIMITED_MEMBERS = ilimitado. */
  maxMembers: number;
  /** Contas da mesma plataforma em cada projeto (ex.: 3 contas de Meta Ads no mesmo cliente). */
  maxAccountsPerPlatform: number;
};

// Quantos visuais de dashboard cada plano libera (os modelos oferecidos: visual + objetivo
// + contas, em templates/dashboards/composed). Os modelos antigos não são mais oferecidos.
const RANK_OF = (t: Tier) => ({ base: 0, pro: 1, avancado: 2, personalizado: 3 })[t];
const dashCount = (t: Tier) => VISUALS.filter((x) => RANK_OF(x.tier) <= RANK_OF(t)).length;
const lpCount = (t: Tier) => LANDING_TEMPLATES.filter((x) => RANK_OF(x.tier) <= RANK_OF(t)).length;

/**
 * Usuários dos planos sem limite (Padrão, Avançado e Personalizado). O banco grava este
 * número em plan_entitlements.max_members (o trigger guard_member_limit confere um número);
 * na tela ele nunca aparece: vale "usuários ilimitados" (membersLabel, unlimitedMembers).
 */
export const UNLIMITED_MEMBERS = 1000;

export const ENTITLEMENTS: Record<Tier, Entitlements> = {
  base: { dashboardTemplates: dashCount("base"), landingTemplates: lpCount("base"), platforms: "all", pages: "base", creatives: "list", whiteLabel: false, audio: "none", customDashboards: false, agentChat: true, agentVoice: false, todo: "basic", whatsappReports: false, autoOptimize: false, maxDashboards: 3, maxLandingPages: 1, maxMembers: 1, maxAccountsPerPlatform: 1 },
  pro: { dashboardTemplates: dashCount("pro"), landingTemplates: lpCount("pro"), platforms: "all", pages: "pro", creatives: "gallery", whiteLabel: false, audio: "none", customDashboards: false, agentChat: true, agentVoice: false, todo: "basic", whatsappReports: false, autoOptimize: false, maxDashboards: 10, maxLandingPages: 3, maxMembers: UNLIMITED_MEMBERS, maxAccountsPerPlatform: 3 },
  avancado: { dashboardTemplates: dashCount("avancado"), landingTemplates: lpCount("avancado"), platforms: "all", pages: "avancado", creatives: "compare", whiteLabel: false, audio: "soon", customDashboards: false, agentChat: true, agentVoice: true, todo: "full", whatsappReports: true, autoOptimize: true, maxDashboards: 40, maxLandingPages: 10, maxMembers: UNLIMITED_MEMBERS, maxAccountsPerPlatform: 3 },
  personalizado: { dashboardTemplates: dashCount("personalizado"), landingTemplates: lpCount("personalizado"), platforms: "all", pages: "avancado", creatives: "compare", whiteLabel: true, audio: "soon", customDashboards: true, agentChat: true, agentVoice: true, todo: "full", whatsappReports: true, autoOptimize: true, maxDashboards: 100, maxLandingPages: 10, maxMembers: UNLIMITED_MEMBERS, maxAccountsPerPlatform: 10 },
};

/** O que a página de Criativos mostra neste plano (sem plano: só a lista). */
export const creativesLevel = (tier: Tier | null | undefined): Entitlements["creatives"] => (tier ? ENTITLEMENTS[tier].creatives : "list");

/** Workspaces ilimitados (Avançado e Personalizado): o painel mostra só o uso, sem total. */
export const unlimitedProjects = (tier: Tier | null | undefined): boolean => tier === "avancado" || tier === "personalizado";

/** Usuários ilimitados (Padrão, Avançado e Personalizado): o painel mostra só o uso, sem total. */
export const unlimitedMembers = (tier: Tier | null | undefined): boolean => !!tier && ENTITLEMENTS[tier].maxMembers >= UNLIMITED_MEMBERS;

/** O limite de usuários lido do banco (max_members) é o "ilimitado"? */
export const isUnlimitedMemberLimit = (limit: number | null | undefined): boolean => limit == null || limit >= UNLIMITED_MEMBERS;

/** Como o limite de usuários aparece na tela: "1 usuário"; nos outros planos, "usuários ilimitados". */
export function membersLabel(tier: Tier, opts: { capital?: boolean } = {}): string {
  const n = ENTITLEMENTS[tier].maxMembers;
  const text = unlimitedMembers(tier) ? "usuários ilimitados" : `${n} ${n === 1 ? "usuário" : "usuários"}`;
  return opts.capital ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Limite de workspaces sem número (planos ilimitados: só acima de 200, o máximo que a assinatura grava). */
export const PROJECT_LIMIT_HIDDEN_MESSAGE = "Você chegou ao limite do seu plano. Fale com a gente para ampliar.";

/** O plano `tier` cobre o que exige `required`? */
export function canUse(tier: Tier, required: Tier): boolean {
  return RANK[tier] >= RANK[required];
}

/** Rótulo do bloqueio: "Disponível no Pro". */
export function availableIn(required: Tier): string {
  return `Disponível no ${TIER_LABEL[required]}`;
}

/** "5 templates de dashboard · 3 de landing page" (cartões da LP). */
export function templateCountsLabel(tier: Tier): string {
  const e = ENTITLEMENTS[tier];
  return `${e.dashboardTemplates} visuais de dashboard · ${e.landingTemplates} de landing page`;
}

/** Colunas da tabela de limites: o Personalizado é sob consulta e fica fora dela. */
export const LIMIT_TIERS: Tier[] = ["base", "pro", "avancado"];

/** Linhas da tabela de limites (página Plano e documentação). */
export const LIMIT_ROWS: { label: string; value: (t: Tier) => string }[] = [
  { label: "Workspaces", value: (t) => (unlimitedProjects(t) ? "ilimitados" : `até ${PLAN_PROJECTS[t as PlanId]}`) },
  { label: "Templates de dashboard", value: (t) => String(ENTITLEMENTS[t].dashboardTemplates) },
  ...(SHOW_LANDING_PAGES ? [{ label: "Templates de landing page", value: (t: Tier) => String(ENTITLEMENTS[t].landingTemplates) }] : []),
  // sem restrição: todas em todos os planos (as que ainda não estão prontas entram quando ficarem)
  { label: "Plataformas", value: () => "todas" },
  {
    label: "Páginas do dashboard",
    value: (t) => ({ base: "essenciais", pro: "+ Padrão", avancado: "todas", personalizado: "todas" })[t],
  },
  {
    label: "Criativos",
    value: (t) => ({ list: "lista", gallery: "galeria com preview", compare: "galeria + comparativo" })[ENTITLEMENTS[t].creatives],
  },
  { label: "Assistente VYZ", value: (t) => (ENTITLEMENTS[t].agentVoice ? "chat + voz" : "chat") },
  { label: "Integre com sua IA (MCP)", value: (t) => (t === "base" ? "—" : "em breve") },
  { label: "Contas por plataforma em cada workspace", value: (t) => String(ENTITLEMENTS[t].maxAccountsPerPlatform) },
  { label: "Dashboards", value: (t) => String(ENTITLEMENTS[t].maxDashboards) },
  ...(SHOW_LANDING_PAGES ? [{ label: "Landing pages publicadas", value: (t: Tier) => String(ENTITLEMENTS[t].maxLandingPages) }] : []),
  { label: "Usuários", value: (t) => (unlimitedMembers(t) ? "ilimitados" : String(ENTITLEMENTS[t].maxMembers)) },
];
