import { describe, expect, it } from "vitest";
import { LIVE_TEMPLATES } from "@/features/templates/live";
import {
  allowedPages,
  canGoBackTo,
  centsFromReais,
  marginFromPercent,
  parseDecimal,
  platformOptions,
  selectablePlatforms,
  stepIndex,
  templatePages,
  templatesFor,
} from "./steps";

const meta = LIVE_TEMPLATES.find((t) => t.id === "meta-ecommerce")!;
const google = LIVE_TEMPLATES.find((t) => t.id === "google-ecommerce")!;

describe("passos", () => {
  it("segue a ordem e só volta para trás", () => {
    expect(stepIndex("business")).toBe(0);
    expect(stepIndex("done")).toBe(4);
    expect(canGoBackTo("connect", "business")).toBe(true);
    expect(canGoBackTo("connect", "connect")).toBe(false);
    expect(canGoBackTo("platforms", "dashboard")).toBe(false);
    expect(canGoBackTo("done", "business")).toBe(false);
    expect(canGoBackTo("dashboard", "done")).toBe(false);
  });
});

describe("plataformas", () => {
  it("libera só Meta e Google; o resto é em breve ou de outro plano", () => {
    const base = platformOptions("base");
    expect(base.filter((o) => o.available).map((o) => o.id)).toEqual(["meta", "google"]);
    expect(base.find((o) => o.id === "ga4")?.reason).toBe("Em breve");
    expect(base.find((o) => o.id === "tiktok")?.reason).toBe("Disponível no Padrão");
    expect(platformOptions("pro").find((o) => o.id === "tiktok")?.reason).toBe("Em breve");
    expect(base.some((o) => o.id === "crm")).toBe(false);
  });

  it("sem plano nada é escolhível", () => {
    expect(platformOptions(null).some((o) => o.available)).toBe(false);
    expect(selectablePlatforms(["meta"], null)).toEqual([]);
  });

  it("filtra o que veio do cliente e mantém a ordem", () => {
    expect(selectablePlatforms(["google", "ga4", "tiktok", "meta", "x"], "pro")).toEqual(["meta", "google"]);
  });
});

describe("templates e páginas", () => {
  it("casa negócio e plataformas", () => {
    expect(templatesFor("ecommerce", ["meta", "google"]).map((t) => t.id)).toEqual(["meta-ecommerce", "google-ecommerce"]);
    expect(templatesFor("ecommerce", ["google"]).map((t) => t.id)).toEqual(["google-ecommerce"]);
    expect(templatesFor("leads", ["meta"])).toEqual([]);
    expect(templatesFor(null, ["meta"])).toEqual([]);
  });

  it("passa só as páginas do plano", () => {
    expect(allowedPages(meta, "base")).toEqual(["visao-geral", "campanhas", "funil"]);
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
