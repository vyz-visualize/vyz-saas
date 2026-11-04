// Pedido do checkout: a seleção da LP (PlanState) vira as linhas de cobrança
// (checkout_items) e os valores da primeira cobrança e da recorrência. O
// servidor recalcula tudo daqui; o navegador nunca manda preço.

import { BILLING_ITEMS, INTERVAL, planPriceId, type BillingItemId } from "@/features/pricing/catalog";
import { DEFAULT_STATE, LP_PLAN_PAGES, PLAN_LABEL, lpMonthly, planDbId, quote, type Period, type PlanId, type PlanState, type Product, type Quote } from "@/features/pricing/pricing";

export type OrderItem = {
  kind: "recurring" | "one_time";
  /** Só no item do plano ("pro_year"). */
  planPriceId?: string;
  /** Extras (catálogo em src/features/pricing/catalog.ts). */
  billingItemId?: BillingItemId;
  quantity: number;
  /** Valor da linha em centavos: por mês (recurring) ou total (one_time). */
  amountCents: number;
  label: string;
};

/** Por que o pedido não pode ser pago no checkout. */
export type OrderBlock = "over_limit" | "recurring_without_plan" | "empty";

export type Order = {
  product: Product;
  /** Tier escolhido (base/pro/avancado), igual nos dois produtos. */
  planId: PlanId | null;
  /** Id do plano no banco ("pro" ou "lp_pro"). */
  planDbId: string | null;
  period: Period;
  interval: "month" | "year";
  /** Projetos contratados (0 sem plano). Coluna accounts_quantity no banco. */
  accountsQuantity: number;
  items: OrderItem[];
  /** Primeira cobrança: o período (mês ou ano) + os itens únicos. */
  amountDueNowCents: number;
  /** Cobrança recorrente, por período (mês ou ano). */
  recurringCents: number;
  quote: Quote;
  blocked?: OrderBlock;
};

export const BLOCK_MESSAGE: Record<OrderBlock, string> = {
  over_limit: "Acima de 200 projetos, o plano é montado com um especialista.",
  recurring_without_plan: "Itens mensais (hospedagem das LPs ou dashboard sob medida mensal) precisam de um plano.",
  empty: "Escolha um plano ou um extra para assinar.",
};

/**
 * Estado completo e coerente a partir da query da LP (fromQuery): sem plano
 * não há contas nem dashboard adicional, e hospedagem só com LP.
 */
export function normalizeState(patch: Partial<PlanState> | null | undefined): PlanState {
  const s: PlanState = { ...DEFAULT_STATE, ...patch };
  // landing pages: só o pacote do plano, mensal, sem contas nem extras
  if (s.produto === "lp") {
    if (s.plano === "sem") s.plano = DEFAULT_STATE.plano;
    return { ...DEFAULT_STATE, produto: "lp", plano: s.plano, periodo: "mensal", plataformas: 0, nicho: s.nicho };
  }
  if (s.plano === "sem") Object.assign(s, { plataformas: 0, dash: 0 });
  // só o Básico compra plataforma à parte: Padrão e Avançado já têm todas
  if (s.plano !== "base") s.plataformas = 0;
  if (s.lp === 0) s.lpcare = false;
  return s;
}

export function planItemLabel(plan: PlanId, projects: number): string {
  return `Plano ${PLAN_LABEL[plan]} · ${projects} ${projects === 1 ? "projeto" : "projetos"}`;
}

export function buildOrder(state: PlanState): Order {
  if (state.produto === "lp") return buildLpOrder(state);
  const q = quote(state);
  const planId = state.plano === "sem" ? null : state.plano;
  const items: OrderItem[] = [];

  if (planId) {
    items.push({
      kind: "recurring",
      planPriceId: planPriceId(planId, state.periodo),
      quantity: q.projects,
      amountCents: q.planMonthly,
      label: planItemLabel(planId, q.projects),
    });
  }

  const extra = (id: BillingItemId, quantity: number) => {
    if (quantity <= 0) return;
    const item = BILLING_ITEMS[id];
    items.push({ kind: item.kind, billingItemId: id, quantity, amountCents: quantity * item.unitCents, label: item.name });
  };
  // mensais primeiro (entram na assinatura), depois os únicos (viram pedidos de serviço)
  if (planId) extra("platform_extra", state.plataformas);
  if (state.lpcare) extra("lp_care", state.lp);
  if (state.sobm === "recorrente") extra("dash_custom_monthly", state.sob);
  extra("lp_team", state.lp);
  extra(state.sobm === "recorrente" ? "dash_custom_setup" : "dash_custom_once", state.sob);
  if (planId) extra("dash_extra", state.dash);

  const recurringCents = state.periodo === "anual" ? q.yearly : q.monthly;
  const recurringExtra = items.some((i) => i.kind === "recurring" && i.billingItemId);
  const blocked: OrderBlock | undefined = q.overLimit
    ? "over_limit"
    : !planId && recurringExtra
      ? "recurring_without_plan"
      : items.length === 0
        ? "empty"
        : undefined;

  return {
    product: "dash",
    planId,
    planDbId: planId,
    period: state.periodo,
    interval: INTERVAL[state.periodo],
    accountsQuantity: planId ? q.projects : 0,
    items,
    amountDueNowCents: recurringCents + q.oneTime,
    recurringCents,
    quote: q,
    ...(blocked ? { blocked } : {}),
  };
}

/** Plano de landing pages: hospedagem mensal (item do plano) + criação das LPs (uma vez). */
function buildLpOrder(state: PlanState): Order {
  const q = quote(state);
  const plan = state.plano === "sem" ? "pro" : state.plano;
  const pages = LP_PLAN_PAGES[plan];
  const team = BILLING_ITEMS.lp_team;
  const items: OrderItem[] = [
    {
      kind: "recurring",
      planPriceId: `${planDbId("lp", plan)}_month`,
      quantity: 1,
      amountCents: lpMonthly(plan),
      label: `Plano ${PLAN_LABEL[plan]} · ${pages} ${pages === 1 ? "landing page" : "landing pages"} · hospedagem e ajustes`,
    },
    { kind: "one_time", billingItemId: "lp_team", quantity: pages, amountCents: pages * team.unitCents, label: team.name },
  ];
  return {
    product: "lp",
    planId: plan,
    planDbId: planDbId("lp", plan),
    period: "mensal",
    interval: "month",
    accountsQuantity: 1,
    items,
    amountDueNowCents: q.monthly + q.oneTime,
    recurringCents: q.monthly,
    quote: q,
  };
}
