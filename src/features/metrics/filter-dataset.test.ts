import { describe, expect, it } from "vitest";
import { sampleCreatives, sampleExtras } from "@/features/analytics/creatives/sample";
import { NO_FILTERS, type DashFilters } from "@/features/analytics/filters";
import { datasetFor, DEFAULT_SETTINGS } from "@/features/dashboards/data";
import { DASHBOARD_TEMPLATES, dashboardTemplate } from "@/features/templates/dashboards";
import { addDays } from "@/features/sync/dates";
import { byPlatform, currentTotals, platformPart, previousTotals } from "./compute";
import { filterDataset } from "./filter-dataset";

const TODAY = "2026-10-30";
const spec = { name: "Dashboard de teste", client: "Cliente", settings: DEFAULT_SETTINGS };
const load = (id: string, days = 30) => datasetFor({ templateId: id, ...spec }, days);
const f = (o: Partial<DashFilters>): DashFilters => ({ ...NO_FILTERS, ...o });
const run = (ds: ReturnType<typeof load>, o: Partial<DashFilters>) => filterDataset(ds, f(o), { today: TODAY });
const close = (a: number, b: number, digits = 4) => expect(a).toBeCloseTo(b, digits);

describe("as campanhas fecham com o modelo", () => {
  const all = DASHBOARD_TEMPLATES.flatMap((t) => [7, 30].map((d) => [t.id, d] as const));

  it.each(all)("%s em %i dias", (id, days) => {
    const ds = load(id, days);
    const cur = currentTotals(ds);
    const sum = (list: typeof ds.campaigns, k: "spend" | "impressions" | "clicks" | "conversions" | "revenue") => list.reduce((a, c) => a + c[k], 0);
    if (ds.adPlatforms.length <= 1) {
      expect(sum(ds.campaigns, "spend")).toBe(Math.round(cur.spend));
      expect(sum(ds.campaigns, "impressions")).toBe(Math.round(cur.impressions));
      expect(sum(ds.campaigns, "clicks")).toBe(Math.round(cur.clicks));
      expect(sum(ds.campaigns, "revenue")).toBe(Math.round(cur.revenue));
      return;
    }
    for (const p of byPlatform(ds)) {
      const mine = ds.campaigns.filter((c) => c.platform === p.id);
      if (!mine.length) continue;
      expect(sum(mine, "spend")).toBe(Math.round(p.spend));
      expect(sum(mine, "clicks")).toBe(Math.round(p.clicks));
      expect(sum(mine, "conversions")).toBe(Math.round(p.conv));
    }
  });
});

describe("filtro nas amostras", () => {
  const ds = load("ecommerce-completo");
  const base = currentTotals(ds);
  const one = ds.campaigns[0];

  it("sem filtro é o mesmo Dataset", () => {
    const out = run(ds, {});
    expect(out.active).toBe(false);
    expect(out.ds).toBe(ds);
  });

  it("campanha: os cards fecham com a linha dela, e não passam do total", () => {
    const t = currentTotals(run(ds, { campaigns: [one.id] }).ds);
    close(t.spend, one.spend);
    close(t.impressions, one.impressions);
    close(t.clicks, one.clicks);
    close(t.conversions, one.conversions);
    close(t.revenue, one.revenue, 2);
    expect(t.spend).toBeLessThan(base.spend);
    expect(t.conversions).toBeLessThanOrEqual(base.conversions);
  });

  it("a tabela continua com todas; o gráfico, com o período inteiro", () => {
    const out = run(ds, { campaigns: [one.id] });
    expect(out.ds.campaigns).toHaveLength(ds.campaigns.length);
    expect(out.chart.current).toHaveLength(ds.current.length);
  });

  it("nenhuma seleção passa do total, nem somando plataformas que atribuem a mesma venda", () => {
    const t = currentTotals(run(ds, { campaigns: ds.campaigns.map((c) => c.id) }).ds);
    expect(t.conversions).toBeLessThanOrEqual(base.conversions + 0.01);
    expect(t.spend).toBeLessThanOrEqual(base.spend + 0.01);
  });

  it("plataforma: a mesma parte que o modelo já mostra", () => {
    const t = currentTotals(run(ds, { platforms: ["meta"] }).ds);
    const part = platformPart(ds, "meta", "current");
    close(t.spend, part.spend);
    close(t.clicks, part.clicks);
    close(t.conversions, part.conversions);
    // a receita da campanha é arredondada em centavos
    expect(Math.abs(t.revenue - part.revenue)).toBeLessThan(1);
  });

  it("dias: só o trecho; a comparação usa as mesmas posições do período anterior", () => {
    const n = ds.current.length;
    const from = addDays(TODAY, -ds.current[n - 10].ago);
    const to = addDays(TODAY, -ds.current[n - 6].ago);
    const out = run(ds, { days: { from, to } });
    expect(out.ds.current).toHaveLength(5);
    expect(out.ds.previous).toEqual(ds.previous.slice(n - 10, n - 5));
    expect(out.chart.current).toHaveLength(n);
    expect(currentTotals(out.ds).spend).toBeLessThan(base.spend);
  });

  it("campanha + dias: menor que cada um sozinho", () => {
    const n = ds.current.length;
    const days = { from: addDays(TODAY, -ds.current[n - 10].ago), to: addDays(TODAY, -ds.current[n - 6].ago) };
    const both = currentTotals(run(ds, { campaigns: [one.id], days }).ds).spend;
    expect(both).toBeLessThan(currentTotals(run(ds, { campaigns: [one.id] }).ds).spend);
    expect(both).toBeLessThan(currentTotals(run(ds, { days }).ds).spend);
  });

  it("a comparação usa os mesmos filtros, e as campanhas não têm a mesma variação", () => {
    const delta = (id: string) => {
      const out = run(ds, { campaigns: [id] }).ds;
      return currentTotals(out).spend / previousTotals(out).spend;
    };
    expect(previousTotals(run(ds, { campaigns: [one.id] }).ds).spend).toBeLessThan(previousTotals(ds).spend);
    expect(delta(ds.campaigns[0].id)).not.toBeCloseTo(delta(ds.campaigns[1].id), 3);
  });

  it("frequência é do modelo: não muda com o filtro", () => {
    expect(currentTotals(run(ds, { campaigns: [one.id] }).ds).frequency).toBe(base.frequency);
  });
});

describe("anúncios simulados ligados às campanhas do modelo", () => {
  const metaTemplates = DASHBOARD_TEMPLATES.filter((t) => t.sources.includes("meta"));
  const access = { tier: "avancado" as const, tab: "comparativo" as const };
  const load2 = (id: string, days: 7 | 30) => {
    const t = dashboardTemplate(id)!;
    const ds = load(id, days);
    const opts = { period: days === 7 ? ("7d" as const) : ("30d" as const), customDays: days, today: TODAY };
    return { t, ds, opts, c: sampleCreatives(t, spec, ["criativos"], access, opts)! };
  };
  const cases = metaTemplates.flatMap((t) => [7, 30].map((d) => [t.id, d as 7 | 30] as const));

  it.each(cases)("%s em %i dias: cada campanha da Meta tem anúncios, com o mesmo nome, e eles somam a campanha", (id, days) => {
    const { ds, c } = load2(id, days);
    for (const camp of ds.campaigns.filter((x) => x.platform === "meta")) {
      const ads = c.compare.filter((a) => a.campaignName === camp.name);
      expect(ads.length).toBeGreaterThan(0);
      const rows = ads.flatMap((a) => a.days);
      expect(Math.round(rows.reduce((a, r) => a + r.spend, 0) * 100)).toBe(camp.spend);
      expect(rows.reduce((a, r) => a + r.impressions, 0)).toBe(camp.impressions);
      expect(rows.reduce((a, r) => a + r.clicks, 0)).toBe(camp.clicks);
      expect(c.list.filter((l) => l.campaignName === camp.name).reduce((a, l) => a + l.result.value, 0)).toBe(camp.conversions);
    }
    // nenhum anúncio fora das campanhas do modelo
    const names = new Set(ds.campaigns.map((x) => x.name));
    expect(c.compare.every((a) => names.has(a.campaignName))).toBe(true);
  });

  it("clicar numa campanha filtra a galeria: só os anúncios dela", () => {
    const { t, ds, opts } = load2("ecommerce-completo", 30);
    const camp = ds.campaigns.find((c) => c.platform === "meta")!;
    const c = sampleCreatives(t, spec, ["criativos"], { tier: "avancado" }, { ...opts, filters: f({ campaigns: [camp.id] }) })!;
    expect(c.gallery.length).toBeGreaterThan(0);
    expect(c.gallery.every((g) => g.campaignName === camp.name)).toBe(true);
    expect(Math.round(c.list.reduce((a, l) => a + (l.spend ?? 0), 0) * 100)).toBe(camp.spend);
  });

  it("campanha de outra plataforma: nenhum anúncio da Meta, em vez de todos", () => {
    const { t, ds, opts } = load2("ecommerce-completo", 30);
    const other = ds.campaigns.find((c) => c.platform !== "meta")!;
    const c = sampleCreatives(t, spec, ["criativos"], { tier: "avancado" }, { ...opts, filters: f({ campaigns: [other.id] }) })!;
    expect(c.gallery).toEqual([]);
    expect(c.list).toEqual([]);
  });

  it("anúncio: os cards fecham com os números dele; a galeria continua com todos, para destacar", () => {
    const { t, ds, opts, c } = load2("criativos-meta", 30);
    const ad = c.list[0];
    const out = sampleCreatives(t, spec, ["criativos"], { tier: "avancado" }, { ...opts, filters: f({ ads: [ad.id] }) })!;
    expect(out.gallery.length).toBe(c.list.length);
    const t2 = currentTotals(filterDataset(ds, f({ ads: [ad.id] }), { today: TODAY, adSelection: out.selection }).ds);
    close(t2.spend, ad.spend! * 100, 1);
    close(t2.conversions, ad.result.value, 2);
    expect(t2.spend).toBeLessThan(currentTotals(ds).spend);
  });

  it("dias: a galeria fecha com o trecho dos cards, e o comparativo ignora", () => {
    const { t, ds, opts, c } = load2("criativos-meta", 30);
    const n = ds.current.length;
    const days = { from: addDays(TODAY, -ds.current[n - 10].ago), to: addDays(TODAY, -ds.current[n - 6].ago) };
    const out = sampleCreatives(t, spec, ["criativos"], access, { ...opts, filters: f({ days }) })!;
    const cards = currentTotals(filterDataset(ds, f({ days }), { today: TODAY }).ds);
    expect(Math.abs(out.list.reduce((a, l) => a + (l.spend ?? 0), 0) * 100 - cards.spend)).toBeLessThan(20);
    expect(out.compare).toEqual(c.compare);
  });

  it("métricas novas fecham com a galeria também com filtro", () => {
    const { t, ds, opts } = load2("ecommerce-completo", 30);
    const camp = ds.campaigns.find((c) => c.platform === "meta")!;
    const filters = f({ campaigns: [camp.id] });
    const all = sampleExtras(t, spec, opts).find((x) => x.id === "registrations")!;
    const cut = sampleExtras(t, spec, { ...opts, filters }).find((x) => x.id === "registrations")!;
    expect(cut.value!).toBeLessThan(all.value!);
  });

  it("recorte sem a Meta: as métricas dela ficam sem valor", () => {
    const { t, ds, opts } = load2("ecommerce-completo", 30);
    const other = ds.campaigns.find((c) => c.platform !== "meta")!;
    expect(sampleExtras(t, spec, { ...opts, filters: f({ campaigns: [other.id] }) }).every((x) => x.value == null)).toBe(true);
  });

  it("investimento oculto: a soma do anúncio não leva o valor", () => {
    const { t, opts, c } = load2("criativos-meta", 30);
    const out = sampleCreatives(t, spec, ["criativos"], { tier: "avancado" }, { ...opts, hideSpend: true, filters: f({ ads: [c.list[0].id] }) })!;
    expect(out.selection!.spend).toBe(0);
    expect(out.list.every((l) => l.spend == null)).toBe(true);
  });
});
