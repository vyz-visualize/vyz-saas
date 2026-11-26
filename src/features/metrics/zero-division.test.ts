import { afterEach, describe, expect, it, vi } from "vitest";
import { formatMetric, ratio } from "./definitions";
import { brl, brlCompact, decimal, int, pct } from "@/lib/format";
import { periodDays } from "@/features/workspace/types";

describe("divisão por zero vira \"—\"", () => {
  it("campanha com investimento e 0 vendas: custo por venda \"—\" (nunca \"R$ Infinity,NaN\") e ROAS 0,0", () => {
    const c = { spend: 12_345, conversions: 0, revenue: 0 };
    expect(formatMetric("cpa", ratio(c.spend, c.conversions), "brl")).toBe("—");
    expect(formatMetric("roas", ratio(c.revenue, c.spend), "decimal")).toBe("0,0");
  });

  it("sem investimento: ROAS \"—\" (com ou sem receita); com venda e investimento, o número", () => {
    expect(formatMetric("roas", ratio(0, 0), "decimal")).toBe("—");
    expect(formatMetric("roas", ratio(50_000, 0), "decimal")).toBe("—");
    expect(formatMetric("roas", ratio(50_000, 10_000), "decimal")).toBe("5,0");
    expect(formatMetric("cpa", ratio(10_000, 4), "brl")).toBe("R$ 25,00");
  });

  it("a formatação de base não escreve Infinity nem NaN (rede de segurança para divisões que escaparem)", () => {
    for (const v of [Infinity, -Infinity, NaN]) {
      expect(brl(v)).toBe("—");
      expect(brlCompact(v)).toBe("—");
      expect(int(v)).toBe("—");
      expect(decimal(v)).toBe("—");
      expect(pct(v)).toBe("—");
    }
    expect(brl(1234)).toBe("R$ 12,34");
  });
});

describe("\"Este mês\" no fuso do Brasil, igual no servidor e no navegador", () => {
  afterEach(() => vi.useRealTimers());

  it("às 22h de 26/11 em São Paulo (já 27/11 em UTC) o mês tem 26 dias", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-27T01:00:00Z"));
    expect(periodDays({ period: "mes", customDays: 0 })).toBe(26);
  });
});
