// Itens de cobrança fora do plano e ids de preço, compartilhados pelo checkout
// (src/server/billing) e pelo catálogo do banco (npm run db:catalog).

import { DASH_CUSTOM, DASH_EXTRA_PRICE, LP_CARE_MONTHLY, LP_TEAM_PRICE, type Period, type PlanId } from "./pricing";

export type BillingItemId = "lp_team" | "lp_care" | "dash_custom_once" | "dash_custom_setup" | "dash_custom_monthly" | "dash_extra";

export type BillingItem = { id: BillingItemId; name: string; kind: "one_time" | "recurring"; unitCents: number };

export const BILLING_ITEMS: Record<BillingItemId, BillingItem> = {
  lp_team: { id: "lp_team", name: "Landing page feita pelo time", kind: "one_time", unitCents: LP_TEAM_PRICE },
  lp_care: { id: "lp_care", name: "Hospedagem e ajustes da landing page", kind: "recurring", unitCents: LP_CARE_MONTHLY },
  dash_custom_once: { id: "dash_custom_once", name: "Dashboard sob medida", kind: "one_time", unitCents: DASH_CUSTOM.unico },
  dash_custom_setup: { id: "dash_custom_setup", name: "Dashboard sob medida · setup", kind: "one_time", unitCents: DASH_CUSTOM.recorrente.setup },
  dash_custom_monthly: { id: "dash_custom_monthly", name: "Dashboard sob medida · mensal", kind: "recurring", unitCents: DASH_CUSTOM.recorrente.mensal },
  dash_extra: { id: "dash_extra", name: "Dashboard adicional", kind: "one_time", unitCents: DASH_EXTRA_PRICE },
};

/** Período da LP ("mensal" | "anual") → intervalo da cobrança. */
export const INTERVAL: Record<Period, "month" | "year"> = { mensal: "month", anual: "year" };

/** Id do preço no catálogo: "pro_year". */
export const planPriceId = (plan: PlanId, period: Period) => `${plan}_${INTERVAL[period]}`;
