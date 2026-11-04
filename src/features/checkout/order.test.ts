import { describe, expect, it } from "vitest";
import { BILLING_ITEMS } from "@/features/pricing/catalog";
import { DEFAULT_STATE, EXTRA_PROJECT, INCLUDED_PROJECTS, PLAN, fromQuery, toQuery, type PlanState } from "@/features/pricing/pricing";
import { buildOrder, normalizeState } from "./order";

const s = (patch: Partial<PlanState>): PlanState => normalizeState(patch);
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

describe("pedido", () => {
  it("Padrão anual com 5 projetos (a query da LP completa com o padrão)", () => {
    const order = buildOrder(normalizeState(fromQuery(new URLSearchParams("plano=pro&periodo=anual&projetos=5"))));
    expect(order.planId).toBe("pro");
    expect(order.interval).toBe("year");
    expect(order.accountsQuantity).toBe(5);
    expect(order.items).toEqual([{ kind: "recurring", planPriceId: "pro_year", quantity: 5, amountCents: 5990 + 2 * 1890, label: "Plano Padrão · 5 projetos" }]);
    expect(order.recurringCents).toBe((5990 + 2 * 1890) * 12);
    expect(order.amountDueNowCents).toBe(order.recurringCents);
    expect(order.blocked).toBeUndefined();
  });

  it("Básico mensal com 3 projetos cobra um mês: R$ 49,90", () => {
    const order = buildOrder(s({ plano: "base", periodo: "mensal" }));
    expect(order.items[0]).toMatchObject({ planPriceId: "base_month", quantity: 3, amountCents: 4990 });
    expect(order.recurringCents).toBe(4990);
    expect(order.amountDueNowCents).toBe(4990);
  });

  it("Avançado anual: só o plano, sem adicional", () => {
    const order = buildOrder(s({ plano: "avancado", periodo: "anual" }));
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ planPriceId: "avancado_year", amountCents: 9990 });
    expect(order.items[0].label).toBe("Plano Avançado · 3 projetos");
  });

  it("o valor do plano fecha com a conta do banco (first + extra × (qtd − 1))", () => {
    for (const plano of ["base", "pro", "avancado"] as const) {
      for (const projetos of [3, 4, 17]) {
        const order = buildOrder(s({ plano, periodo: "mensal", projetos }));
        const first = PLAN[plano].mensal - (INCLUDED_PROJECTS - 1) * EXTRA_PROJECT[plano].mensal;
        expect(order.items[0].amountCents).toBe(first + EXTRA_PROJECT[plano].mensal * (projetos - 1));
      }
    }
  });

  it("extras: mensais primeiro, depois os únicos, cada um com o preço do catálogo", () => {
    const order = buildOrder(s({ plano: "pro", periodo: "anual", lp: 2, lpcare: true, sob: 1, sobm: "recorrente", dash: 3 }));
    expect(order.items.map((i) => [i.kind, i.planPriceId ?? i.billingItemId, i.quantity])).toEqual([
      ["recurring", "pro_year", 3],
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
    const state = s({ plano: "pro", periodo: "anual", projetos: 6, lp: 1, lpcare: true, sob: 2, sobm: "recorrente", dash: 1 });
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

  it("plataforma extra: item mensal só no Básico", () => {
    const order = buildOrder(s({ plano: "base", plataformas: 2 }));
    expect(order.items.find((i) => i.billingItemId === "platform_extra")).toMatchObject({ kind: "recurring", quantity: 2, amountCents: 2 * 4990 });
    expect(buildOrder(s({ plano: "pro", plataformas: 2 })).items.some((i) => i.billingItemId === "platform_extra")).toBe(false);
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
  it("acima de 200 projetos vai para o especialista", () => {
    const order = buildOrder(s({ plano: "pro", projetos: 201 }));
    expect(order.blocked).toBe("over_limit");
    expect(order.accountsQuantity).toBe(200);
  });

  it("200 projetos ainda é self-service", () => {
    expect(buildOrder(s({ plano: "pro", projetos: 200 })).blocked).toBeUndefined();
  });
});

describe("normalização", () => {
  it("sem query, vale o padrão da LP", () => {
    expect(normalizeState(null)).toEqual(DEFAULT_STATE);
  });

  it("sem plano zera plataforma extra e dashboard adicional", () => {
    expect(normalizeState({ plano: "sem", plataformas: 2, dash: 2 })).toMatchObject({ plataformas: 0, dash: 0 });
  });

  it("hospedagem só com landing page", () => {
    expect(normalizeState({ lp: 0, lpcare: true }).lpcare).toBe(false);
    expect(normalizeState({ lp: 1, lpcare: true }).lpcare).toBe(true);
  });
});

describe("pedido de landing pages", () => {
  it("Padrão: 3 LPs feitas pelo time + hospedagem mensal, sem anual nem contas", () => {
    const state = normalizeState(fromQuery(new URLSearchParams("produto=lp&plano=pro&periodo=anual&plataformas=4")));
    expect(state).toMatchObject({ produto: "lp", plano: "pro", periodo: "mensal", plataformas: 0 });
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
