import { describe, expect, it } from "vitest";
import { sampleLayout } from "./DashboardBody";
import { catalogForTemplate, pageLayout, sampleDefaultKpis } from "./data";
import { GOOGLE_CATALOG, KPI_MAX, META_CATALOG, normalizeScope, normalizeSection, parseMetricPrefs, pickColumns, sampleCatalog, sectionMax, toggleBlock, toggleMetric, visibleIds, withScope } from "./metric-prefs";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { LIVE_TEMPLATES } from "@/features/templates/live";

const meta = (prefs?: Parameters<typeof visibleIds>[2]) => visibleIds(META_CATALOG, "kpis", prefs);

describe("padrão", () => {
  it("cada plataforma começa com os cards de hoje", () => {
    expect(meta()).toEqual(["spend", "revenue", "purchases", "ticket", "cpa", "cpm", "roas", "linkCtr", "frequency"]);
    expect(visibleIds(GOOGLE_CATALOG, "kpis", undefined)).toEqual(["spend", "value", "conversions", "cpa", "cpc", "roas", "ctr", "impressionShare"]);
  });

  it("o padrão do exemplo muda com o nicho", () => {
    const ecommerce = dashboardTemplate("ecommerce-visao-geral")!;
    const imob = dashboardTemplate("imobiliario-leads")!;
    const e = sampleDefaultKpis(ecommerce, ["visao-geral"]);
    const i = sampleDefaultKpis(imob, ["visao-geral"]);
    expect(e).toContain("roas");
    expect(i).toContain("cplq");
    expect(i).not.toContain("roas");
    expect(visibleIds(sampleCatalog("imob", i), "kpis", undefined).sort()).toEqual([...i].sort());
  });

  it("o catálogo certo para cada template", () => {
    const m = LIVE_TEMPLATES.find((t) => t.id === "meta-ecommerce")!;
    const g = LIVE_TEMPLATES.find((t) => t.id === "google-ecommerce")!;
    expect(catalogForTemplate(m, m.pages).scope).toBe("meta");
    expect(catalogForTemplate(g, g.pages).scope).toBe("google");
    expect(catalogForTemplate(dashboardTemplate("ecommerce-visao-geral")!, ["visao-geral"]).scope).toBe("sample");
  });

  it("todo mundo tem explicação e grupo", () => {
    for (const m of [...META_CATALOG, ...GOOGLE_CATALOG, ...sampleCatalog("ecommerce", [])]) expect([m.id, m.help.length > 5, !!m.group]).toEqual([m.id, true, true]);
  });
});

describe("ocultar, mostrar e restaurar", () => {
  it("oculta um padrão e liga um opcional", () => {
    let p = toggleMetric(META_CATALOG, "kpis", undefined, "cpm");
    expect(meta(p)).not.toContain("cpm");
    p = toggleMetric(META_CATALOG, "kpis", p, "reach");
    expect(meta(p)).toContain("reach");
    expect(p).toEqual({ hidden: ["cpm"], shown: ["reach"] });
  });

  it("mostrar de novo volta ao padrão, sem sobrar diferença", () => {
    const off = toggleMetric(META_CATALOG, "kpis", undefined, "cpm");
    expect(toggleMetric(META_CATALOG, "kpis", off, "cpm")).toEqual({ hidden: [], shown: [] });
  });

  it("restaurar tira a plataforma das escolhas e não mexe nas outras", () => {
    const all = { meta: { kpis: { hidden: ["cpm"], shown: [] } }, google: { kpis: { hidden: ["cpc"], shown: [] } } };
    expect(withScope(all, "meta", {})).toEqual({ google: all.google });
    expect(normalizeScope(META_CATALOG, { kpis: { hidden: [], shown: [] } })).toEqual({});
  });
});

describe("mínimo e máximo", () => {
  const onlyOne = { hidden: ["spend", "revenue", "purchases", "ticket", "cpa", "cpm", "linkCtr", "frequency"], shown: [] };

  it("não dá para ocultar a última", () => {
    expect(meta(onlyOne)).toEqual(["roas"]);
    expect(toggleBlock(META_CATALOG, "kpis", onlyOne, "roas")).toBe("min");
    expect(toggleMetric(META_CATALOG, "kpis", onlyOne, "roas")).toBe(onlyOne);
  });

  it("escolha salva que esconderia tudo volta a mostrar uma", () => {
    expect(meta({ hidden: [...onlyOne.hidden, "roas"], shown: [] })).toHaveLength(1);
    expect(visibleIds(META_CATALOG, "kpis", normalizeSection(META_CATALOG, "kpis", { hidden: [...onlyOne.hidden, "roas"], shown: [] }))).toHaveLength(1);
  });

  it("não passa de 10 cards", () => {
    expect(sectionMax(META_CATALOG, "kpis")).toBe(KPI_MAX);
    const p = toggleMetric(META_CATALOG, "kpis", undefined, "reach");
    expect(meta(p)).toHaveLength(10);
    expect(toggleBlock(META_CATALOG, "kpis", p, "clicks")).toBe("max");
    expect(toggleMetric(META_CATALOG, "kpis", p, "clicks")).toBe(p);
    expect(visibleIds(META_CATALOG, "kpis", normalizeSection(META_CATALOG, "kpis", { hidden: [], shown: ["reach", "clicks", "ctr"] }))).toHaveLength(10);
  });

  it("tabelas têm mínimo e não têm máximo", () => {
    expect(sectionMax(META_CATALOG, "columns")).toBeNull();
    const cols = [{ key: "name" }, { key: "a", metric: "cpm" }, { key: "b", metric: "roas" }];
    expect(pickColumns(cols, new Set(["roas"]), () => false).map((c) => c.key)).toEqual(["name", "b"]);
    expect(pickColumns(cols, new Set(["ctr"]), () => false).map((c) => c.key)).toEqual(["name", "a"]);
  });

  it("uma página de exemplo nunca fica sem card", () => {
    const t = dashboardTemplate("ecommerce-visao-geral")!;
    const layout = pageLayout(t, "visao-geral");
    expect(sampleLayout(layout, new Set(), true, []).kpis).toHaveLength(1);
    expect(sampleLayout(layout, new Set(["ctr", ...layout.kpis.map((k) => k.metric)]), true, layout.kpis.map((k) => k.metric)).kpis.at(-1)?.metric).toBe("ctr");
    expect(sampleLayout(layout, new Set(["ctr"]), false, ["cpa"]).kpis.some((k) => k.metric === "ctr")).toBe(false);
  });
});

describe("persistência", () => {
  it("só guarda a diferença e ignora o que não existe", () => {
    expect(normalizeSection(META_CATALOG, "kpis", { hidden: ["cpm", "reach", "inventada"], shown: ["clicks", "spend", "inventada"] })).toEqual({ hidden: ["cpm"], shown: ["clicks"] });
  });

  it("o que vem do banco nunca derruba a página", () => {
    for (const raw of [null, 1, "x", [], { meta: 1 }, { meta: { kpis: "x" } }]) expect(() => visibleIds(META_CATALOG, "kpis", parseMetricPrefs(raw).meta?.kpis)).not.toThrow();
    expect(parseMetricPrefs({ meta: { kpis: { hidden: ["cpm", 2], shown: "x" } } })).toEqual({ meta: { kpis: { hidden: ["cpm"], shown: [] } } });
  });
});

describe("link com investimento oculto", () => {
  it("as derivadas não entram nem se o usuário ligou", () => {
    const shown = visibleIds(META_CATALOG, "kpis", { hidden: [], shown: ["cpc"] }, { hideSpend: true });
    for (const id of ["spend", "cpa", "cpm", "cpc", "roas"]) expect(shown).not.toContain(id);
    expect(shown).toContain("revenue");
  });

  it("só métricas de custo escolhidas: o link cai numa que pode aparecer", () => {
    const allButCost = { hidden: ["revenue", "purchases", "ticket", "linkCtr", "frequency"], shown: [] };
    expect(visibleIds(META_CATALOG, "kpis", allButCost, { hideSpend: true })).toEqual(["revenue"]);
  });

  it("tabela não mantém coluna de custo como reserva", () => {
    const cols = [{ key: "name" }, { key: "a", metric: "cpm" }, { key: "b", metric: "ctr" }];
    expect(pickColumns(cols, new Set(), (id) => id === "cpm").map((c) => c.key)).toEqual(["name", "b"]);
  });
});
