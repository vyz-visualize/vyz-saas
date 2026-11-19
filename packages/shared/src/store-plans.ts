// Assinaturas vendidas nas lojas (App Store / Google Play, via RevenueCat).
// Mesma regra do site: 3 planos fixos, cada um com o seu limite de workspaces
// (Básico até 3, Padrão até 5, Avançado ilimitado: grava 200, que o banco não confere).
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
export const STORE_PLAN_PROJECTS: Record<StorePlanTier, number> = { base: 3, pro: 5, avancado: 200 };

/** Número no id do produto nas lojas (o limite antigo; não muda para não recriar os produtos). */
export const STORE_PLAN_ID_SUFFIX: Record<StorePlanTier, number> = { base: 5, pro: 15, avancado: 30 };

/** Preço de cada plano, em centavos, por cobrança (mês no mensal, ano no anual). */
export const STORE_PLAN_PRICE: Record<StorePlanTier, Record<StorePlanPeriod, number>> = {
  base: { mensal: 4990, anual: 49990 }, // R$ 49,90/mês ou R$ 499,90/ano
  pro: { mensal: 14990, anual: 149990 }, // R$ 149,90/mês ou R$ 1.499,90/ano
  avancado: { mensal: 29990, anual: 299990 }, // R$ 299,90/mês ou R$ 2.999,90/ano
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
  base: ["Até 3 workspaces (clientes)", "Todas as plataformas: Meta Ads, Instagram, Facebook, Google Ads e GA4", "Visão geral com tudo junto", "Assistente VYZ por chat", "1 usuário"],
  pro: ["Até 5 workspaces (clientes), compartilhados entre os usuários", "Tudo do Básico", "Até 3 contas por plataforma em cada workspace", "Galeria de criativos", "Usuários ilimitados"],
  avancado: [
    "Workspaces ilimitados (clientes)",
    "Tudo do Padrão",
    "+5 visuais de dashboard",
    "Comparativo de criativos",
    "Análise preditiva e MMM",
    "Assistente VYZ por voz",
    "Usuários ilimitados",
  ],
};
