import { describe, expect, it } from "vitest";
import { COMPOSED_PAGES, COMPOSED_SOURCES, COMPOSED_TEMPLATES, composePages, LINKABLE_SOURCES, objectiveForBusiness, VISUALS } from "./composed";
import { BUSINESS_TYPES } from "@/features/catalog/business-types";
import { IMPORT_PLATFORMS } from "@/features/accounts/connection-modes";

describe("páginas pelas contas escolhidas", () => {
  it("só Meta: a visão geral é dela, com criativos, público e funil", () => {
    expect(composePages(["meta"])).toEqual(["visao-geral", "criativos", "publico", "funil"]);
  });
  it("Meta e Google: visão geral unindo, uma página de cada e o funil", () => {
    expect(composePages(["meta", "google"])).toEqual(["visao-geral", "meta-ads", "criativos", "publico", "google-ads", "termos", "funil"]);
  });
  it("com GA4 e anúncios: site e força dos canais", () => {
    expect(composePages(["google", "ga4"])).toEqual(["visao-geral", "google-ads", "termos", "site", "canais-site", "funil"]);
  });
  it("só GA4: começa pelo site, sem a visão geral de anúncios", () => {
    expect(composePages(["ga4"])).toEqual(["site", "funil"]);
  });
  it("Instagram e Página: uma página cada e o conteúdo", () => {
    expect(composePages(["meta", "instagram", "facebook"])).toEqual(["visao-geral", "meta-ads", "criativos", "publico", "instagram", "pagina-facebook", "conteudo", "funil"]);
    expect(composePages(["instagram"])).toEqual(["instagram", "conteudo"]);
  });
  it("recursos escolhidos entram antes do funil, só se combinam com as plataformas", () => {
    expect(composePages(["meta"], ["criativos-ao-vivo", "previsao"])).toEqual(["visao-geral", "criativos", "publico", "criativos-ao-vivo", "previsao", "funil"]);
    expect(composePages(["ga4"], ["criativos-ao-vivo", "comparativo"])).toEqual(["site", "comparativo", "funil"]);
  });
  it("planilha: soma na Visão geral e ganha a página de campanhas", () => {
    const sheet = IMPORT_PLATFORMS[0];
    expect(composePages([sheet])).toEqual(["visao-geral", "campanhas", "funil"]);
    expect(composePages(["meta", sheet])).toEqual(["visao-geral", "meta-ads", "criativos", "publico", "campanhas", "funil"]);
  });
  it("CRM: página própria, cruzada com a mídia quando há anúncios", () => {
    expect(composePages(["meta", "hubspot"])).toEqual(["visao-geral", "meta-ads", "criativos", "publico", "crm", "funil"]);
    expect(composePages(["pipedrive"])).toEqual(["crm"]);
    expect(composePages(["ga4", "kommo", "rdstation"])).toEqual(["site", "crm", "funil"]);
  });
  it("CRMs podem ser ligados, mas não entram na amostra", () => {
    for (const p of ["rdstation", "hubspot", "pipedrive", "kommo"] as const) {
      expect(LINKABLE_SOURCES).toContain(p);
      expect(COMPOSED_SOURCES).not.toContain(p);
    }
  });
  it("sem conta: o básico de exemplo", () => {
    expect(composePages([])).toEqual(["visao-geral", "campanhas", "funil"]);
  });
  it("toda página montada está no modelo (o banco confere)", () => {
    for (const combo of [["meta"], ["meta", "google", "ga4", "instagram", "facebook", "hubspot"], [], ["ga4"], ["kommo"]]) for (const p of composePages(combo)) expect(COMPOSED_PAGES).toContain(p);
  });
});

describe("catálogo dos modelos novos", () => {
  it("5 visuais × cada objetivo, com o plano do visual", () => {
    expect(VISUALS.map((v) => `${v.id}:${v.tier}`)).toEqual(["vyz:base", "lavanda:base", "pulso:pro", "noturno:avancado", "areia:avancado"]);
    expect(COMPOSED_TEMPLATES.length % VISUALS.length).toBe(0);
  });
  it("todo nicho do onboarding tem objetivo", () => {
    for (const b of BUSINESS_TYPES) expect(COMPOSED_TEMPLATES.some((t) => t.composed?.objective === objectiveForBusiness(b.id))).toBe(true);
  });
});
