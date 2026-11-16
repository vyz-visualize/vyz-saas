// Assinaturas vendidas nas lojas (App Store / Google Play, via RevenueCat).
// Mesma regra do site: 3 planos fixos, cada um com o seu limite de workspaces
// (Básico até 3, Padrão até 5, Avançado "+5", com teto interno de 30), mensal ou anual.
// 6 produtos, com o número antigo no id (os produtos já estão cadastrados nas lojas):
//   vyz_<plano>_<mensal|anual>_ate<n>   ex.: vyz_pro_anual_ate15
// O número do id é só identificação: o limite concedido é o de STORE_PLAN_PROJECTS.
// Lista para cadastrar nas lojas: apps/mobile/store/pacotes-lojas.csv (sai de
// scripts/store/plan-products.ts). Os preços são os de STORE_PLAN_PRICE, iguais aos do site.

export const STORE_PLAN_TIERS = ["base", "pro", "avancado"] as const;
export const STORE_PLAN_PERIODS = ["mensal", "anual"] as const;

export type StorePlanTier = (typeof STORE_PLAN_TIERS)[number];
export type StorePlanPeriod = (typeof STORE_PLAN_PERIODS)[number];
/** accounts = limite de projetos do plano. */
export type StorePlan = { tier: StorePlanTier; period: StorePlanPeriod; accounts: number };

/** Workspaces de cada plano (o mesmo PLAN_PROJECTS do site). */
export const STORE_PLAN_PROJECTS: Record<StorePlanTier, number> = { base: 3, pro: 5, avancado: 30 };

/** Número no id do produto nas lojas (o limite antigo; não muda para não recriar os produtos). */
export const STORE_PLAN_ID_SUFFIX: Record<StorePlanTier, number> = { base: 5, pro: 15, avancado: 30 };

/** Preço de cada plano, em centavos, por cobrança (mês no mensal, ano no anual). */
export const STORE_PLAN_PRICE: Record<StorePlanTier, Record<StorePlanPeriod, number>> = {
  base: { mensal: 5990, anual: 57900 },
  pro: { mensal: 21990, anual: 219900 },
  avancado: { mensal: 49990, anual: 489900 },
};

export const storePlan = (tier: StorePlanTier, period: StorePlanPeriod): StorePlan => ({ tier, period, accounts: STORE_PLAN_PROJECTS[tier] });

export function storePlanProductId(p: Pick<StorePlan, "tier" | "period">): string {
  return `vyz_${p.tier}_${p.period}_ate${STORE_PLAN_ID_SUFFIX[p.tier]}`;
}

const PATTERN = /^vyz_(base|pro|avancado)_(mensal|anual)_ate(\d+)$/;

/** Produto da loja → plano. Aceita o sufixo do Google Play ("produto:base-plan"). */
export function parseStorePlan(productId: string | null | undefined): StorePlan | null {
  const m = PATTERN.exec((productId ?? "").split(":")[0]);
  if (!m) return null;
  const tier = m[1] as StorePlanTier;
  if (Number(m[3]) !== STORE_PLAN_ID_SUFFIX[tier]) return null;
  return storePlan(tier, m[2] as StorePlanPeriod);
}

/** O que cada plano traz (paywall do app). Mesma regra do site; cada plano inclui o de baixo. */
export const STORE_PLAN_HIGHLIGHTS: Record<StorePlanTier, string[]> = {
  base: ["Até 3 workspaces (clientes)", "Meta Ads, Google Ads e GA4", "Visão geral com tudo junto", "Assistente VYZ por chat", "1 usuário"],
  pro: ["Até 5 workspaces (clientes), compartilhados entre os usuários", "Tudo do Básico", "TikTok Ads e LinkedIn Ads", "CRMs: RD Station e HubSpot", "Galeria de criativos", "2 usuários"],
  avancado: [
    "+5 workspaces (clientes)",
    "Tudo do Padrão",
    "Mais de 5 modelos de dashboard",
    "X Ads, Spotify Ads, Globo Ads, ChatGPT Ads e mais",
    "Comparativo de criativos",
    "Análise preditiva e MMM",
    "Assistente VYZ por voz",
    "5 usuários",
  ],
};
