import { describe, expect, it } from "vitest";
import { aggregateDashboard, deltaOf, fatigueOf, reachPerDay, redactSpend, totalsOf, weightedShare } from "./aggregate";
import { sampleDashboardData } from "./preview";
import { dashboardRanges, maturingStart } from "./ranges";
import type { AccountDayRow, AdDayRow, CampaignDayRow, GoogleView, MetaView, MetricRow, WarehouseRows } from "./types";

const EMPTY: MetricRow = {
  spend: 0,
  impressions: 0,
  reach: null,
  clicks: 0,
  linkClicks: null,
  landingPageViews: null,
  addToCart: null,
  initiateCheckout: null,
  conversions: 0,
  conversionValue: 0,
  videoViews: null,
  videoThruplays: null,
  searchImpressionShare: null,
  searchLostIsBudget: null,
  searchLostIsRank: null,
};

const day = (date: string, m: Partial<MetricRow>): AccountDayRow => ({ ...EMPTY, ...m, date });
const camp = (campaignId: string, date: string, m: Partial<MetricRow>): CampaignDayRow => ({ ...EMPTY, ...m, campaignId, date });

const current = { from: "2026-10-01", to: "2026-10-04", days: 4 };
const previous = { from: "2026-09-27", to: "2026-09-30", days: 4 };

function rows(over: Partial<WarehouseRows> = {}): WarehouseRows {
  return {
    platform: "meta",
    current,
    previous,
    accountDaily: [],
    campaigns: [],
    campaignDaily: [],
    ads: [],
    adDaily: [],
    breakdownDaily: [],
    searchTermDaily: [],
    products: [],
    productDaily: [],
    ...over,
  };
}

describe("ranges", () => {
  it("termina ontem e o anterior vem logo antes", () => {
    expect(dashboardRanges("7d", 0, "2026-10-30")).toEqual({
      current: { from: "2026-10-23", to: "2026-10-29", days: 7 },
      previous: { from: "2026-10-16", to: "2026-10-22", days: 7 },
    });
  });
  it("este mês vai do dia 1 até ontem; no dia 1 é o mês passado inteiro", () => {
    expect(dashboardRanges("mes", 0, "2026-10-30").current).toEqual({ from: "2026-10-01", to: "2026-10-29", days: 29 });
    expect(dashboardRanges("mes", 0, "2026-11-01").current).toEqual({ from: "2026-10-01", to: "2026-10-31", days: 31 });
  });
  it("personalizado fica entre 3 e 60 dias", () => {
    expect(dashboardRanges("custom", 500, "2026-10-30").current.days).toBe(60);
    expect(dashboardRanges("custom", 1, "2026-10-30").current.days).toBe(3);
  });
  it("marca os 3 últimos dias em maturação", () => {
    expect(maturingStart(current)).toBe("2026-10-02");
    expect(maturingStart({ from: "2026-10-04", to: "2026-10-04", days: 1 })).toBeNull();
  });
});

describe("totais", () => {
  it("CTR, ROAS, CPA e ticket vêm das somas (não de média de médias)", () => {
    const t = totalsOf([
      { spend: 100, impressions: 1000, clicks: 10, conversions: 1, conversionValue: 300 },
      { spend: 300, impressions: 9000, clicks: 270, conversions: 3, conversionValue: 900 },
    ]);
    expect(t.ctr).toBeCloseTo(280 / 10000);
    expect(t.roas).toBeCloseTo(3);
    expect(t.cpa).toBeCloseTo(100);
    expect(t.ticket).toBeCloseTo(300);
    expect(t.cpm).toBeCloseTo(40);
  });
  it("soma dinheiro sem erro de ponto flutuante", () => {
    expect(totalsOf([0.1, 0.2, 0.3].map((spend) => ({ spend, impressions: 1, clicks: 0, conversions: 0, conversionValue: 0 }))).spend).toBe(0.6);
  });
  it("frequência usa só as linhas com alcance", () => {
    const t = totalsOf([
      { ...EMPTY, impressions: 300, reach: 100 },
      { ...EMPTY, impressions: 500, reach: null },
    ]);
    expect(t.frequency).toBe(3);
    expect(totalsOf([{ ...EMPTY, impressions: 10 }]).frequency).toBeNull();
  });
  it("sem divisor, razão é null", () => {
    const t = totalsOf([]);
    expect([t.ctr, t.roas, t.cpa, t.cpm]).toEqual([null, null, null, null]);
  });
  it("variação", () => {
    expect(deltaOf(110, 100)).toBeCloseTo(0.1);
    expect(deltaOf(5, 0)).toBeNull();
    expect(deltaOf(null, 3)).toBeNull();
  });
});

describe("parcela de impressões", () => {
  it("pondera pelas impressões elegíveis (impressões ÷ parcela)", () => {
    // A: 900 impressões a 90% → 1000 elegíveis; B: 100 a 10% → 1000 elegíveis
    const w = weightedShare([
      { impressions: 900, searchImpressionShare: 0.9, searchLostIsBudget: 0, searchLostIsRank: 0.1 },
      { impressions: 100, searchImpressionShare: 0.1, searchLostIsBudget: 0.6, searchLostIsRank: 0.3 },
      { impressions: 5000, searchImpressionShare: null, searchLostIsBudget: null, searchLostIsRank: null },
    ]);
    expect(w.share).toBeCloseTo(1000 / 2000);
    expect(w.lostBudget).toBeCloseTo(0.3);
    expect(w.lostRank).toBeCloseTo(0.2);
  });
});

describe("Meta", () => {
  const data = rows({
    accountDaily: [
      day("2026-09-28", { spend: 100, impressions: 10000, conversions: 2, conversionValue: 200, linkClicks: 100, reach: 8000 }),
      day("2026-10-01", { spend: 100, impressions: 10000, conversions: 4, conversionValue: 400, linkClicks: 150, reach: 5000, landingPageViews: 120, addToCart: 30, initiateCheckout: 10 }),
      day("2026-10-03", { spend: 100, impressions: 10000, conversions: 2, conversionValue: 200, linkClicks: 50, reach: 5000, landingPageViews: 40, addToCart: 10, initiateCheckout: 4 }),
    ],
    campaigns: [
      { id: "c1", name: "Prospecção", status: "active", channel: null, funnelStage: "prospecting", dailyBudget: 50 },
      { id: "c2", name: "Remarketing", status: "active", channel: null, funnelStage: "retargeting", dailyBudget: 20 },
    ],
    campaignDaily: [
      camp("c1", "2026-10-01", { spend: 150, impressions: 15000, conversions: 2, conversionValue: 150, linkClicks: 120 }),
      camp("c2", "2026-10-01", { spend: 50, impressions: 5000, conversions: 4, conversionValue: 450, linkClicks: 80 }),
      camp("c1", "2026-09-28", { spend: 999, impressions: 1, conversions: 0, conversionValue: 0 }),
    ],
  });
  const view = aggregateDashboard(data, { breakEvenRoas: 2 }) as MetaView;
  const kpi = (id: string) => view.kpis.find((k) => k.id === id)!;

  it("KPIs com variação contra o anterior", () => {
    expect(kpi("spend").value).toBe(200);
    expect(kpi("spend").previous).toBe(100);
    expect(kpi("revenue").delta).toBeCloseTo(2);
    expect(kpi("roas").value).toBeCloseTo(3);
    expect(kpi("roas").note).toBe("equilíbrio 2,0");
    expect(kpi("cpa").value).toBeCloseTo(200 / 6);
    expect(kpi("linkCtr").value).toBeCloseTo(200 / 20000);
    expect(kpi("frequency").value).toBeCloseTo(2);
  });
  it("série diária cobre todos os dias, com os 3 últimos em maturação", () => {
    expect(view.daily.map((d) => d.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(view.daily.map((d) => d.maturing)).toEqual([false, true, true, true]);
    expect(kpi("spend").spark).toEqual([100, null, 100, null]);
  });
  it("funil com passagem entre etapas", () => {
    expect(view.funnel.map((s) => s.count)).toEqual([20000, 200, 160, 40, 14, 6]);
    expect(view.funnel[3].rate).toBeCloseTo(40 / 160);
    expect(view.funnel[0].rate).toBeNull();
  });
  it("campanhas só do período atual, por investimento, marcando abaixo do equilíbrio", () => {
    expect(view.campaigns.map((c) => [c.id, c.spend, c.belowBreakEven])).toEqual([
      ["c1", 150, true],
      ["c2", 50, false],
    ]);
    expect(view.campaigns[0].spendShare).toBeCloseTo(0.75);
    expect(view.funnelByStage.map((s) => s.label)).toEqual(["Prospecção", "Remarketing"]);
  });
  it("ocultar investimento tira o valor e tudo de onde ele dá para recalcular", () => {
    const hidden = redactSpend(view);
    for (const id of ["spend", "roas", "cpa", "cpm"]) {
      const k = hidden.kpis.find((x) => x.id === id)!;
      expect([id, k.value, k.previous, k.delta, k.spark.length]).toEqual([id, null, null, null, 0]);
    }
    expect(hidden.extraKpis!.find((k) => k.id === "cpc")!.value).toBeNull();
    expect(hidden.kpis.find((k) => k.id === "revenue")!.value).not.toBeNull();
    expect(hidden.totals.spend).toBeNull();
    expect(hidden.breakEvenRoas).toBeNull();

    // varre a estrutura inteira: nenhum campo derivado do investimento sobra com número
    const walk = (v: unknown, path = "view"): void => {
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
      if (!v || typeof v !== "object") return;
      for (const [k, x] of Object.entries(v)) {
        if (["spend", "roas", "cpa", "cpc", "cpm", "cost", "wastedSpend"].includes(k)) expect([`${path}.${k}`, x]).toEqual([`${path}.${k}`, null]);
        if (k === "belowBreakEven") expect(x).toBe(false);
        walk(x, `${path}.${k}`);
      }
    };
    walk({ ...hidden, kpis: [], extraKpis: [] });
  });

  it("frequência é coerente com o alcance médio por dia", () => {
    const rows = [
      { date: "2026-10-01", impressions: 300, reach: 100 },
      { date: "2026-10-02", impressions: 500, reach: 300 },
    ];
    const mean = reachPerDay(rows)!;
    expect(mean).toBe(200);
    // impressões por dia ÷ alcance médio por dia = o que o card de frequência mostra
    const basic = rows.map((r) => ({ ...r, spend: 0, clicks: 0, conversions: 0, conversionValue: 0 }));
    expect(totalsOf(basic).frequency).toBeCloseTo(800 / 2 / mean);
    expect(reachPerDay([{ date: "2026-10-01", reach: null }])).toBeNull();
  });
});

describe("fadiga de criativo", () => {
  const ad = (date: string, impressions: number, reach: number, linkClicks: number): AdDayRow => ({
    adId: "a",
    date,
    spend: 10,
    impressions,
    reach,
    clicks: linkClicks,
    linkClicks,
    conversions: 0,
    conversionValue: 0,
    videoViews: null,
    videoThruplays: null,
  });
  it("frequência subindo e CTR caindo", () => {
    expect(fatigueOf([ad("2026-10-01", 5000, 4000, 100)], [ad("2026-10-03", 5000, 2500, 60)])).toMatchObject({ frequencyChange: expect.closeTo(0.6), ctrChange: expect.closeTo(-0.4) });
  });
  it("sem queda de CTR não é fadiga", () => {
    expect(fatigueOf([ad("2026-10-01", 5000, 4000, 100)], [ad("2026-10-03", 5000, 2500, 100)])).toBeNull();
  });
});

describe("Google", () => {
  const data = rows({
    platform: "google",
    accountDaily: [day("2026-10-02", { spend: 300, impressions: 3000, clicks: 150, conversions: 3.5, conversionValue: 900 })],
    campaigns: [
      { id: "s", name: "Pesquisa", status: "active", channel: "search", funnelStage: null, dailyBudget: 100 },
      { id: "p", name: "PMax", status: "active", channel: "performance_max", funnelStage: null, dailyBudget: 100 },
    ],
    campaignDaily: [
      camp("s", "2026-10-02", { spend: 100, impressions: 1000, clicks: 100, conversions: 1.5, conversionValue: 200, searchImpressionShare: 0.5, searchLostIsBudget: 0.2, searchLostIsRank: 0.3 }),
      camp("p", "2026-10-02", { spend: 200, impressions: 2000, clicks: 50, conversions: 2, conversionValue: 700 }),
      camp("s", "2026-09-29", { spend: 100, impressions: 800, clicks: 80, searchImpressionShare: 0.4, searchLostIsBudget: 0.3, searchLostIsRank: 0.3 }),
    ],
    searchTermDaily: [
      { campaignId: "s", date: "2026-10-02", searchTerm: "vestido", matchType: "phrase", spend: 40, impressions: 400, clicks: 40, conversions: 1.5, conversionValue: 200 },
      { campaignId: "s", date: "2026-10-03", searchTerm: "grátis", matchType: "broad", spend: 25, impressions: 300, clicks: 20, conversions: 0, conversionValue: 0 },
      { campaignId: "s", date: "2026-10-02", searchTerm: "grátis", matchType: "broad", spend: 5, impressions: 100, clicks: 5, conversions: 0, conversionValue: 0 },
    ],
    breakdownDaily: [
      { date: "2026-10-02", dimension: "hour", value: "09", spend: 10, impressions: 100, clicks: 5, conversions: 1, conversionValue: 100 },
      { date: "2026-10-02", dimension: "device", value: "mobile", spend: 200, impressions: 2000, clicks: 100, conversions: 2, conversionValue: 600 },
      { date: "2026-10-02", dimension: "device", value: "desktop", spend: 100, impressions: 1000, clicks: 50, conversions: 1.5, conversionValue: 300 },
    ],
    products: [{ id: "x", title: "Vestido", category: "Moda", imageUrl: null, price: 199 }],
    productDaily: [{ productId: "x", date: "2026-10-02", spend: 50, impressions: 500, clicks: 10, conversions: 1, conversionValue: 199 }],
  });
  const view = aggregateDashboard(data, { breakEvenRoas: null }) as GoogleView;

  it("parcela de impressões atual e anterior", () => {
    const k = view.kpis.find((x) => x.id === "impressionShare")!;
    expect(k.value).toBeCloseTo(0.5);
    expect(k.previous).toBeCloseTo(0.4);
    expect(view.impressionShare.lostBudget).toBeCloseTo(0.2);
  });
  it("tipos de campanha, dispositivos e mapa de calor", () => {
    expect(view.channels.map((c) => [c.label, c.spendShare])).toEqual([
      ["Performance Max", 200 / 300],
      ["Pesquisa", 100 / 300],
    ]);
    expect(view.devices.map((d) => d.label)).toEqual(["Celular", "Computador"]);
    expect(view.heatmap).toEqual([{ weekday: 5, hour: 9, conversions: 1, value: 100, spend: 10 }]);
  });
  it("termos somados por termo e tipo; desperdício = gasto sem conversão", () => {
    expect(view.searchTerms[0].term).toBe("vestido");
    expect(view.wastedTerms.map((s) => [s.term, s.spend])).toEqual([["grátis", 30]]);
    expect(view.wastedSpend).toBe(30);
    expect(view.wastedShare).toBeCloseTo(0.1);
  });
  it("produtos com ROAS", () => {
    expect(view.products[0]).toMatchObject({ title: "Vestido", value: 199, valueShare: 1 });
    expect(view.products[0].roas).toBeCloseTo(3.98);
  });
  it("sem margem, abaixo do equilíbrio = ROAS menor que 1", () => {
    expect(view.campaigns.every((c) => !c.belowBreakEven)).toBe(true);
  });
});

describe("prévia com o gerador", () => {
  it("monta os dois templates com dados coerentes", () => {
    for (const id of ["meta-ecommerce", "google-ecommerce"]) {
      const d = sampleDashboardData(id, { today: "2026-10-30" })!;
      expect(d.view.hasData).toBe(true);
      expect(d.view.daily).toHaveLength(30);
      const spend = d.view.kpis.find((k) => k.id === "spend")!.value!;
      const campaigns = d.view.campaigns.reduce((a, c) => a + (c.spend ?? 0), 0);
      expect(campaigns).toBeCloseTo(spend, 1);
    }
  });
  it("Meta mostra o criativo cansando; Google, os termos que desperdiçam", () => {
    const meta = sampleDashboardData("meta-ecommerce", { today: "2026-10-30" })!.view as MetaView;
    expect(meta.creatives.some((c) => c.fatigue)).toBe(true);
    const google = sampleDashboardData("google-ecommerce", { today: "2026-10-30" })!.view as GoogleView;
    expect(google.wastedTerms.length).toBeGreaterThan(0);
    expect(google.impressionShare.share).toBeGreaterThan(0);
  });
  it("template desconhecido = null", () => {
    expect(sampleDashboardData("outro")).toBeNull();
  });
});
