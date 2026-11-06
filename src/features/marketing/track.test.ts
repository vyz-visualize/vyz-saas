// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from "vitest";
import { onTrackedClick, siteTagIds, track, trackedParams } from "./track";

afterEach(() => {
  window.dataLayer = undefined;
  document.body.innerHTML = "";
});

const click = (el: Element) => onTrackedClick({ target: el } as unknown as MouseEvent);

describe("camada de eventos", () => {
  it("cada evento vai para o dataLayer, que nasce se não existir", () => {
    track("hero_cta", { cta: "ver_planos" });
    expect(window.dataLayer).toEqual([{ event: "hero_cta", cta: "ver_planos" }]);
  });

  it("um clique em algo marcado vira evento com os parâmetros dele, mesmo clicando num filho", () => {
    document.body.innerHTML = `<a href="#" data-track="plano_assinar" data-track-plano="pro" data-track-periodo="anual"><span id="filho">Assinar</span></a>`;
    click(document.getElementById("filho")!);
    expect(window.dataLayer).toEqual([{ event: "plano_assinar", plano: "pro", periodo: "anual" }]);
  });

  it("pergunta só conta ao abrir", () => {
    document.body.innerHTML = `<details><summary data-track="faq_abrir" data-track-pergunta="O que é um projeto?">O que é?</summary><p>…</p></details>`;
    const summary = document.querySelector("summary")!;
    click(summary);
    (summary.parentElement as HTMLDetailsElement).open = true;
    click(summary);
    expect(window.dataLayer).toEqual([{ event: "faq_abrir", pergunta: "O que é um projeto?" }]);
  });

  it("clique em algo sem marcação não gera nada", () => {
    document.body.innerHTML = `<button>Nada</button>`;
    click(document.querySelector("button")!);
    expect(window.dataLayer).toBeUndefined();
  });

  it("lê os parâmetros com nomes compostos", () => {
    document.body.innerHTML = `<a data-track="whatsapp_click" data-track-origem="menu" data-track-tipo-botao="primario"></a>`;
    expect(trackedParams(document.querySelector("a")!)).toEqual({ event: "whatsapp_click", params: { origem: "menu", tipoBotao: "primario" } });
  });
});

describe("GTM e Pixel só com ID", () => {
  it("sem ID, nada carrega", () => {
    expect(siteTagIds({})).toEqual({ gtm: null, pixel: null });
    expect(siteTagIds({ gtm: "", pixel: " " })).toEqual({ gtm: null, pixel: null });
  });

  it("com ID válido, carrega; qualquer outra coisa é ignorada (nada estranho entra no HTML)", () => {
    expect(siteTagIds({ gtm: "GTM-ABC1234", pixel: "123456789012345" })).toEqual({ gtm: "GTM-ABC1234", pixel: "123456789012345" });
    expect(siteTagIds({ gtm: "GTM-1');alert(1)//", pixel: "12ab" })).toEqual({ gtm: null, pixel: null });
  });
});
