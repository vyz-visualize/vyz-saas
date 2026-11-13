import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Odometer, zeroed } from "./Odometer";

describe("número animado (Odometer) para leitor de tela", () => {
  it("a fita de dígitos não é texto da página; o leitor lê só o valor final", () => {
    const html = renderToStaticMarkup(createElement(Odometer, { value: zeroed("R$ 61,0 mil"), label: "R$ 61,0 mil" }));
    // a contagem começa zerada, mas o leitor ouve o valor final
    expect(html).toContain('<span class="sr-only">R$ 61,0 mil</span>');
    // as colunas ficam escondidas e sem texto (a fita vem do CSS)
    expect(html).toMatch(/class="odo-track" aria-hidden="true"/);
    const track = html.slice(html.indexOf("<span class=\"odo-track\""));
    // sem nenhum dígito como texto: nem a fita 0 a 9, nem os zeros da contagem
    expect(track.replace(/<[^>]+>/g, "")).not.toMatch(/\d/);
  });
});
