import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { creativesLevel, ENTITLEMENTS, LIMIT_ROWS, type Tier } from "@/features/pricing/entitlements";
import { datasetFor, DEFAULT_SETTINGS } from "@/features/dashboards/data";
import { byPlatform, currentTotals } from "@/features/metrics/compute";
import { DASHBOARD_TEMPLATES, dashboardTemplate } from "@/features/templates/dashboards";
import { PAGES } from "@/features/templates/pages";
import { redactSpend } from "../aggregate";
import { sampleDashboardData, sampleRows } from "../preview";
import type { MetaView } from "../types";
import { cutCreatives } from "./access";
import { adStats, compareTable } from "./compare";
import { creativesHref, parseCreativesQuery } from "./query";
import { metaTotals, sampleCreatives, usesCreativesPage } from "./sample";

const sample = () => sampleDashboardData("meta-ecommerce", { today: "2026-10-30" })!;
const meta = () => sample().view as MetaView;
const ctx = { hideSpend: false, currency: "BRL" };

describe("regras de plano", () => {
  it("vêm dos limites de cada plano", () => {
    expect(ENTITLEMENTS.base.creatives).toBe("list");
    expect(ENTITLEMENTS.pro.creatives).toBe("gallery");
    expect(ENTITLEMENTS.avancado.creatives).toBe("compare");
    expect(ENTITLEMENTS.personalizado.creatives).toBe("compare");
    expect(creativesLevel(null)).toBe("list");
  });

  it("a tabela de planos lê do mesmo lugar", () => {
    const row = LIMIT_ROWS.find((r) => r.label === "Criativos")!;
    expect((["base", "pro", "avancado"] as Tier[]).map(row.value)).toEqual(["lista", "galeria com preview", "galeria + comparativo"]);
  });

  it("a página existe em todos os planos", () => {
    expect(PAGES.criativos.tier).toBe("base");
  });
});

describe("corte por plano", () => {
  it("Básico: só os campos da lista", () => {
    const { creatives, view } = cutCreatives(meta(), { tier: "base", upsell: true }, ctx);
    expect(creatives!.level).toBe("list");
    expect(creatives!.list.length).toBeGreaterThan(5);
    expect(creatives!.gallery).toEqual([]);
    expect(creatives!.compare).toEqual([]);
    expect(Object.keys(creatives!.list[0]).sort()).toEqual(["campaignName", "id", "name", "result", "spend", "status"]);
    expect(view).toMatchObject({ creatives: [], creativeList: [], creativeDays: [] });
    expect(JSON.stringify(creatives)).not.toMatch(/hookRate|ctrSpark|thumbnailUrl|"days"/);
  });

  it("Padrão: galeria, sem os dias por anúncio", () => {
    const { creatives } = cutCreatives(meta(), { tier: "pro", tab: "comparativo", ads: ["a", "b"], upsell: true }, ctx);
    expect(creatives!.level).toBe("gallery");
    expect(creatives!.tab).toBe("galeria");
    expect(creatives!.gallery.length).toBeGreaterThan(5);
    expect(creatives!.compare).toEqual([]);
    expect(creatives!.initialAds).toEqual([]);
  });

  it("Avançado: os dias só vão na aba Comparativo", () => {
    expect(cutCreatives(meta(), { tier: "avancado" }, ctx).creatives!.compare).toEqual([]);
    const { creatives } = cutCreatives(meta(), { tier: "avancado", tab: "comparativo", ads: ["a", "b"] }, ctx);
    expect(creatives!.tab).toBe("comparativo");
    expect(creatives!.compare.length).toBeGreaterThan(5);
    expect(creatives!.compare[0].days[0]).toHaveProperty("postEngagement");
    expect(creatives!.initialAds).toEqual(["a", "b"]);
  });

  it("sem plano informado: só a lista (nunca manda o que não foi pedido)", () => {
    const { creatives, view } = cutCreatives(meta(), {}, ctx);
    expect(creatives!.level).toBe("list");
    expect(JSON.stringify(view)).not.toContain('"days"');
  });

  it("link compartilhado: nunca oferta de plano", () => {
    expect(cutCreatives(meta(), { tier: "base", upsell: false }, ctx).creatives!.upsellTier).toBeNull();
    expect(cutCreatives(meta(), { tier: "base", upsell: true }, ctx).creatives!.upsellTier).toBe("base");
  });

  it("investimento oculto: comparativo e lista saem sem investimento", () => {
    const { creatives } = cutCreatives(redactSpend(meta()), { tier: "avancado", tab: "comparativo" }, { hideSpend: true, currency: "BRL" });
    expect(creatives!.list.every((r) => r.spend == null)).toBe(true);
    expect(creatives!.gallery.every((r) => r.spend == null && r.roas == null)).toBe(true);
    for (const ad of creatives!.compare) for (const d of ad.days) expect(d.spend).toBeNull();
  });

  it("Google não tem página de Criativos", () => {
    const g = sampleDashboardData("google-ecommerce", { today: "2026-10-30" })!;
    expect(cutCreatives(g.view, { tier: "avancado" }, ctx).creatives).toBeUndefined();
  });
});

describe("código do recurso bloqueado", () => {
  const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
  const importsOf = (source: string) => [...source.matchAll(/^import [^;]*from "([^"]+)"/gm)].map((m) => m[1]);

  it("a amostra com blur não importa a galeria nem o comparativo", () => {
    const imports = importsOf(read("./LockedSamples.tsx"));
    for (const name of ["./CreativeGallery", "./CompareView", "./compare", "../aggregate"]) expect(imports).not.toContain(name);
  });

  it("galeria e comparativo são carregados sob demanda", () => {
    const page = read("./CreativesPage.tsx");
    expect(importsOf(page)).not.toContain("./CreativeGallery");
    expect(importsOf(page)).not.toContain("./CompareView");
    expect(page).toContain('import("./CreativeGallery")');
    expect(page).toContain('import("./CompareView")');
  });

  it("a galeria não puxa o comparativo", () => {
    const imports = importsOf(read("./CreativeGallery.tsx"));
    expect(imports).not.toContain("./compare");
    expect(imports).not.toContain("./CompareView");
  });
});

describe("amostras", () => {
  const opts = { period: "30d" as const, customDays: 30, today: "2026-10-30" };
  const spec = { name: "Teste", client: "Loja", settings: DEFAULT_SETTINGS };

  it("só nos modelos que usam a Meta", () => {
    expect(usesCreativesPage(dashboardTemplate("criativos-meta")!, ["criativos"])).toBe(true);
    expect(usesCreativesPage(dashboardTemplate("ecommerce-completo")!, ["criativos"])).toBe(true);
    for (const id of ["tiktok-ads", "youtube-video", "google-pesquisa"]) expect([id, usesCreativesPage(dashboardTemplate(id)!, ["criativos"])]).toEqual([id, false]);
  });

  it("sem a página no dashboard, não gera nada", () => {
    expect(sampleCreatives(dashboardTemplate("criativos-meta")!, spec, ["visao-geral"], { tier: "avancado" }, opts)).toBeUndefined();
  });

  it("passam pelo mesmo corte por plano", () => {
    const t = dashboardTemplate("criativos-meta")!;
    expect(sampleCreatives(t, spec, ["criativos"], { tier: "base", upsell: true }, opts)!.gallery).toEqual([]);
    expect(sampleCreatives(t, spec, ["criativos"], { tier: "avancado", tab: "comparativo" }, opts)!.compare.length).toBeGreaterThan(0);
    expect(sampleCreatives(t, spec, ["criativos"], { tier: "avancado", tab: "comparativo" }, { ...opts, hideSpend: true })!.compare[0].days[0].spend).toBeNull();
  });

  describe("a soma dos anúncios fecha com o modelo", () => {
    const metaTemplates = DASHBOARD_TEMPLATES.filter((t) => t.sources.includes("meta"));
    const s = { name: "Dashboard de teste", client: "Cliente", settings: DEFAULT_SETTINGS };
    const load = (id: string, days: number) => {
      const period = days === 7 ? ("7d" as const) : ("30d" as const);
      const ds = datasetFor({ templateId: id, ...s }, days);
      const c = sampleCreatives(dashboardTemplate(id)!, s, ["criativos"], { tier: "avancado", tab: "comparativo" }, { period, customDays: days, today: "2026-10-30" })!;
      const rows = c.compare.flatMap((a) => a.days);
      const sum = (pick: (r: (typeof rows)[number]) => number | null | undefined) => rows.reduce((acc, r) => acc + Number(pick(r) ?? 0), 0);
      return { ds, c, sum, cur: currentTotals(ds), parts: byPlatform(ds) };
    };
    const onlyMeta = metaTemplates.filter((t) => load(t.id, 30).parts.length === 1);
    const withOthers = metaTemplates.filter((t) => load(t.id, 30).parts.length > 1);
    const days = (list: typeof metaTemplates) => list.flatMap((t) => [7, 30].map((d) => [t.id, d] as const));

    it("cobre os dois casos", () => {
      expect(onlyMeta.length).toBeGreaterThanOrEqual(2);
      expect(withOthers.length).toBeGreaterThan(5);
      expect(onlyMeta.map((t) => t.id)).toContain("criativos-meta");
      expect(withOthers.map((t) => t.id)).toContain("ecommerce-completo");
    });

    it.each(days(onlyMeta))("só Meta: %s em %i dias fecha com os cards", (id, d) => {
      const { c, sum, cur } = load(id, d);
      // investimento (em centavos, como o card), impressões e cliques: exatos
      expect(Math.round(sum((r) => r.spend) * 100)).toBe(Math.round(cur.spend));
      expect(sum((r) => r.impressions)).toBe(Math.round(cur.impressions));
      expect(sum((r) => r.clicks)).toBe(Math.round(cur.clicks));
      // resultados: a coluna da lista, que cada anúncio preenche pelo seu objetivo
      expect(c.list.reduce((acc, r) => acc + (r.result.value ?? 0), 0)).toBe(Math.round(cur.conversions));
      expect(Math.round(c.list.reduce((acc, r) => acc + (r.spend ?? 0), 0) * 100)).toBe(Math.round(cur.spend));
      // as razões dos cards da aba Criativos saem iguais da soma
      expect(sum((r) => r.clicks) / sum((r) => r.impressions)).toBeCloseTo(cur.ctr, 6);
      expect((sum((r) => r.spend) * 100) / sum((r) => r.impressions)).toBeCloseTo(cur.cpm / 1000, 6);
      expect(sum((r) => r.impressions) / sum((r) => r.reach)).toBeCloseTo(cur.frequency, 1);
    });

    it.each(days(withOthers))("Meta e outras: %s em %i dias fecha com a parte da Meta", (id, d) => {
      const { c, sum, cur, parts } = load(id, d);
      const meta = parts.find((p) => p.id === "meta")!;
      expect(Math.round(sum((r) => r.spend) * 100)).toBe(Math.round(meta.spend));
      expect(sum((r) => r.impressions)).toBe(Math.round(meta.impressions));
      expect(sum((r) => r.clicks)).toBe(Math.round(meta.clicks));
      expect(c.list.reduce((acc, r) => acc + (r.result.value ?? 0), 0)).toBe(Math.round(meta.conv));
      expect(Math.round(c.list.reduce((acc, r) => acc + (r.spend ?? 0), 0) * 100)).toBe(Math.round(meta.spend));
      // é a parte, não o total das plataformas
      expect(sum((r) => r.spend) * 100).toBeLessThan(cur.spend);
      expect(sum((r) => r.impressions)).toBeLessThan(cur.impressions);
      // o CTR dos anúncios é o da Meta no modelo
      expect(sum((r) => r.clicks) / sum((r) => r.impressions)).toBeCloseTo(meta.ctr, 6);
    });

    it("o card mostra a mesma parte que os anúncios somam", () => {
      const { c, parts, ds } = load("ecommerce-completo", 30);
      const meta = parts.find((p) => p.id === "meta")!;
      expect(byPlatform(ds).find((p) => p.id === "meta")!.conv).toBe(meta.conv);
      expect(c.list.reduce((acc, r) => acc + (r.result.value ?? 0), 0)).toBe(meta.conv);
    });

    it("receita da parte da Meta: proporcional às compras atribuídas", () => {
      const { ds, cur, parts, sum } = load("ecommerce-completo", 30);
      const meta = parts.find((p) => p.id === "meta")!;
      const attributed = parts.reduce((a, p) => a + p.conv, 0);
      expect(metaTotals(ds).revenue).toBeCloseTo((cur.revenue * meta.conv) / attributed, 6);
      expect(Math.round(sum((r) => r.conversionValue) * 100)).toBe(Math.round(metaTotals(ds).revenue));
    });

    it("alcance nunca passa de impressões e o cliques no link nunca passa de cliques", () => {
      const c = sampleCreatives(dashboardTemplate("criativos-meta")!, spec, ["criativos"], { tier: "avancado", tab: "comparativo" }, opts)!;
      for (const r of c.compare.flatMap((a) => a.days)) {
        expect(r.reach ?? 0).toBeLessThanOrEqual(r.impressions);
        expect(r.linkClicks ?? 0).toBeLessThanOrEqual(r.clicks);
      }
    });

    it("o gerador da Meta continua igual: só a amostra é escalada", () => {
      const before = sampleRows("meta", { today: "2026-10-30" }).adDaily.slice(0, 50);
      sampleCreatives(dashboardTemplate("criativos-meta")!, spec, ["criativos"], { tier: "avancado" }, opts);
      expect(sampleRows("meta", { today: "2026-10-30" }).adDaily.slice(0, 50)).toEqual(before);
    });

    it("modelo sem receita: sem ROAS nem valor por anúncio", () => {
      const t = dashboardTemplate("criativos-meta")!;
      expect(currentTotals(datasetFor({ templateId: t.id, ...spec }, 30)).revenue).toBe(0);
      const c = sampleCreatives(t, spec, ["criativos"], { tier: "avancado", tab: "comparativo" }, opts)!;
      expect(c.gallery.every((g) => g.roas == null)).toBe(true);
      const ids = compareTable(c.compare.slice(0, 2).map(adStats), "total").flatMap((g) => g.rows.map((r) => r.metric.id));
      expect(ids).not.toContain("roas");
      expect(ids).not.toContain("value");
    });

    it("sem investimento oculto escapando na amostra escalada", () => {
      const c = sampleCreatives(dashboardTemplate("ecommerce-completo")!, spec, ["criativos"], { tier: "avancado", tab: "comparativo" }, { ...opts, hideSpend: true })!;
      expect(c.list.every((r) => r.spend == null)).toBe(true);
      expect(c.compare.flatMap((a) => a.days).every((d) => d.spend == null)).toBe(true);
    });
  });
});

describe("endereço", () => {
  it("lê aba e anúncios, e ignora o que não vale", () => {
    expect(parseCreativesQuery({ pagina: "criativos", criativos: "comparativo", anuncios: "a1,b2,a1,<x>,c3,d4" })).toEqual({ page: "criativos", tab: "comparativo", ads: ["a1", "b2", "c3"] });
    expect(parseCreativesQuery({}).tab).toBe("galeria");
    expect(parseCreativesQuery({ criativos: "outra" }).tab).toBe("galeria");
  });

  it("mantém o período", () => {
    expect(creativesHref("periodo=7d", "comparativo", ["a", "b"])).toBe("?periodo=7d&pagina=criativos&criativos=comparativo&anuncios=a,b");
    expect(creativesHref("periodo=7d&criativos=comparativo&anuncios=a", "galeria")).toBe("?periodo=7d&criativos=&pagina=criativos".replace("criativos=&", ""));
  });
});
