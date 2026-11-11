// Limites por plano. A LP (cartões de planos) e o painel (bloqueios) usam as
// mesmas funções daqui.

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
  /** "core" = Meta, Google Ads e GA4. */
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
  // Quantidades (provisórias, ver docs/PENDENCIAS.md)
  maxDashboards: number;
  maxLandingPages: number;
  /** Pessoas com acesso ao workspace (membros; convites pendentes também contam). */
  maxMembers: number;
  /** Contas da mesma plataforma em cada projeto (ex.: 3 contas de Meta Ads no mesmo cliente). */
  maxAccountsPerPlatform: number;
};

// Quantos visuais de dashboard cada plano libera (os modelos oferecidos: visual + objetivo
// + contas, em templates/dashboards/composed). Os modelos antigos não são mais oferecidos.
const RANK_OF = (t: Tier) => ({ base: 0, pro: 1, avancado: 2, personalizado: 3 })[t];
const dashCount = (t: Tier) => VISUALS.filter((x) => RANK_OF(x.tier) <= RANK_OF(t)).length;
const lpCount = (t: Tier) => LANDING_TEMPLATES.filter((x) => RANK_OF(x.tier) <= RANK_OF(t)).length;

export const ENTITLEMENTS: Record<Tier, Entitlements> = {
  base: { dashboardTemplates: dashCount("base"), landingTemplates: lpCount("base"), platforms: "core", pages: "base", creatives: "list", whiteLabel: false, audio: "none", customDashboards: false, agentChat: true, agentVoice: false, todo: "basic", whatsappReports: false, autoOptimize: false, maxDashboards: 2, maxLandingPages: 1, maxMembers: 1, maxAccountsPerPlatform: 1 },
  pro: { dashboardTemplates: dashCount("pro"), landingTemplates: lpCount("pro"), platforms: "all", pages: "pro", creatives: "gallery", whiteLabel: false, audio: "none", customDashboards: false, agentChat: true, agentVoice: false, todo: "basic", whatsappReports: false, autoOptimize: false, maxDashboards: 10, maxLandingPages: 3, maxMembers: 2, maxAccountsPerPlatform: 3 },
  avancado: { dashboardTemplates: dashCount("avancado"), landingTemplates: lpCount("avancado"), platforms: "all", pages: "avancado", creatives: "compare", whiteLabel: false, audio: "soon", customDashboards: false, agentChat: true, agentVoice: true, todo: "full", whatsappReports: true, autoOptimize: true, maxDashboards: 20, maxLandingPages: 10, maxMembers: 5, maxAccountsPerPlatform: 3 },
  personalizado: { dashboardTemplates: dashCount("personalizado"), landingTemplates: lpCount("personalizado"), platforms: "all", pages: "avancado", creatives: "compare", whiteLabel: true, audio: "soon", customDashboards: true, agentChat: true, agentVoice: true, todo: "full", whatsappReports: true, autoOptimize: true, maxDashboards: 50, maxLandingPages: 10, maxMembers: 10, maxAccountsPerPlatform: 10 },
};

/** O que a página de Criativos mostra neste plano (sem plano: só a lista). */
export const creativesLevel = (tier: Tier | null | undefined): Entitlements["creatives"] => (tier ? ENTITLEMENTS[tier].creatives : "list");

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

/** Próximo plano acima (para o botão de upgrade). */
export function nextTier(tier: Tier): Tier | null {
  const i = TIERS.indexOf(tier);
  return i < TIERS.length - 1 ? TIERS[i + 1] : null;
}

/** Colunas da tabela de limites: o Personalizado é sob consulta e fica fora dela. */
export const LIMIT_TIERS: Tier[] = ["base", "pro", "avancado"];

/** Linhas da tabela de limites (página Plano e documentação). */
export const LIMIT_ROWS: { label: string; value: (t: Tier) => string }[] = [
  { label: "Projetos", value: (t) => ({ base: "até 5", pro: "até 15", avancado: "até 30", personalizado: "sob consulta" })[t] },
  { label: "Templates de dashboard", value: (t) => String(ENTITLEMENTS[t].dashboardTemplates) },
  ...(SHOW_LANDING_PAGES ? [{ label: "Templates de landing page", value: (t: Tier) => String(ENTITLEMENTS[t].landingTemplates) }] : []),
  {
    label: "Plataformas",
    value: (t) =>
      ({
        base: "Meta Ads, Google Ads e GA4",
        pro: "+ TikTok, LinkedIn, RD Station e HubSpot",
        avancado: "todas: + X, Spotify, Globo, ChatGPT, YouTube, Shopee e Mercado (em breve)",
        personalizado: "todas",
      })[t],
  },
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
  { label: "Contas por plataforma em cada projeto", value: (t) => String(ENTITLEMENTS[t].maxAccountsPerPlatform) },
  { label: "Dashboards", value: (t) => String(ENTITLEMENTS[t].maxDashboards) },
  ...(SHOW_LANDING_PAGES ? [{ label: "Landing pages publicadas", value: (t: Tier) => String(ENTITLEMENTS[t].maxLandingPages) }] : []),
  { label: "Usuários", value: (t) => String(ENTITLEMENTS[t].maxMembers) },
];
