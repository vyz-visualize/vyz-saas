// Assinaturas vendidas nas lojas (App Store / Google Play, via RevenueCat).
// Mesma regra do site: plano + período + quantidade de projetos (3 a 30 na loja).
// A loja não tem quantidade, então cada combinação é um produto. O último número
// é a quantidade de projetos (o id não muda: antes era de contas):
//   vyz_<plano>_<mensal|anual>_<projetos>   ex.: vyz_pro_anual_3
// Os preços saem de planMonthly (src/features/pricing/pricing.ts); a lista para
// cadastrar nas lojas sai de scripts/store/plan-products.ts.

export const STORE_PLAN_TIERS = ["base", "pro", "avancado"] as const;
export const STORE_PLAN_PERIODS = ["mensal", "anual"] as const;
export const STORE_MAX_ACCOUNTS = 30;
/** Projetos inclusos no plano: a loja vende a partir daqui. */
export const STORE_MIN_ACCOUNTS = 3;

export type StorePlanTier = (typeof STORE_PLAN_TIERS)[number];
export type StorePlanPeriod = (typeof STORE_PLAN_PERIODS)[number];
export type StorePlan = { tier: StorePlanTier; period: StorePlanPeriod; accounts: number };

export function storePlanProductId(p: StorePlan): string {
  return `vyz_${p.tier}_${p.period}_${p.accounts}`;
}

const PATTERN = /^vyz_(base|pro|avancado)_(mensal|anual)_([1-9]|[12][0-9]|30)$/;

/** Produto da loja → plano. Aceita o sufixo do Google Play ("produto:base-plan"). */
export function parseStorePlan(productId: string | null | undefined): StorePlan | null {
  const m = PATTERN.exec((productId ?? "").split(":")[0]);
  if (!m) return null;
  return { tier: m[1] as StorePlanTier, period: m[2] as StorePlanPeriod, accounts: Number(m[3]) };
}
