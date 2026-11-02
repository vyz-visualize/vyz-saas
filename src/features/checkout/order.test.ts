import { describe, expect, it } from "vitest";
import { BILLING_ITEMS } from "@/features/pricing/catalog";
import { DEFAULT_STATE, fromQuery, toQuery, type PlanState } from "@/features/pricing/pricing";
import { buildOrder, normalizeState } from "./order";

const s = (patch: Partial<PlanState>): PlanState => normalizeState(patch);
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

describe("pedido", () => {
  it("Padrão anual com 2 BMs e 1 Google (a query da LP completa com o padrão)", () => {
    const order = buildOrder(normalizeState(fromQuery(new URLSearchParams("plano=pro&periodo=anual&meta=2"))));
    expect(order.planId).toBe("pro");
    expect(order.interval).toBe("year");
    expect(order.accountsQuantity).toBe(3);
    expect(order.items).toEqual([{ kind: "recurring", planPriceId: "pro_year", quantity: 3, amountCents: 8500 + 2 * 10199, label: "Plano Padrão · 3 contas" }]);
    expect(order.recurringCents).toBe((8500 + 2 * 10199) * 12);
    expect(order.amountDueNowCents).toBe(order.recurringCents);
    expect(order.blocked).toBeUndefined();
  });

  it("Básico mensal 1+1 cobra um mês: R$ 141,65", () => {
    const order = buildOrder(s({ plano: "base", periodo: "mensal" }));
    expect(order.items[0]).toMatchObject({ planPriceId: "base_month", quantity: 2, amountCents: 14165 });
    expect(order.recurringCents).toBe(14165);
    expect(order.amountDueNowCents).toBe(14165);
  });

  it("Avançado: o áudio entra no valor do plano, sem desconto no anual", () => {
    const order = buildOrder(s({ plano: "avancado", periodo: "anual" }));
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ planPriceId: "avancado_year", amountCents: 8500 + 10199 + 99000 });
    expect(order.items[0].label).toBe("Plano Avançado · 2 contas · com análise por áudio");
  });

  it("extras: mensais primeiro, depois os únicos, cada um com o preço do catálogo", () => {
    const order = buildOrder(s({ plano: "pro", periodo: "anual", lp: 2, lpcare: true, sob: 1, sobm: "recorrente", dash: 3 }));
    expect(order.items.map((i) => [i.kind, i.planPriceId ?? i.billingItemId, i.quantity])).toEqual([
      ["recurring", "pro_year", 2],
      ["recurring", "lp_care", 2],
      ["recurring", "dash_custom_monthly", 1],
      ["one_time", "lp_team", 2],
      ["one_time", "dash_custom_setup", 1],
      ["one_time", "dash_extra", 3],
    ]);
    for (const item of order.items.filter((i) => i.billingItemId)) {
      expect(item.amountCents).toBe(item.quantity * BILLING_ITEMS[item.billingItemId!].unitCents);
    }
  });

  it("as linhas somam o orçamento da LP (todo mês, ano e uma vez)", () => {
    const state = s({ plano: "pro", periodo: "anual", meta: 4, google: 2, lp: 1, lpcare: true, sob: 2, sobm: "recorrente", dash: 1 });
    const order = buildOrder(state);
    const monthly = sum(order.items.filter((i) => i.kind === "recurring").map((i) => i.amountCents));
    const once = sum(order.items.filter((i) => i.kind === "one_time").map((i) => i.amountCents));
    expect(monthly).toBe(order.quote.monthly);
    expect(once).toBe(order.quote.oneTime);
    expect(order.recurringCents).toBe(monthly * 12);
    expect(order.amountDueNowCents).toBe(monthly * 12 + once);

    const mensal = buildOrder({ ...state, periodo: "mensal" });
    expect(mensal.recurringCents).toBe(mensal.quote.monthly);
    expect(mensal.amountDueNowCents).toBe(mensal.quote.monthly + mensal.quote.oneTime);
  });

  it("dashboard sob medida de pagamento único", () => {
    const order = buildOrder(s({ sob: 1, sobm: "unico" }));
    expect(order.items.find((i) => i.billingItemId === "dash_custom_once")).toMatchObject({ kind: "one_time", amountCents: 190000 });
    expect(order.items.some((i) => i.billingItemId === "dash_custom_monthly")).toBe(false);
  });

  it("o Básico não cobra as outras plataformas", () => {
    const order = buildOrder(s({ plano: "base", meta: 1, google: 1, outras: 3 }));
    expect(order.accountsQuantity).toBe(2);
    expect(order.quote.accountsOutside).toBe(3);
  });
});

describe("sem plano", () => {
  it("só itens únicos: paga uma vez, sem contas nem recorrência", () => {
    const order = buildOrder(s({ plano: "sem", lp: 2 }));
    expect(order.planId).toBeNull();
    expect(order.accountsQuantity).toBe(0);
    expect(order.items).toEqual([{ kind: "one_time", billingItemId: "lp_team", quantity: 2, amountCents: 190000, label: "Landing page feita pelo time" }]);
    expect(order.recurringCents).toBe(0);
    expect(order.amountDueNowCents).toBe(190000);
    expect(order.blocked).toBeUndefined();
  });

  it("item mensal sem plano fica bloqueado", () => {
    expect(buildOrder(s({ plano: "sem", lp: 1, lpcare: true })).blocked).toBe("recurring_without_plan");
    expect(buildOrder(s({ plano: "sem", sob: 1, sobm: "recorrente" })).blocked).toBe("recurring_without_plan");
  });

  it("nada escolhido fica bloqueado", () => {
    expect(buildOrder(s({ plano: "sem" })).blocked).toBe("empty");
  });

  it("dashboard adicional só com plano", () => {
    const order = buildOrder(s({ plano: "sem", lp: 1, dash: 3 }));
    expect(order.items.some((i) => i.billingItemId === "dash_extra")).toBe(false);
  });
});

describe("limites", () => {
  it("acima de 30 contas vai para o especialista", () => {
    const order = buildOrder(s({ plano: "pro", meta: 20, google: 11 }));
    expect(order.blocked).toBe("over_limit");
    expect(order.accountsQuantity).toBe(30);
  });

  it("30 contas ainda é self-service", () => {
    expect(buildOrder(s({ plano: "pro", meta: 15, google: 15 })).blocked).toBeUndefined();
  });
});

describe("normalização", () => {
  it("sem query, vale o padrão da LP", () => {
    expect(normalizeState(null)).toEqual(DEFAULT_STATE);
  });

  it("sem plano zera contas e dashboard adicional", () => {
    expect(normalizeState({ plano: "sem", meta: 3, google: 2, ga4: 1, outras: 1, dash: 2 })).toMatchObject({ meta: 0, google: 0, ga4: 0, outras: 0, dash: 0 });
  });

  it("hospedagem só com landing page", () => {
    expect(normalizeState({ lp: 0, lpcare: true }).lpcare).toBe(false);
    expect(normalizeState({ lp: 1, lpcare: true }).lpcare).toBe(true);
  });
});

describe("pedido de landing pages", () => {
  it("Padrão: 3 LPs feitas pelo time + hospedagem mensal, sem anual nem contas", () => {
    const state = normalizeState(fromQuery(new URLSearchParams("produto=lp&plano=pro&periodo=anual&meta=4")));
    expect(state).toMatchObject({ produto: "lp", plano: "pro", periodo: "mensal", meta: 0, google: 0 });
    const order = buildOrder(state);
    expect(order).toMatchObject({ product: "lp", planId: "pro", planDbId: "lp_pro", interval: "month", accountsQuantity: 1 });
    expect(order.items.map((i) => [i.kind, i.planPriceId ?? i.billingItemId, i.quantity, i.amountCents])).toEqual([
      ["recurring", "lp_pro_month", 1, 29700],
      ["one_time", "lp_team", 3, 285000],
    ]);
    expect(order.amountDueNowCents).toBe(29700 + 285000);
    expect(order.recurringCents).toBe(29700);
  });

  it("a query guarda o produto", () => {
    expect(toQuery({ ...normalizeState({ produto: "lp", plano: "base" }) })).toContain("produto=lp");
    expect(fromQuery(new URLSearchParams("plano=base"))?.produto).toBeUndefined();
  });
});
