import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Tier } from "@/features/pricing/entitlements";
import { Paywall } from "./Paywall";

const render = (current: Tier, required: Tier) =>
  renderToStaticMarkup(createElement(Paywall, { current, required, feature: "Marca própria" } as ComponentProps<typeof Paywall>, createElement("p", null, "conteúdo")));

describe("Paywall", () => {
  it("Personalizado é sob consulta, com o especialista", () => {
    const html = render("base", "personalizado");
    expect(html).toContain("sob consulta");
    expect(html).toContain("Falar com especialista");
    expect(html).not.toContain("Liberar no");
  });

  it("os outros planos seguem com Liberar", () => {
    expect(render("base", "pro")).toContain("Liberar no Padrão");
  });

  it("o plano que cobre o recurso mostra o conteúdo", () => {
    expect(render("personalizado", "personalizado")).toBe("<p>conteúdo</p>");
  });
});
