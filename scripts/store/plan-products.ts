// Lista dos produtos de assinatura para cadastrar nas lojas e no RevenueCat,
// com o preço do site (planMonthly). Mudou preço no site? Rode de novo e
// atualize as lojas.
//
//   npx tsx scripts/store/plan-products.ts > planos-lojas.csv

import { STORE_MAX_ACCOUNTS, STORE_MIN_ACCOUNTS, STORE_PLAN_PERIODS, STORE_PLAN_TIERS, storePlanProductId } from "@vyz/shared";
import { PLAN_LABEL, planMonthly } from "@/features/pricing/pricing";

const rows = ["product_id,nome,periodo,projetos,preco_brl"];
for (const tier of STORE_PLAN_TIERS) {
  for (const period of STORE_PLAN_PERIODS) {
    for (let accounts = STORE_MIN_ACCOUNTS; accounts <= STORE_MAX_ACCOUNTS; accounts++) {
      const cents = planMonthly(tier, period, accounts) * (period === "anual" ? 12 : 1);
      const name = `VYZ ${PLAN_LABEL[tier]} · ${accounts} projetos`;
      rows.push([storePlanProductId({ tier, period, accounts }), `"${name}"`, period, accounts, (cents / 100).toFixed(2)].join(","));
    }
  }
}
console.log(rows.join("\n"));
