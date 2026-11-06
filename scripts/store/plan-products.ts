// Lista dos produtos de assinatura para cadastrar nas lojas e no RevenueCat
// (3 planos fixos × mensal/anual). Mudou preço? Muda em
// packages/shared/src/store-plans.ts e rode de novo.
//
//   npx tsx scripts/store/plan-products.ts > apps/mobile/store/pacotes-lojas.csv

import { STORE_PLAN_PERIODS, STORE_PLAN_PRICE, STORE_PLAN_PROJECTS, STORE_PLAN_TIERS, storePlanProductId } from "@vyz/shared";

const LABEL = { base: "Básico", pro: "Padrão", avancado: "Avançado" } as const;

const rows = ["product_id,nome,plano,periodo,ate_projetos,preco_brl"];
for (const tier of STORE_PLAN_TIERS) {
  for (const period of STORE_PLAN_PERIODS) {
    const projects = STORE_PLAN_PROJECTS[tier];
    rows.push([storePlanProductId({ tier, period }), `"${LABEL[tier]} · até ${projects} projetos"`, tier, period, projects, (STORE_PLAN_PRICE[tier][period] / 100).toFixed(2)].join(","));
  }
}
console.log(rows.join("\n"));
