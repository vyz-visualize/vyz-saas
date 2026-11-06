import { describe, expect, it } from "vitest";
import { BILLING_ITEMS } from "@/features/pricing/catalog";
import { DEFAULT_STATE, PLAN, PLAN_PROJECTS, fromQuery, toQuery, type PlanState } from "@/features/pricing/pricing";
import { buildOrder, normalizeState } from "./order";

const s = (patch: Partial<PlanState>): PlanState => normalizeState(patch);
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

describe("pedido", () => {
  it("Padrão anual: 15 projetos fixos, mesmo com projetos na query antiga", () => {
    const order = buildOrder(normalizeState(fromQuery(new URLSearchParams("plano=pro&periodo=anual&projetos=5"))));
    expect(order.planId).toBe("pro");
    expect(order.interval).toBe("year");
    expect(order.accountsQuantity).toBe(15);
    expect(order.items).toEqual([{ kind: "recurring", planPriceId: "pro_year", quantity: 15, amountCents: 18325, label: "Plano Padrão · até 15 projetos" }]);
    expect(order.recurringCents).toBe(219900);
    expect(order.amountDueNowCents).toBe(order.recurringCents);
    expect(order.blocked).toBeUndefined();
  });

  it("Básico mensal cobra um mês: R$ 59,90", () => {
    const order = buildOrder(s({ plano: "base", periodo: "mensal" }));
    expect(order.items[0]).toMatchObject({ planPriceId: "base_month", quantity: 5, amountCents: 5990 });
    expect(order.recurringCents).toBe(5990);
    expect(order.amountDueNowCents).toBe(5990);
  });

  it("Avançado anual: só o plano, sem adicional", () => {
    const order = buildOrder(s({ plano: "avancado", periodo: "anual" }));
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ planPriceId: "avancado_year", quantity: 30, amountCents: 40825 });
    expect(order.items[0].label).toBe("Plano Avançado · até 30 projetos");
    expect(order.recurringCents).toBe(489900);
  });

  it("o valor do plano fecha com a conta do banco (first + extra × (qtd − 1))", () => {
    // sync-catalog grava first = preço do plano e extra = 0
    for (const plano of ["base", "pro", "avancado"] as const) {
      for (const periodo of ["mensal", "anual"] as const) {
        const order = buildOrder(s({ plano, periodo }));
        expect(order.items[0].quantity).toBe(PLAN_PROJECTS[plano]);
        expect(order.items[0].amountCents).toBe(PLAN[plano][periodo] + 0 * (order.items[0].quantity - 1));
      }
    }
  });

  it("extras: mensais primeiro, depois os únicos, cada um com o preço do catálogo", () => {
    const order = buildOrder(s({ plano: "pro", periodo: "anual", lp: 2, lpcare: true, sob: 1, sobm: "recorrente", dash: 3 }));
    expect(order.items.map((i) => [i.kind, i.planPriceId ?? i.billingItemId, i.quantity])).toEqual([
      ["recurring", "pro_year", 15],
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
    const state = s({ plano: "pro", periodo: "anual", lp: 1, lpcare: true, sob: 2, sobm: "recorrente", dash: 1 });
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

describe("normalização", () => {
  it("sem query, vale o padrão da LP", () => {
    expect(normalizeState(null)).toEqual(DEFAULT_STATE);
  });

  it("sem plano zera o dashboard adicional", () => {
    expect(normalizeState({ plano: "sem", dash: 2 })).toMatchObject({ dash: 0 });
  });

  it("hospedagem só com landing page", () => {
    expect(normalizeState({ lp: 0, lpcare: true }).lpcare).toBe(false);
    expect(normalizeState({ lp: 1, lpcare: true }).lpcare).toBe(true);
  });
});

describe("pedido de landing pages", () => {
  it("Padrão: 3 LPs feitas pelo time + hospedagem mensal, sem anual nem contas", () => {
    const state = normalizeState(fromQuery(new URLSearchParams("produto=lp&plano=pro&periodo=anual&plataformas=4")));
    expect(state).toMatchObject({ produto: "lp", plano: "pro", periodo: "mensal" });
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
