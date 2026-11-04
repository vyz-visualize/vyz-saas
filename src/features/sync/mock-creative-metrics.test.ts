import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { generateAccountData } from "./mock-generator";

const AD_KEYS = ["adExternalId", "date", "spend", "impressions", "reach", "clicks", "linkClicks", "conversions", "conversionValue", "videoViews", "videoThruplays"] as const;

const gen = (platform: "meta" | "google", id: string, name: string) => generateAccountData({ platform, accountExternalId: id, accountName: name, endDate: "2026-10-30", days: 90, anchorDate: "2026-09-15" });

/** Impressão digital dos números de antes do Bloco D: o gerador só pode acrescentar campos. */
function fingerprint(d: ReturnType<typeof gen>) {
  const ad = d.adDaily.map((r) => AD_KEYS.map((k) => r[k]));
  // só números: o texto dos termos de pesquisa pode mudar de redação
  const terms = d.searchTermDaily.map((r) => {
    const numbers: Partial<typeof r> = { ...r };
    delete numbers.searchTerm;
    return numbers;
  });
  // colunas novas de campanha ficam de fora: o gerador só pode acrescentar
  const campaigns = d.campaignDaily.map((r) => {
    const old: Partial<typeof r> = { ...r };
    delete old.allConversions;
    delete old.interactions;
    delete old.topImpressionPct;
    delete old.absoluteTopImpressionPct;
    return old;
  });
  return createHash("sha256")
    .update(JSON.stringify([d.accountDaily, campaigns, ad, d.breakdownDaily, terms, d.productDaily]))
    .digest("hex");
}

describe("gerador: métricas por anúncio", () => {
  it.each([
    ["meta", "act_111", "Loja Teste · Vendas", "350078b7db0be70d851feed12689192c5a6a7536d8de19ba19de37423f637536"],
    ["meta", "act_222", "Outra Loja", "3e57bbf84793207e67d35e642161acda337bc4f12d19e220a78d7b23ab4bd8df"],
    ["google", "123-456-7890", "Loja Teste · Brasil", "f9fecb16989804f9840434472ec999d961ce0fdda131fec038b0bb682f4814e5"],
  ] as const)("%s %s: os números que já existiam não mudaram", (platform, id, name, hash) => {
    expect(fingerprint(gen(platform, id, name))).toBe(hash);
  });

  const meta = gen("meta", "act_111", "Loja Teste · Vendas");
  const video = new Set(meta.ads.filter((a) => a.format === "video").map((a) => a.externalId));

  it("é determinístico", () => {
    expect(gen("meta", "act_111", "Loja Teste · Vendas").adDaily).toEqual(meta.adDaily);
  });

  it("vídeo cai a cada etapa e só existe em anúncio de vídeo", () => {
    const withVideo = meta.adDaily.filter((r) => r.videoViews != null);
    expect(withVideo.length).toBeGreaterThan(50);
    for (const r of meta.adDaily.slice(0, 400)) {
      expect(video.has(r.adExternalId)).toBe(r.videoP25 != null);
      if (r.videoP25 == null) continue;
      expect(r.videoP25).toBeLessThanOrEqual(r.videoViews!);
      expect(r.videoP50!).toBeLessThanOrEqual(r.videoP25);
      expect(r.videoP100!).toBeLessThanOrEqual(r.videoP95!);
    }
  });

  it("partes do engajamento não passam do total", () => {
    for (const r of meta.adDaily.slice(0, 400)) {
      expect((r.postReactions ?? 0) + (r.postComments ?? 0) + (r.postShares ?? 0) + (r.postSaves ?? 0)).toBeLessThanOrEqual((r.postEngagement ?? 0) + 5);
    }
  });

  it("há objetivos diferentes e leads só na campanha de leads", () => {
    const objectives = new Set(meta.campaigns.map((c) => c.objective));
    expect(objectives).toEqual(new Set(["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_ENGAGEMENT"]));
    const leadCampaign = meta.campaigns.find((c) => c.objective === "OUTCOME_LEADS")!.externalId;
    const leadAds = new Set(meta.ads.filter((a) => a.campaignExternalId === leadCampaign).map((a) => a.externalId));
    for (const r of meta.adDaily.slice(0, 400)) expect(r.leads != null).toBe(leadAds.has(r.adExternalId));
  });

  it("o link do post usa domínio reservado: nunca aponta para um post real", () => {
    for (const a of meta.ads) expect(a.postUrl).toMatch(/^https:\/\/instagram\.[^/]+\.example\/p\//);
  });

  it.each([
    ["meta", "act_111", "Loja Teste · Vendas"],
    ["google", "123-456-7890", "Loja Teste · Brasil"],
  ] as const)("%s: nenhum texto simulado usa a palavra proibida", (platform, id, name) => {
    const d = gen(platform, id, name);
    const texts = JSON.stringify([d.campaigns, d.ads, d.products, [...new Set(d.searchTermDaily.map((r) => r.searchTerm))]]);
    expect(texts).not.toMatch(/gr[áa]tis/i);
  });

  it("cadastros: sequência própria, sem mexer nas outras métricas de anúncio", () => {
    expect(meta.adDaily.some((r) => (r.registrations ?? 0) > 0)).toBe(true);
    for (const r of meta.adDaily.slice(0, 400)) expect(r.registrations ?? 0).toBeLessThanOrEqual(r.linkClicks ?? 0);
  });

  it("Google: colunas novas por campanha, com o total coerente", () => {
    const g = gen("google", "123-456-7890", "Loja Teste · Brasil");
    const search = new Set(g.campaigns.filter((c) => c.channel === "search").map((c) => c.externalId));
    expect(g.campaignDaily.length).toBeGreaterThan(50);
    for (const r of g.campaignDaily) {
      expect(r.allConversions!).toBeGreaterThanOrEqual(r.conversions);
      expect(r.interactions!).toBeGreaterThanOrEqual(r.clicks);
      expect(r.topImpressionPct != null).toBe(search.has(r.campaignExternalId));
      if (r.topImpressionPct != null) {
        expect(r.absoluteTopImpressionPct!).toBeLessThanOrEqual(r.topImpressionPct);
        expect(r.topImpressionPct).toBeLessThanOrEqual(1);
      }
    }
    // o total da conta segue sem as colunas novas: os cards leem as campanhas
    expect(g.accountDaily[0]).not.toHaveProperty("interactions");
  });

  it("Google não ganha métrica de anúncio", () => {
    const g = gen("google", "123-456-7890", "Loja Teste · Brasil");
    expect(g.adDaily[0].postEngagement).toBeUndefined();
  });
});
