import { describe, expect, it } from "vitest";
import { dashboardTemplate } from "@/features/templates/dashboards";
import type { DashboardTemplate } from "@/features/templates/types";
import {
  allowedPages,
  canGoBackTo,
  centsFromReais,
  marginFromPercent,
  activeStepOf,
  allowedFeatures,
  featureOptions,
  layoutOptions,
  layoutProviders,
  canBuildDashboard,
  canContinueFromConnect,
  progressOf,
  STEP_TO_DB,
  ACTION_STEPS,
  accountsSummary,
  cleanReturnUrl,
  EXTRA_PLATFORMS,
  isNamedProject,
  actionNumber,
  parseDecimal,
  stepIndex,
  templatePages,
} from "./steps";

const vyz = dashboardTemplate("vyz-ecommerce")!;
const meta: DashboardTemplate = { ...vyz, sources: ["meta", "instagram", "facebook"] };
const google: DashboardTemplate = { ...vyz, sources: ["google", "ga4"] };

describe("passos do primeiro acesso", () => {
  it("boas-vindas → projeto → conectar → contas → modelo, e só volta para trás", () => {
    expect(stepIndex("welcome")).toBe(0);
    expect(stepIndex("project")).toBe(1);
    expect(stepIndex("connect")).toBe(2);
    expect(stepIndex("setup")).toBe(3);
    expect(stepIndex("model")).toBe(4);
    expect(stepIndex("done")).toBe(5);
    expect(canGoBackTo("model", "setup")).toBe(true);
    expect(canGoBackTo("connect", "welcome")).toBe(true);
    expect(canGoBackTo("connect", "project")).toBe(true);
    expect(canGoBackTo("connect", "connect")).toBe(false);
    expect(canGoBackTo("connect", "setup")).toBe(false);
    expect(canGoBackTo("setup", "qualquer")).toBe(false);
  });

  it("grava no enum antigo do banco, sem migration, e lê de volta", () => {
    // Contas e Modelo dividem o "dashboard" do enum: o Modelo é só da tela (recarregar volta para Contas)
    expect(STEP_TO_DB).toEqual({ welcome: "business", project: "platforms", connect: "connect", setup: "dashboard", model: "dashboard" });
    expect(activeStepOf("business")).toBe("welcome");
    expect(activeStepOf("platforms")).toBe("project");
    expect(activeStepOf("connect")).toBe("connect");
    expect(activeStepOf("dashboard")).toBe("setup");
    // concluído (ou valor estranho) nunca abre um passo no meio
    expect(activeStepOf("done")).toBe("welcome");
  });

  it('a barra conta só os 4 passos de ação (as boas-vindas prometem "quatro passos") e completa ao montar', () => {
    expect(ACTION_STEPS).toEqual(["project", "connect", "setup", "model"]);
    expect((["welcome", "project", "connect", "setup", "model"] as const).map(actionNumber)).toEqual([null, 1, 2, 3, 4]);
    expect((["welcome", "project", "connect", "setup", "model"] as const).map(progressOf)).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
    expect(progressOf("building")).toBe(1);
  });

  it("do conectar só segue com plataforma conectada; sem conta ativa, o dashboard não é criado", () => {
    expect(canContinueFromConnect([])).toBe(false);
    expect(canContinueFromConnect(["meta"])).toBe(true);
    expect(canBuildDashboard(0)).toBe(false);
    expect(canBuildDashboard(1)).toBe(true);
  });
});

describe("recursos", () => {
  it("só os recursos que combinam com as plataformas, com o plano de cada um", () => {
    const meta = featureOptions(["meta"], "pro");
    expect(meta.map((f) => f.id)).toEqual(["metas", "comparativo", "criativos-ao-vivo", "previsao", "mmm"]);
    expect(meta.filter((f) => f.allowed).map((f) => f.id)).toEqual(["metas", "comparativo"]);
    expect(meta.find((f) => f.id === "mmm")?.lockLabel).toBe("Disponível no Avançado");
    expect(featureOptions(["ga4"], "avancado").map((f) => f.id)).toEqual(["comparativo"]);
  });

  it("o servidor aceita só o que o plano libera e combina", () => {
    expect(allowedFeatures(["metas", "mmm", "xyz"], ["meta"], "pro")).toEqual(["metas"]);
    expect(allowedFeatures(["metas", "mmm"], ["meta"], "avancado")).toEqual(["metas", "mmm"]);
    expect(allowedFeatures(["metas"], ["instagram"], "avancado")).toEqual([]);
    expect(allowedFeatures(["metas"], ["meta"], null)).toEqual([]);
  });
});

describe("layouts", () => {
  it("liberados antes dos travados, e os do nicho na frente", () => {
    const opts = layoutOptions("ecommerce", "base");
    expect(opts[0].fits).toBe(true);
    // os 5 visuais no objetivo do nicho; o Básico usa o padrão VYZ e o Lavanda
    expect(opts.map((o) => o.template.id)).toEqual(["vyz-ecommerce", "lavanda-ecommerce", "pulso-ecommerce", "noturno-ecommerce", "areia-ecommerce"]);
    expect(opts.filter((o) => o.allowed).map((o) => o.template.id)).toEqual(["vyz-ecommerce", "lavanda-ecommerce"]);
    const firstLocked = opts.findIndex((o) => o.fits && !o.allowed);
    expect(opts.slice(0, firstLocked).every((o) => o.allowed)).toBe(true);
  });

  it("todo nicho tem layout e o plano acima aparece travado", () => {
    for (const niche of ["leads", "imobiliario", "local", "infoproduto", "saude", "educacao", "agencia"]) {
      expect(layoutOptions(niche, "avancado").some((o) => o.fits)).toBe(true);
    }
    expect(layoutOptions("leads", "base").find((o) => o.template.id === "pulso-leads")?.lockLabel).toBe("Disponível no Padrão");
  });

  it("conectar mostra só Meta e Google que o layout usa", () => {
    expect(layoutProviders(vyz)).toEqual(["meta", "google"]);
    expect(layoutProviders(meta)).toEqual(["meta"]);
    expect(layoutProviders(google)).toEqual(["google"]);
  });
});

describe("templates e páginas", () => {
  it("passa só as páginas do plano", () => {
    const base = allowedPages(vyz, "base");
    expect(base).toEqual(vyz.pages.filter((p) => !["publico", "termos", "criativos-ao-vivo", "previsao", "mmm", "metas", "comparativo"].includes(p)));
    expect(allowedPages(vyz, "pro")).toEqual(vyz.pages.filter((p) => !["criativos-ao-vivo", "previsao", "mmm"].includes(p)));
    expect(allowedPages(vyz, "avancado")).toEqual(vyz.pages);
    expect(allowedPages(vyz, null)).toEqual([]);
    expect(templatePages(vyz, "base").find((p) => p.id === "previsao")?.lockLabel).toBe("Disponível no Avançado");
    expect(templatePages(vyz, "base").find((p) => p.id === "metas")?.lockLabel).toBe("Disponível no Padrão");
  });
});

describe("números digitados", () => {
  it("entende vírgula, ponto e milhar", () => {
    expect(parseDecimal("12,5")).toBe(12.5);
    expect(parseDecimal("12.5")).toBe(12.5);
    expect(parseDecimal("1.500")).toBe(1500);
    expect(parseDecimal("1.500,75")).toBe(1500.75);
    expect(parseDecimal("  ")).toBeNull();
    expect(parseDecimal("abc")).toBeNaN();
  });

  it("margem e meta", () => {
    expect(marginFromPercent("40")).toBe(0.4);
    expect(marginFromPercent("12,5")).toBe(0.125);
    expect(marginFromPercent("")).toBeNull();
    expect(marginFromPercent("0")).toBe("invalid");
    expect(marginFromPercent("120")).toBe("invalid");
    expect(centsFromReais("R$ 45,90")).toBe(4590);
    expect(centsFromReais("")).toBeNull();
    expect(centsFromReais("-3")).toBe("invalid");
  });
});

describe("ajustes do teste real", () => {
  it("volta do login: tira ?conectado= e o #_=_ da Meta, e mantém o resto", () => {
    expect(cleanReturnUrl("https://vyzualize.com.br/comecar?conectado=meta#_=_")).toBe("https://vyzualize.com.br/comecar");
    expect(cleanReturnUrl("https://vyzualize.com.br/comecar?erro=negado&provedor=google")).toBe("https://vyzualize.com.br/comecar");
    expect(cleanReturnUrl("https://vyzualize.com.br/comecar?x=1&conectado=meta#_=_")).toBe("https://vyzualize.com.br/comecar?x=1");
    expect(cleanReturnUrl("https://vyzualize.com.br/comecar")).toBe("https://vyzualize.com.br/comecar");
  });

  it("projeto criado sozinho (nome do workspace ou da pessoa) não vem preenchido", () => {
    expect(isNamedProject("Pedro Freitas", ["Agência", "Pedro Freitas"])).toBe(false);
    expect(isNamedProject("  pedro freitas ", ["Pedro Freitas"])).toBe(false);
    expect(isNamedProject("Agência X", ["Agência X", "Pedro"])).toBe(false);
    expect(isNamedProject("Loja da Ana", ["Agência X", "Pedro"])).toBe(true);
    expect(isNamedProject("", [])).toBe(false);
  });

  it("o rodapé conta o que está na tela (anúncio, Instagram e Página), não a soma escondida", () => {
    expect(accountsSummary([{ platformId: "meta", n: 2 }])).toBe("2 contas no dashboard.");
    expect(accountsSummary([{ platformId: "meta", n: 2 }, { platformId: "instagram", n: 2 }, { platformId: "facebook", n: 2 }])).toBe(
      "6 contas no dashboard: 2 de anúncio do Meta Ads, 2 do Instagram e 2 de Página do Facebook.",
    );
    expect(accountsSummary([{ platformId: "meta", n: 1 }, { platformId: "instagram", n: 0 }])).toBe("1 conta no dashboard.");
  });

  it("mais plataformas: as de docs/PLATAFORMAS.md; Mercado Ads é sempre Em breve; planilha entra por Contas", () => {
    expect(EXTRA_PLATFORMS.map((x) => x.id)).toEqual(["tiktok", "linkedin", "ga4", "rdstation", "hubspot", "pipedrive", "kommo", "planilha", "mercado"]);
    expect(EXTRA_PLATFORMS.find((x) => x.id === "mercado")?.soon).toBe(true);
    expect(EXTRA_PLATFORMS.find((x) => x.id === "planilha")).toMatchObject({ later: "Depois, em Contas" });
  });
});

