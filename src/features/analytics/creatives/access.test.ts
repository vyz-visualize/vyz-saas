import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { creativesLevel, ENTITLEMENTS, LIMIT_ROWS, type Tier } from "@/features/pricing/entitlements";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { PAGES } from "@/features/templates/pages";
import { redactSpend } from "../aggregate";
import { sampleDashboardData } from "../preview";
import type { MetaView } from "../types";
import { cutCreatives } from "./access";
import { creativesHref, parseCreativesQuery } from "./query";
import { sampleCreatives, usesCreativesPage } from "./sample";

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
  const opts = { period: "30d" as const, customDays: 30 };

  it("só nos modelos que usam a Meta", () => {
    expect(usesCreativesPage(dashboardTemplate("criativos-meta")!, ["criativos"])).toBe(true);
    expect(usesCreativesPage(dashboardTemplate("ecommerce-completo")!, ["criativos"])).toBe(true);
    for (const id of ["tiktok-ads", "youtube-video", "google-pesquisa"]) expect([id, usesCreativesPage(dashboardTemplate(id)!, ["criativos"])]).toEqual([id, false]);
  });

  it("sem a página no dashboard, não gera nada", () => {
    expect(sampleCreatives(dashboardTemplate("criativos-meta")!, ["visao-geral"], { tier: "avancado" }, opts)).toBeUndefined();
  });

  it("passam pelo mesmo corte por plano", () => {
    const t = dashboardTemplate("criativos-meta")!;
    expect(sampleCreatives(t, ["criativos"], { tier: "base", upsell: true }, opts)!.gallery).toEqual([]);
    expect(sampleCreatives(t, ["criativos"], { tier: "avancado", tab: "comparativo" }, opts)!.compare.length).toBeGreaterThan(0);
    expect(sampleCreatives(t, ["criativos"], { tier: "avancado", tab: "comparativo" }, { ...opts, hideSpend: true })!.compare[0].days[0].spend).toBeNull();
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
