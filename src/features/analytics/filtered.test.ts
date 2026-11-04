import { describe, expect, it } from "vitest";
import { aggregateDashboard, redactSpend, SPEND_FIELDS, totalsOf } from "./aggregate";
import { aggregateFiltered } from "./filtered";
import { NO_FILTERS, type DashFilters } from "./filters";
import { sampleRows } from "./preview";
import type { GoogleView, Kpi, MetaView, WarehouseRows } from "./types";

const TODAY = "2026-10-31";
const meta = sampleRows("meta", { period: "30d", today: TODAY });
const google = sampleRows("google", { period: "30d", today: TODAY });
const OPTS = { breakEvenRoas: 2.5 };

const f = (o: Partial<DashFilters>): DashFilters => ({ ...NO_FILTERS, ...o });
const run = (rows: WarehouseRows, o: Partial<DashFilters>) => aggregateFiltered(rows, f(o), OPTS);
const kpi = (view: { kpis: Kpi[]; extraKpis?: Kpi[] }, id: string) => [...view.kpis, ...(view.extraKpis ?? [])].find((k) => k.id === id)!;
const inRange = (date: string, r: { from: string; to: string }) => date >= r.from && date <= r.to;
const total = aggregateDashboard(meta, OPTS) as MetaView;
const biggest = total.campaigns[0];
const second = total.campaigns[1];
const days = { from: meta.current.from, to: total.daily[9].date };

describe("sem filtro", () => {
  it("é exatamente o dashboard de sempre", () => {
    expect(aggregateFiltered(meta, NO_FILTERS, OPTS)).toEqual(total);
  });

  it("item de outra conta ou dia fora do período não vira filtro", () => {
    const view = run(meta, { campaigns: ["outra-conta"], ads: ["outro"], platforms: ["google"], days: { from: "2020-01-01", to: "2020-01-02" } });
    expect(view).toEqual(total);
    expect(view.filterInfo).toBeUndefined();
  });
});

describe("campanha", () => {
  const view = run(meta, { campaigns: [biggest.id] }) as MetaView;

  it("os cards fecham com a linha da campanha, e a soma filtrada não passa do total", () => {
    expect(kpi(view, "spend").value).toBeCloseTo(biggest.spend!, 2);
    expect(kpi(view, "revenue").value).toBeCloseTo(biggest.value, 2);
    expect(kpi(view, "purchases").value).toBeCloseTo(biggest.conversions, 2);
    expect(kpi(view, "spend").value!).toBeLessThan(kpi(total, "spend").value!);
    for (const id of ["spend", "revenue", "purchases", "impressions", "clicks"]) expect(kpi(view, id).value!).toBeLessThanOrEqual(kpi(total, id).value! + 0.01);
  });

  it("gráfico por dia e cards são coerentes", () => {
    expect(view.daily.reduce((a, d) => a + (d.spend ?? 0), 0)).toBeCloseTo(biggest.spend!, 1);
    expect(view.daily).toHaveLength(total.daily.length);
  });

  it("a tabela continua com todas, para destacar a escolhida", () => {
    expect(view.campaigns.map((c) => c.id)).toEqual(total.campaigns.map((c) => c.id));
    expect(view.campaigns.find((c) => c.id === biggest.id)!.spend).toBe(biggest.spend);
  });

  it("a galeria mostra só os anúncios da campanha, que somam a campanha", () => {
    const names = new Set(view.creatives.map((c) => c.campaignName));
    expect([...names]).toEqual([biggest.name]);
    expect(view.creativeList.length).toBe(view.creatives.length);
    expect(view.creatives.length).toBeLessThan(total.creatives.length);
  });

  it("o comparativo de criativos ignora o filtro", () => {
    expect(view.creativeDays).toEqual(total.creativeDays);
  });

  it("várias campanhas somam", () => {
    const two = run(meta, { campaigns: [biggest.id, second.id] }) as MetaView;
    expect(kpi(two, "spend").value).toBeCloseTo(biggest.spend! + second.spend!, 2);
    expect(kpi(two, "spend").value!).toBeLessThanOrEqual(kpi(total, "spend").value!);
  });

  it("sem repartir: o que vem da campanha é o que está nas linhas dela", () => {
    const rows = meta.campaignDaily.filter((r) => r.campaignId === biggest.id && inRange(r.date, meta.current));
    expect(view.totals.clicks).toBe(totalsOf(rows).clicks);
    expect(view.totals.impressions).toBe(totalsOf(rows).impressions);
  });
});

describe("selo: o que os dados não têm continua no total", () => {
  it("público, posicionamento e dispositivo não têm campanha", () => {
    const view = run(meta, { campaigns: [biggest.id] }) as MetaView;
    expect(view.ageGender).toEqual(total.ageGender);
    expect(view.placements).toEqual(total.placements);
    expect(view.devices).toEqual(total.devices);
  });

  it("mas respeitam os dias, que eles têm", () => {
    const view = run(meta, { days }) as MetaView;
    expect(view.devices.reduce((a, s) => a + (s.spend ?? 0), 0)).toBeLessThan(total.devices.reduce((a, s) => a + (s.spend ?? 0), 0));
  });

  it("alcance e frequência: exatos com uma campanha, no total com duas", () => {
    const one = run(meta, { campaigns: [biggest.id] });
    expect(kpi(one, "frequency").unfiltered).toBeUndefined();
    expect(kpi(one, "frequency").value).toBeCloseTo(biggest.frequency!, 4);
    const two = run(meta, { campaigns: [biggest.id, second.id] });
    expect(kpi(two, "frequency").unfiltered).toEqual(["campaigns"]);
    expect(kpi(two, "frequency").value).toBe(kpi(total, "frequency").value);
    expect(kpi(two, "reach").unfiltered).toEqual(["campaigns"]);
    // o resto dos cards segue filtrado
    expect(kpi(two, "spend").unfiltered).toBeUndefined();
  });

  it("anúncio: funil e o que depende dele ficam sem esse filtro", () => {
    const ad = total.creatives[0];
    const view = run(meta, { ads: [ad.id] }) as MetaView;
    expect(view.funnel).toEqual(total.funnel);
    expect(view.funnelByStage).toEqual(total.funnelByStage);
    expect(kpi(view, "landingPageViews").unfiltered).toEqual(["ads"]);
    expect(kpi(view, "landingPageViews").value).toBe(kpi(total, "landingPageViews").value);
    expect(kpi(view, "spend").value).toBeCloseTo(ad.spend!, 2);
    expect(kpi(view, "spend").unfiltered).toBeUndefined();
  });

  it("Google: termos respeitam a campanha; produtos e hora não têm essa coluna", () => {
    const base = aggregateDashboard(google, OPTS) as GoogleView;
    const search = base.campaigns.find((c) => c.kind === "search") ?? base.campaigns[0];
    const view = run(google, { campaigns: [search.id] }) as GoogleView;
    expect(view.products).toEqual(base.products);
    expect(view.heatmap).toEqual(base.heatmap);
    expect(view.searchTerms.reduce((a, t) => a + t.clicks, 0)).toBeLessThanOrEqual(base.searchTerms.reduce((a, t) => a + t.clicks, 0));
    expect(view.searchTerms.every((t) => t.campaignName === search.name)).toBe(true);
    expect(kpi(view, "spend").value).toBeCloseTo(search.spend!, 2);
  });
});

describe("combinação", () => {
  const both = run(meta, { campaigns: [biggest.id], days }) as MetaView;
  const onlyCampaign = run(meta, { campaigns: [biggest.id] });

  it("campanha + dias soma só o que cabe nos dois", () => {
    const rows = meta.campaignDaily.filter((r) => r.campaignId === biggest.id && inRange(r.date, days));
    expect(both.totals.spend).toBeCloseTo(totalsOf(rows).spend, 2);
    expect(both.totals.spend!).toBeLessThan(onlyCampaign.totals.spend!);
  });

  it("o gráfico mostra o período inteiro, para destacar o trecho; a sparkline, só o trecho", () => {
    expect(both.daily).toHaveLength(meta.current.days);
    expect(kpi(both, "spend").spark).toHaveLength(10);
  });

  it("anúncio fora da campanha escolhida não soma nada", () => {
    const outside = total.creatives.find((c) => c.campaignName !== biggest.name)!;
    const view = run(meta, { campaigns: [biggest.id], ads: [outside.id] });
    expect(view.hasData).toBe(false);
  });
});

describe("comparação com o período anterior", () => {
  it("usa os mesmos filtros: a campanha no período anterior", () => {
    const view = run(meta, { campaigns: [biggest.id] });
    const prev = meta.campaignDaily.filter((r) => r.campaignId === biggest.id && inRange(r.date, meta.previous));
    expect(kpi(view, "spend").previous).toBeCloseTo(totalsOf(prev).spend, 2);
    expect(kpi(view, "spend").delta).toBeCloseTo(kpi(view, "spend").value! / totalsOf(prev).spend - 1, 6);
  });

  it("um trecho compara com os mesmos dias do período anterior, e informa qual", () => {
    const view = run(meta, { days });
    const compared = view.filterInfo!.compared!;
    expect(compared.from < days.from).toBe(true);
    const prev = meta.accountDaily.filter((r) => inRange(r.date, compared));
    expect(prev).toHaveLength(10);
    expect(kpi(view, "spend").previous).toBeCloseTo(totalsOf(prev).spend, 2);
  });
});

describe("investimento oculto com filtro", () => {
  const leaks = (value: unknown, path = ""): string[] => {
    if (Array.isArray(value)) return value.flatMap((v, i) => leaks(v, `${path}[${i}]`));
    if (!value || typeof value !== "object") return [];
    return Object.entries(value).flatMap(([k, v]) => (SPEND_FIELDS.has(k) && v != null ? [`${path}.${k}`] : leaks(v, `${path}.${k}`)));
  };

  it.each([
    ["campanha", { campaigns: [biggest.id] }],
    ["duas campanhas", { campaigns: [biggest.id, second.id] }],
    ["anúncio", { ads: [total.creatives[0].id] }],
    ["dias", { days }],
    ["campanha + dias", { campaigns: [biggest.id], days }],
  ])("%s: nenhum valor de investimento sai do servidor", (_, filters) => {
    const clean = redactSpend(run(meta, filters));
    expect(leaks(clean)).toEqual([]);
    expect(clean.kpis.find((k) => k.id === "spend")!.value).toBeNull();
    expect(clean.kpis.find((k) => k.id === "roas")!.spark).toEqual([]);
  });

  it("os números que podem aparecer continuam filtrados", () => {
    const clean = redactSpend(run(meta, { campaigns: [biggest.id] }));
    expect(clean.kpis.find((k) => k.id === "revenue")!.value).toBeCloseTo(biggest.value, 2);
    expect(clean.filterInfo!.labels.campaigns![biggest.id]).toBe(biggest.name);
  });
});
