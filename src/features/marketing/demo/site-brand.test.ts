import { describe, expect, it } from "vitest";
import { aggregateDashboard } from "@/features/analytics/aggregate";
import { sampleRows } from "@/features/analytics/preview";
import { TEASER_ADS } from "./compare-teaser-data";
import { SAMPLE_CLIENTS, SITE_CAMPAIGN_NAMES, sampleRowsFor } from "./engine";

describe("amostra do site com a marca VYZ", () => {
  it("o cliente da amostra é a VYZ", () => {
    expect(SAMPLE_CLIENTS.meta.client).toBe("VYZ");
    expect(JSON.stringify(SAMPLE_CLIENTS)).not.toContain("Loja Verde");
  });

  it("todas as campanhas da amostra ganham nome da VYZ", () => {
    const names = sampleRowsFor("meta").campaigns.map((c) => c.name);
    expect(names).toHaveLength(Object.keys(SITE_CAMPAIGN_NAMES).length);
    for (const n of names) expect(Object.values(SITE_CAMPAIGN_NAMES)).toContain(n);
  });

  it("só os nomes mudam: os números são os da amostra do produto", () => {
    const site = aggregateDashboard(sampleRowsFor("meta"), { breakEvenRoas: 2.5 });
    const produto = aggregateDashboard(sampleRows("meta", { period: "30d" }), { breakEvenRoas: 2.5 });
    expect(site.totals).toEqual(produto.totals);
    expect(site.campaigns.map((c) => [c.id, c.spend, c.roas])).toEqual(produto.campaigns.map((c) => [c.id, c.spend, c.roas]));
  });

  it("a amostra do produto (painel) continua com os nomes de antes", () => {
    const produto = sampleRows("meta", { period: "30d" }).campaigns.map((c) => c.name);
    expect(produto).toContain("Prospecção · Advantage+ Shopping");
    expect(produto.some((n) => Object.values(SITE_CAMPAIGN_NAMES).includes(n))).toBe(false);
  });

  it("os anúncios do comparativo são da VYZ, com o criativo de cada um", () => {
    expect(TEASER_ADS.map((a) => [a.format, a.art])).toEqual([
      ["video", "mascote"],
      ["carousel", "dashboard"],
    ]);
    for (const a of TEASER_ADS) expect(Object.values(SITE_CAMPAIGN_NAMES)).toContain(a.campaign);
  });
});
