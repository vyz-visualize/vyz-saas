import { describe, expect, it } from "vitest";
import { sampleLayout } from "./DashboardBody";
import { catalogForTemplate, pageLayout, sampleDefaultKpis } from "./data";
import { GOOGLE_CATALOG, hideKpi, KPI_MAX, META_CATALOG, normalizeScope, normalizeSection, pageCatalog, pageKpiIds, parseMetricPrefs, pickColumns, sampleCatalog, sectionMax, toggleBlock, toggleMetric, visibleIds, withScope, type SectionPrefs } from "./metric-prefs";
import { DASHBOARD_TEMPLATES, dashboardTemplate } from "@/features/templates/dashboards";
import type { PageId } from "@/features/templates/types";
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

  it("uma aba de exemplo com cards nunca fica sem nenhum", () => {
    const t = dashboardTemplate("ecommerce-visao-geral")!;
    const own = pageLayout(t, "visao-geral").kpis.map((k) => k.metric);
    const catalog = sampleCatalog(t.profile, own);
    const ids = pageKpiIds(catalog, own, { hidden: own, shown: [] });
    expect(ids).toHaveLength(1);
    expect(own).toContain(ids[0]);
  });
});

describe("o contador e os cards sempre batem", () => {
  // o dashboard Teste: 7 cards somando as abas, 4 na Visão geral
  const teste = dashboardTemplate("criativos-meta")!;
  const testePages: PageId[] = ["visao-geral", "publico", "criativos", "campanhas", "metas"];
  const kpisOf = (t: typeof teste, p: PageId) => pageLayout(t, p).kpis.map((k) => k.metric as string);
  const catalogOf = (t: typeof teste, pages: readonly PageId[]) => sampleCatalog(t.profile, sampleDefaultKpis(t, pages));

  /** O que o painel conta e o que a tela desenha, na mesma aba. */
  const both = (t: typeof teste, pages: readonly PageId[], page: PageId, prefs?: SectionPrefs) => {
    const catalog = catalogOf(t, pages);
    const own = kpisOf(t, page);
    return { counter: visibleIds(pageCatalog(catalog, own), "kpis", prefs).length, cards: sampleLayout(pageLayout(t, page), pageKpiIds(catalog, own, prefs)).kpis.length };
  };

  it("o caso do dashboard Teste: conta 4, não 7", () => {
    expect(visibleIds(catalogOf(teste, testePages), "kpis", undefined)).toHaveLength(7);
    expect(both(teste, testePages, "visao-geral")).toEqual({ counter: 4, cards: 4 });
    const catalog = pageCatalog(catalogOf(teste, testePages), kpisOf(teste, "visao-geral"));
    expect(visibleIds(catalog, "kpis", undefined)).not.toContain("spend");
    const on = toggleMetric(catalog, "kpis", undefined, "spend");
    expect(both(teste, testePages, "visao-geral", on)).toEqual({ counter: 5, cards: 5 });
    expect(sampleLayout(pageLayout(teste, "visao-geral"), pageKpiIds(catalogOf(teste, testePages), kpisOf(teste, "visao-geral"), on)).kpis.map((k) => k.metric)).toContain("spend");
  });

  it("em todo modelo, em toda aba com cards e com qualquer escolha", () => {
    let checked = 0;
    for (const t of DASHBOARD_TEMPLATES) {
      for (const page of t.pages) {
        const own = kpisOf(t, page);
        if (!own.length) continue;
        const optional = catalogOf(t, t.pages)
          .filter((m) => !own.includes(m.id))
          .map((m) => m.id);
        const choices: SectionPrefs[] = [
          { hidden: [], shown: [] },
          { hidden: [own[0]], shown: [] },
          { hidden: own, shown: [] },
          { hidden: [], shown: optional.slice(0, 2) },
          { hidden: [own[0]], shown: optional.slice(0, 3) },
          { hidden: [], shown: optional },
        ];
        for (const prefs of choices) {
          const r = both(t, t.pages, page, prefs);
          expect([t.id, page, r.counter]).toEqual([t.id, page, r.cards]);
          expect(r.cards).toBeGreaterThan(0);
          expect(r.cards).toBeLessThanOrEqual(KPI_MAX);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
  });

  it("aba sem fileira de cards continua sem, mesmo com métrica adicionada", () => {
    const catalog = catalogOf(teste, testePages);
    expect(kpisOf(teste, "publico")).toEqual([]);
    expect(pageKpiIds(catalog, [], { hidden: [], shown: ["spend"] })).toEqual([]);
  });

  it("oculto some de todas as abas; adicionado aparece em todas as que têm cards", () => {
    const catalog = catalogOf(teste, testePages);
    const prefs = { hidden: ["cpa"], shown: ["impressions"] };
    for (const page of ["visao-geral", "criativos", "campanhas"] as PageId[]) {
      const ids = pageKpiIds(catalog, kpisOf(teste, page), prefs);
      expect(ids).not.toContain("cpa");
      expect(ids).toContain("impressions");
    }
  });

  it("salvar numa aba não perde o que vale em outra", () => {
    const catalog = catalogOf(teste, testePages);
    const pageKpis = testePages.map((p) => kpisOf(teste, p));
    // spend é card de Campanhas e foi adicionado na Visão geral; frequency é de Criativos e foi oculto
    const kept = normalizeScope(catalog, { kpis: { hidden: ["frequency", "impressions", "inventada"], shown: ["spend", "inventada"] } }, pageKpis);
    expect(kept.kpis).toEqual({ hidden: ["frequency"], shown: ["spend"] });
  });

  it("ocultar pelo card: grava a diferença e barra o último", () => {
    const next = hideKpi(META_CATALOG, "meta", {}, "cpm")!;
    expect(next.meta?.kpis).toEqual({ hidden: ["cpm"], shown: [] });
    const last = { meta: { kpis: { hidden: ["spend", "revenue", "purchases", "ticket", "cpa", "cpm", "linkCtr", "frequency"], shown: [] } } };
    expect(hideKpi(META_CATALOG, "meta", last, "roas")).toBeNull();
    expect(hideKpi(META_CATALOG, "meta", {}, "reach")).toBeNull();
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
