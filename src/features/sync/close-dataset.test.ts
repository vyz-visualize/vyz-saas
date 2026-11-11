import { describe, expect, it } from "vitest";
import { closeDataset } from "./close-dataset";
import type { AccountDataset } from "./dataset";

const m = { spend: 1, impressions: 10, reach: null, clicks: 1, linkClicks: null, landingPageViews: null, addToCart: null, initiateCheckout: null, conversions: 0, conversionValue: 0, videoViews: null, videoThruplays: null, searchImpressionShare: null, searchLostIsBudget: null, searchLostIsRank: null };
const base = {
  platform: "google",
  accountExternalId: "1",
  currency: "BRL",
  range: { from: "2026-11-01", to: "2026-11-02" },
  campaigns: [{ externalId: "c1", name: "Ativa", status: "active", objective: null, channel: null, funnelStage: null, dailyBudget: null, startedOn: null }],
  ads: [{ externalId: "a1", campaignExternalId: "c1", name: "A", format: "text", status: "active", headline: null, body: null, callToAction: null, thumbnailUrl: null, landingUrl: null }],
  products: [],
  accountDaily: [],
  campaignDaily: [{ ...m, campaignExternalId: "c1", date: "2026-11-01" }, { ...m, campaignExternalId: "c-apagada", date: "2026-11-01" }],
  adDaily: [{ ...m, adExternalId: "a1", date: "2026-11-01" }, { ...m, adExternalId: "a-apagado", date: "2026-11-01" }],
  breakdownDaily: [],
  searchTermDaily: [],
  productDaily: [{ spend: 1, impressions: 1, clicks: 0, conversions: 0, conversionValue: 0, productExternalId: "p9", date: "2026-11-01" }],
} as unknown as AccountDataset;

describe("fechar o conjunto antes de gravar", () => {
  it("campanha apagada com gasto no período entra como removida", () => {
    const ds = closeDataset(base);
    const c = ds.campaigns.find((x) => x.externalId === "c-apagada");
    expect(c?.status).toBe("removed");
    expect(ds.campaigns).toHaveLength(2);
  });
  it("anúncio desconhecido sai das linhas diárias; produto desconhecido ganha cadastro", () => {
    const ds = closeDataset(base);
    expect(ds.adDaily.map((d) => d.adExternalId)).toEqual(["a1"]);
    expect(ds.products.map((p) => p.externalId)).toEqual(["p9"]);
  });
  it("conjunto já fechado não muda", () => {
    const ok = { ...base, campaignDaily: base.campaignDaily.slice(0, 1), adDaily: base.adDaily.slice(0, 1), productDaily: [] } as AccountDataset;
    const ds = closeDataset(ok);
    expect(ds.campaigns).toEqual(ok.campaigns);
    expect(ds.adDaily).toEqual(ok.adDaily);
  });
});
