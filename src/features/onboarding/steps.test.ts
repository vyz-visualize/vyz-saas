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
  screenStep,
  layoutProviders,
  parseDecimal,
  stepIndex,
  templatePages,
} from "./steps";

const vyz = dashboardTemplate("vyz-ecommerce")!;
const meta: DashboardTemplate = { ...vyz, sources: ["meta", "instagram", "facebook"] };
const google: DashboardTemplate = { ...vyz, sources: ["google", "ga4"] };

describe("passos", () => {
  it("segmento → visual → conectar → recursos e marca, e só volta para trás", () => {
    expect(stepIndex("business")).toBe(0);
    expect(stepIndex("platforms")).toBe(1);
    expect(stepIndex("connect")).toBe(2);
    expect(stepIndex("finish")).toBe(3);
    expect(stepIndex("done")).toBe(4);
    expect(canGoBackTo("connect", "finish")).toBe(false);
    expect(canGoBackTo("connect", "business")).toBe(true);
    expect(canGoBackTo("connect", "platforms")).toBe(true);
    expect(canGoBackTo("connect", "connect")).toBe(false);
    expect(canGoBackTo("done", "business")).toBe(false);
  });

  it("o passo antigo de dashboard vale como conectar", () => {
    expect(activeStepOf("dashboard")).toBe("connect");
    expect(stepIndex("dashboard")).toBe(2);
  });
});

describe("recursos e marca", () => {
  it("abre pela URL só no fim do conectar (recarregar continua nele)", () => {
    expect(screenStep("connect", "recursos")).toBe("finish");
    expect(screenStep("dashboard", "recursos")).toBe("finish");
    expect(screenStep("connect", undefined)).toBe("connect");
    expect(screenStep("platforms", "recursos")).toBe("platforms");
  });

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
