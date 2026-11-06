import { describe, expect, it } from "vitest";
import { LIVE_TEMPLATES } from "@/features/templates/live";
import {
  allowedPages,
  canGoBackTo,
  centsFromReais,
  marginFromPercent,
  activeStepOf,
  layoutOptions,
  layoutProviders,
  parseDecimal,
  stepIndex,
  templatePages,
} from "./steps";

const meta = LIVE_TEMPLATES.find((t) => t.id === "meta-ecommerce")!;
const google = LIVE_TEMPLATES.find((t) => t.id === "google-ecommerce")!;

describe("passos", () => {
  it("nicho → layout → conectar, e só volta para trás", () => {
    expect(stepIndex("business")).toBe(0);
    expect(stepIndex("platforms")).toBe(1);
    expect(stepIndex("done")).toBe(3);
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

describe("layouts", () => {
  it("liberados antes dos travados, e os do nicho na frente", () => {
    const opts = layoutOptions("ecommerce", "base");
    expect(opts[0].fits).toBe(true);
    expect(opts.filter((o) => o.allowed).map((o) => o.template.id).sort()).toEqual(["google-ecommerce", "meta-ecommerce", "painel-lavanda", "painel-monocromo", "painel-pulso"]);
    const firstLocked = opts.findIndex((o) => o.fits && !o.allowed);
    expect(opts.slice(0, firstLocked).every((o) => o.allowed)).toBe(true);
  });

  it("todo nicho tem layout e o plano acima aparece travado", () => {
    for (const niche of ["leads", "imobiliario", "local", "infoproduto", "saude", "educacao", "agencia"]) {
      expect(layoutOptions(niche, "avancado").some((o) => o.fits)).toBe(true);
    }
    expect(layoutOptions("leads", "base").find((o) => o.template.id === "leads-visao-geral")?.lockLabel).toBe("Disponível no Padrão");
  });

  it("conectar mostra só Meta e Google que o layout usa", () => {
    expect(layoutProviders(meta)).toEqual(["meta"]);
    expect(layoutProviders(google)).toEqual(["google"]);
  });
});

describe("templates e páginas", () => {
  it("passa só as páginas do plano", () => {
    expect(allowedPages(meta, "base")).toEqual(["visao-geral", "campanhas", "funil", "criativos"]);
    expect(allowedPages(meta, "pro")).toEqual(meta.pages);
    expect(allowedPages(google, "pro")).toEqual(["visao-geral", "campanhas", "termos"]);
    expect(allowedPages(google, "avancado")).toEqual(google.pages);
    expect(allowedPages(google, null)).toEqual([]);
    expect(templatePages(google, "base").find((p) => p.id === "produtos")?.lockLabel).toBe("Disponível no Avançado");
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
