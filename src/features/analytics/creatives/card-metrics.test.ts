import { describe, expect, it } from "vitest";
import { parseMetricPrefs, withCreativeCards } from "@/features/dashboards/metric-prefs";
import { CARD_METRICS, cardIds, cardLabel, formatCard, fromDataset, metricsFor, type CardCreative } from "./card-metrics";
import { postPlace } from "./PostLink";

const base: CardCreative = {
  id: "a",
  name: "Anúncio",
  campaignName: "Campanha",
  format: "Imagem",
  video: false,
  thumbnailUrl: null,
  postUrl: null,
  status: "active",
  spend: 100,
  impressions: 1000,
  reach: null,
  frequency: 2,
  linkClicks: 20,
  linkCtr: 0.02,
  cpc: 5,
  cpm: 100,
  thruplays: null,
  p25: null,
  p50: null,
  p75: null,
  p100: null,
  hookRate: null,
  result: { label: "leads", value: 0 },
  costPerResult: null,
  revenue: null,
  roas: null,
  cents: false,
};
const fmt = { money: (v: number) => `R$${v}`, int: (v: number) => String(v), pct: (v: number) => `${v * 100}%`, decimal: (v: number) => String(v) };
const by = (id: string) => CARD_METRICS.find((m) => m.id === id)!;

describe("métricas dos cards de criativo", () => {
  it("o padrão de cada visual", () => {
    expect(cardIds(undefined, "pulso")).toEqual(["costPerResult", "linkCtr", "frequency"]);
    expect(cardIds(undefined, "noturno")).toEqual(["result", "roas", "frequency"]);
    expect(cardIds(undefined, "areia")).toEqual(["result", "costPerResult", "convRate"]);
    expect(cardIds(undefined, "fachada")).toEqual(["result", "costPerResult", "linkCtr"]);
    expect(cardIds(undefined, "lavanda")).toEqual(["result", "spend", "linkCtr"]);
  });

  it("a escolha salva: só do catálogo, sem repetir, até 4, na ordem; inválida volta ao padrão", () => {
    expect(cardIds(["cpm", "cpm", "x", "linkCtr", "roas", "spend", "result"], "pulso")).toEqual(["cpm", "linkCtr", "roas", "spend"]);
    expect(cardIds(["x"], "lavanda")).toEqual(["result", "spend", "linkCtr"]);
    // investimento oculto: as que dependem dele saem
    expect(cardIds(["spend", "linkCtr"], "lavanda", { hideSpend: true })).toEqual(["linkCtr"]);
  });

  it("sem dado: —, nunca 0 inventado; custo por resultado sem resultado fica em branco", () => {
    expect(formatCard(by("reach"), base, fmt)).toBe("—");
    expect(formatCard(by("costPerResult"), base, fmt)).toBe("—");
    expect(formatCard(by("result"), base, fmt)).toBe("0");
    expect(formatCard(by("costPerResult"), { ...base, result: { label: "leads", value: 4 } }, fmt)).toBe("R$25");
  });

  it("as de vídeo não aparecem no card de imagem", () => {
    expect(metricsFor(["hookRate", "linkCtr"], base).map((m) => m.id)).toEqual(["linkCtr"]);
    expect(metricsFor(["hookRate", "linkCtr"], { ...base, video: true }).map((m) => m.id)).toEqual(["hookRate", "linkCtr"]);
  });

  it("o resultado leva o nome do objetivo da campanha", () => {
    expect(cardLabel(by("result"), base)).toBe("Leads");
    expect(cardLabel(by("costPerResult"), base)).toBe("Custo por lead");
    expect(cardLabel(by("costPerResult"), { ...base, result: { label: "conversões", value: 1 } })).toBe("Custo por conversão");
  });

  it("do conjunto do dashboard: retenção só com o vídeo, receita por criativo em branco", () => {
    const [c] = fromDataset({ creatives: [{ id: "v", name: "V", format: "Vídeo", platform: "meta", spend: 1000, impressions: 4000, clicks: 40, conversions: 2, frequency: 1.5, tone: 0, video: { views: 400, p25: 200, p50: 100, p75: 50, p100: 20 } }] }, "Vendas");
    expect(c.video).toBe(true);
    expect(c.p25).toBeCloseTo(0.5);
    expect(c.hookRate).toBeCloseTo(0.1);
    expect(c.revenue).toBeNull();
  });

  it("fica salva nas preferências do dashboard (metric_prefs) sem mexer no resto", () => {
    const prefs = parseMetricPrefs({ meta: { kpis: { hidden: ["cpm"], shown: [] } }, creatives: ["roas", "result"] });
    expect(prefs.creatives).toEqual(["roas", "result"]);
    const next = withCreativeCards(prefs, ["linkCtr"]);
    expect(next.creatives).toEqual(["linkCtr"]);
    expect(next.meta).toEqual(prefs.meta);
    expect(withCreativeCards(next, []).creatives).toBeUndefined();
  });
});

describe("link do post", () => {
  it("só endereço https de rede social", () => {
    expect(postPlace("https://www.instagram.com/p/abc")).toBe("Instagram");
    expect(postPlace("https://www.facebook.com/1/posts/2")).toBe("Facebook");
    expect(postPlace("https://youtu.be/x")).toBe("YouTube");
    expect(postPlace("http://www.instagram.com/p/abc")).toBeNull();
    expect(postPlace("https://example.com")).toBeNull();
  });
});
