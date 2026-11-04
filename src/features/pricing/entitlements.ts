// Limites por plano. A LP (cartões de planos) e o painel (bloqueios) usam as
// mesmas funções daqui.

import { LANDING_TEMPLATES } from "@/features/templates/landing-pages";
import { ALL_DASHBOARD_TEMPLATES } from "@/features/templates/live";

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
  /** "core" = Meta, Google Ads e GA4. */
  platforms: "core" | "all";
  /** Páginas do dashboard liberadas até este nível. */
  pages: Tier;
  whiteLabel: boolean;
  audio: "none" | "soon";
  customDashboards: boolean;
  /** Assistente VYZ no painel: chat por texto. */
  agentChat: boolean;
  /** Assistente VYZ por voz: microfone e leitura em voz alta. */
  agentVoice: boolean;
  // Quantidades (provisórias, ver docs/PENDENCIAS.md)
  maxDashboards: number;
  maxLandingPages: number;
  /** Pessoas com acesso ao workspace (membros; convites pendentes também contam). */
  maxMembers: number;
};

// Quantos templates cada plano libera: contados no catálogo (src/features/templates),
// então template novo já aparece nos números dos planos.
const RANK_OF = (t: Tier) => ({ base: 0, pro: 1, avancado: 2, personalizado: 3 })[t];
const dashCount = (t: Tier) => ALL_DASHBOARD_TEMPLATES.filter((x) => RANK_OF(x.tier) <= RANK_OF(t)).length;
const lpCount = (t: Tier) => LANDING_TEMPLATES.filter((x) => RANK_OF(x.tier) <= RANK_OF(t)).length;

export const ENTITLEMENTS: Record<Tier, Entitlements> = {
  base: { dashboardTemplates: dashCount("base"), landingTemplates: lpCount("base"), platforms: "core", pages: "base", whiteLabel: false, audio: "none", customDashboards: false, agentChat: true, agentVoice: false, maxDashboards: 2, maxLandingPages: 1, maxMembers: 1 },
  pro: { dashboardTemplates: dashCount("pro"), landingTemplates: lpCount("pro"), platforms: "all", pages: "pro", whiteLabel: false, audio: "none", customDashboards: false, agentChat: true, agentVoice: false, maxDashboards: 10, maxLandingPages: 3, maxMembers: 2 },
  avancado: { dashboardTemplates: dashCount("avancado"), landingTemplates: lpCount("avancado"), platforms: "all", pages: "avancado", whiteLabel: false, audio: "soon", customDashboards: false, agentChat: true, agentVoice: true, maxDashboards: 20, maxLandingPages: 10, maxMembers: 5 },
  personalizado: { dashboardTemplates: dashCount("personalizado"), landingTemplates: lpCount("personalizado"), platforms: "all", pages: "avancado", whiteLabel: true, audio: "soon", customDashboards: true, agentChat: true, agentVoice: true, maxDashboards: 50, maxLandingPages: 10, maxMembers: 10 },
};

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
  return `${e.dashboardTemplates} templates de dashboard · ${e.landingTemplates} de landing page`;
}

/** Próximo plano acima (para o botão de upgrade). */
export function nextTier(tier: Tier): Tier | null {
  const i = TIERS.indexOf(tier);
  return i < TIERS.length - 1 ? TIERS[i + 1] : null;
}

/** Linhas da tabela de limites (página Plano e documentação). */
export const LIMIT_ROWS: { label: string; value: (t: Tier) => string }[] = [
  { label: "Templates de dashboard", value: (t) => (t === "personalizado" ? `${ENTITLEMENTS[t].dashboardTemplates} + sob medida` : String(ENTITLEMENTS[t].dashboardTemplates)) },
  { label: "Templates de landing page", value: (t) => String(ENTITLEMENTS[t].landingTemplates) },
  { label: "Plataformas", value: (t) => (ENTITLEMENTS[t].platforms === "core" ? "Meta e Google por login; GA4 em breve" : "Meta e Google por login; GA4 e mais plataformas em breve") },
  {
    label: "Páginas do dashboard",
    value: (t) => ({ base: "essenciais", pro: "+ Pro", avancado: "todas", personalizado: "todas" })[t],
  },
  { label: "Marca própria (white-label)", value: (t) => (ENTITLEMENTS[t].whiteLabel ? "sim" : "não") },
  { label: "Análise por áudio", value: (t) => (ENTITLEMENTS[t].audio === "soon" ? "em breve" : "não") },
  { label: "Assistente VYZ", value: (t) => (ENTITLEMENTS[t].agentVoice ? "chat + voz" : ENTITLEMENTS[t].agentChat ? "chat" : "não") },
  { label: "Dashboards", value: (t) => String(ENTITLEMENTS[t].maxDashboards) },
  { label: "Landing pages publicadas", value: (t) => String(ENTITLEMENTS[t].maxLandingPages) },
  { label: "Usuários", value: (t) => String(ENTITLEMENTS[t].maxMembers) },
];
