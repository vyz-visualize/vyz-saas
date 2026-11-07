// Interruptores do produto (site e painel usam os mesmos).

import type { Product } from "@/features/pricing/pricing";

/**
 * Landing pages à venda e no painel de dashboards. false = o site só vende
 * dashboards e o painel mostra a página "em breve" com a lista de espera; o
 * módulo continua no código e o banco não muda.
 */
export const SHOW_LANDING_PAGES = false;

/** Workspaces do produto LP já pagaram pelo módulo: seguem com ele mesmo com a flag desligada. */
export const landingPagesEnabledFor = (product: Product, flag: boolean = SHOW_LANDING_PAGES) => flag || product === "lp";

/**
 * Cobrança de verdade ligada. false = o site avisa "Simulação · não é cobrança"
 * (rodapé). Virar para true no dia em que o checkout cobrar.
 */
export const BILLING_LIVE = false;

