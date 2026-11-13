import { describe, expect, it } from "vitest";
import { datasetFor, DEFAULT_SETTINGS } from "./data";
import { makeContext } from "./widgets/Widgets";

describe("amostra com verba pequena", () => {
  it("nunca zera vendas, receita, ROAS e custo por venda (o dashboard Teste com R$ 1.000 por mês)", () => {
    const d = { templateId: "vyz-ecommerce", name: "Teste", client: "CAP", pages: ["visao-geral"] as never, settings: { ...DEFAULT_SETTINGS, goal: 5000, margin: 0.4, budget: 100000 } };
    const c = makeContext(datasetFor(d, 30));
    expect(c.cur.spend).toBeGreaterThan(0);
    expect(c.cur.conversions).toBeGreaterThan(0);
    expect(c.cur.revenue).toBeGreaterThan(0);
    expect(c.cur.roas).toBeGreaterThan(0);
    expect(c.cur.cpa).toBeGreaterThan(0);
  });
});
