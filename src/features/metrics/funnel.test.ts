import { describe, expect, it } from "vitest";
import type { AccountDayRow } from "@/features/analytics/types";
import { funnelPct, funnelRows, funnelSummary, metaPurchaseFunnel } from "./funnel";

const day = (date: string, v: Partial<AccountDayRow>) => ({ date, linkClicks: 0, landingPageViews: 0, addToCart: 0, initiateCheckout: 0, conversions: 0, ...v }) as AccountDayRow;
const range = { from: "2026-11-01", to: "2026-11-30" };

describe("funnelPct", () => {
  it("duas casas nos valores pequenos, em pt-BR", () => {
    expect(funnelPct(0.034)).toBe("0,03%");
    expect(funnelPct(0.5)).toBe("0,50%");
    expect(funnelPct(8.123)).toBe("8,12%");
    expect(funnelPct(41.27)).toBe("41,3%");
    expect(funnelPct(100)).toBe("100%");
  });
  it("nunca 0% quando há compra", () => {
    expect(funnelPct(0.003)).toBe("<0,01%");
    expect(funnelPct(0, true)).toBe("<0,01%");
    expect(funnelPct(0)).toBe("0%");
  });
});

describe("metaPurchaseFunnel", () => {
  it("cinco etapas da Meta, só dentro do período, cada uma sobre a anterior", () => {
    const steps = metaPurchaseFunnel(
      [
        day("2026-10-31", { linkClicks: 999, conversions: 50 }),
        day("2026-11-01", { linkClicks: 3000, landingPageViews: 2200, addToCart: 200, initiateCheckout: 90, conversions: 40 }),
        day("2026-11-02", { linkClicks: 842, landingPageViews: 600, addToCart: 112, initiateCheckout: 40, conversions: 12 }),
      ],
      range,
    );
    expect(steps.map((s) => [s.label, s.count])).toEqual([
      ["Cliques no link", 3842],
      ["Visualizações da página", 2800],
      ["Carrinho", 312],
      ["Checkout", 130],
      ["Compras", 52],
    ]);
    const rows = funnelRows(steps);
    expect(rows[0].display).toBe("3.842");
    expect(rows[2]).toMatchObject({ display: "11,1%", note: "312 de 2.800" });
    expect(rows[4]).toMatchObject({ display: "40%", note: "52 de 130" });
    expect(funnelSummary("Funil", steps)).toContain("Compras 40% da etapa anterior");
  });
  it("etapa que o pixel não mede sai; compras ficam mesmo zeradas", () => {
    const steps = metaPurchaseFunnel([day("2026-11-03", { linkClicks: 1000, landingPageViews: 700, addToCart: 0, initiateCheckout: 0, conversions: 3 })], range);
    expect(steps.map((s) => s.label)).toEqual(["Cliques no link", "Visualizações da página", "Compras"]);
    const none = metaPurchaseFunnel([day("2026-11-03", { linkClicks: 1000, landingPageViews: 700 })], range);
    expect(none.map((s) => s.label)).toEqual(["Cliques no link", "Visualizações da página", "Carrinho", "Checkout", "Compras"]);
    expect(funnelRows(none)[4].display).toBe("0%");
  });
  it("compra rara: nunca 0%", () => {
    const steps = metaPurchaseFunnel([day("2026-11-03", { linkClicks: 900_000, landingPageViews: 600_000, addToCart: 30_000, initiateCheckout: 200_000, conversions: 1 })], range);
    expect(funnelRows(steps)[4].display).toBe("<0,01%");
  });
  it("sem cliques no link: vazio (fica o funil padrão)", () => {
    expect(metaPurchaseFunnel([day("2026-11-03", { conversions: 4 })], range)).toEqual([]);
  });
});

describe("funil sem contagem (amostra, GA4, impressões)", () => {
  it("etapa sobre a primeira e quanto avança", () => {
    const rows = funnelRows([
      { label: "Impressões", pct: 100 },
      { label: "Cliques", pct: 1.234 },
      { label: "Conversões", pct: 0.0312 },
    ]);
    expect(rows.map((r) => r.display)).toEqual(["100%", "1,23%", "0,03%"]);
    expect(rows[2].note).toBe("2,53% avançam");
  });
});
