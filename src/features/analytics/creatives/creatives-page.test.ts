// @vitest-environment happy-dom

// A página por plano no DOM: o que cada plano vê e o comparativo funcionando.

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleDashboardData } from "../preview";
import type { CreativesData, MetaView } from "../types";
import { cutCreatives, type CreativesAccess } from "./access";
import { defaultAds } from "./compare";
import { CompareView } from "./CompareView";
import { CreativesPage } from "./CreativesPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("periodo=30d") }));

const cut = (access: CreativesAccess, hideSpend = false): CreativesData => cutCreatives(sampleDashboardData("meta-ecommerce", { today: "2026-10-30" })!.view as MetaView, access, { hideSpend, currency: "BRL" }).creatives!;

let root: Root;
let host: HTMLElement;
const mount = async (el: ReturnType<typeof createElement>) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(el);
    await new Promise((r) => setTimeout(r, 30));
  });
};
const click = async (el: Element | null | undefined) => {
  expect(el).toBeTruthy();
  await act(async () => (el as HTMLElement).click());
};
const button = (text: string, scope: ParentNode = document) => [...scope.querySelectorAll("button")].find((b) => b.textContent?.includes(text));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
});

describe("página por plano", () => {
  it("Básico: lista e, no fim, a amostra da galeria", async () => {
    await mount(createElement(CreativesPage, { data: cut({ tier: "base", upsell: true }) }));
    expect(host.textContent).toContain("Criativos do período");
    expect(host.textContent).toContain("Veja seus criativos em galeria, com preview e ranking");
    expect(host.textContent).toContain("Liberar no Padrão");
    expect(host.querySelector('a[href*="/painel/plano"]')).toBeTruthy();
    expect(host.textContent).not.toContain("Comparativo");
  });

  it("Básico no link compartilhado: lista, sem amostra", async () => {
    await mount(createElement(CreativesPage, { data: cut({ tier: "base", upsell: false }) }));
    expect(host.textContent).toContain("Criativos do período");
    expect(host.textContent).not.toContain("Liberar");
  });

  it("Avançado: abas com URL própria", async () => {
    await mount(createElement(CreativesPage, { data: cut({ tier: "avancado", upsell: true }) }));
    const tabs = [...host.querySelectorAll('nav[aria-label="Criativos"] a')];
    expect(tabs.map((a) => a.textContent)).toEqual(["Galeria", "Comparativo"]);
    expect(tabs[1].getAttribute("href")).toContain("criativos=comparativo");
    expect(host.textContent).not.toContain("Liberar");
  });
});

describe("comparativo", () => {
  const data = cut({ tier: "avancado", tab: "comparativo" });
  const [a, b] = data.compare;
  const withAds = (ids: string[], hide = false) => ({ ...(hide ? cut({ tier: "avancado", tab: "comparativo" }, true) : data), initialAds: ids });

  it("sem anúncios na URL: abre com os 2 de maior investimento e atualiza a URL", async () => {
    window.history.replaceState(null, "", "/painel/dashboards/d1?criativos=comparativo");
    await mount(createElement(CompareView, { data: withAds([]) }));
    const [top1, top2] = defaultAds(data.compare);
    const names = [...host.querySelectorAll("article")].map((e) => e.getAttribute("aria-label"));
    expect(names).toEqual([top1, top2].map((id) => data.compare.find((x) => x.id === id)!.name));
    expect(window.location.search).toContain(`anuncios=${top1},${top2}`);
    expect(host.textContent).toContain("Destaque por objetivo");
  });

  it("dá para remover os pré-selecionados, e a URL acompanha", async () => {
    window.history.replaceState(null, "", "/painel/dashboards/d1?criativos=comparativo");
    await mount(createElement(CompareView, { data: withAds([]) }));
    const [top1, top2] = defaultAds(data.compare);
    await click(host.querySelector('button[title="Remover card"]'));
    expect(host.textContent).toContain("Escolha pelo menos 2 anúncios");
    expect(window.location.search).toContain(`anuncios=${top2}`);
    expect(window.location.search).not.toContain(top1);
  });

  it("com anúncios na URL, não troca nem reescreve", async () => {
    window.history.replaceState(null, "", `/painel/dashboards/d1?anuncios=${b.id},${a.id}`);
    await mount(createElement(CompareView, { data: withAds([b.id, a.id]) }));
    expect([...host.querySelectorAll("article")].map((e) => e.getAttribute("aria-label"))).toEqual([b.name, a.name]);
    expect(window.location.search).toBe(`?anuncios=${b.id},${a.id}`);
  });

  it("a coluna de métricas fica com 35% e as outras dividem o resto", async () => {
    await mount(createElement(CompareView, { data: withAds([a.id, b.id]) }));
    const cols = [...host.querySelectorAll("table colgroup col")] as HTMLElement[];
    expect(cols).toHaveLength(3);
    expect(cols[0].style.width).toBe("35%");
    expect(cols[1].style.width).toBe("");
    expect(host.querySelector("table")!.className).toContain("table-fixed");
  });

  it("com 2 da URL: cards, tabela, destaque e análise", async () => {
    await mount(createElement(CompareView, { data: withAds([a.id, b.id]) }));
    expect(host.querySelectorAll("article")).toHaveLength(2);
    expect(host.textContent).toContain("Destaque por objetivo");
    expect(host.textContent).toContain("menor é melhor");
    expect(host.textContent).toMatch(/vs melhor/);
    expect(host.querySelectorAll('[aria-label="Melhor valor"]').length).toBeGreaterThan(3);
    await click(button("Gerar análise", host));
    expect(host.textContent).toContain("Comparação.");
    expect(button("Copiar texto", host)).toBeTruthy();
  });

  it("alterna Média/dia e Total", async () => {
    await mount(createElement(CompareView, { data: withAds([a.id, b.id]) }));
    const row = () => [...host.querySelectorAll("tbody tr")].find((r) => r.querySelector("th")?.textContent === "Impressões")!.querySelector("td")!.textContent;
    const perDay = row();
    await click([...host.querySelectorAll('[role="radio"]')].find((x) => x.textContent === "Total"));
    expect(row()).not.toBe(perDay);
  });

  it("grupo recolhe", async () => {
    await mount(createElement(CompareView, { data: withAds([a.id, b.id]) }));
    expect(host.textContent).toContain("CPM");
    await click(button("Entrega e alcance", host));
    expect(host.textContent).not.toContain("CPM");
  });

  it("adicionar e remover card", async () => {
    await mount(createElement(CompareView, { data: withAds([a.id, b.id]) }));
    await click(button("Adicionar card (até 3)", host));
    expect(host.textContent).toContain("Escolha um anúncio");
    expect(button("Adicionar card", host)).toBeUndefined();
    await click(host.querySelector('button[aria-label="Remover card"]'));
    expect(button("Adicionar card", host)).toBeTruthy();
  });

  it("aviso quando os objetivos são diferentes", async () => {
    const leads = data.compare.find((x) => x.objective === "OUTCOME_LEADS")!;
    const sales = data.compare.find((x) => x.objective === "OUTCOME_SALES")!;
    await mount(createElement(CompareView, { data: withAds([leads.id, sales.id]) }));
    expect(host.querySelector('[role="note"]')?.textContent).toContain("não para eleger um vencedor");
  });

  it("anúncio de outra conta na URL é ignorado", async () => {
    await mount(createElement(CompareView, { data: withAds(["nao-existe", a.id]) }));
    expect([...host.querySelectorAll("article")].map((e) => e.getAttribute("aria-label"))).toEqual([a.name]);
  });

  it("URL só com anúncio inválido cai no padrão", async () => {
    await mount(createElement(CompareView, { data: withAds(["nao-existe"]) }));
    expect(host.querySelectorAll("article")).toHaveLength(2);
  });

  it("investimento oculto: nada de custo na tela nem na análise", async () => {
    await mount(createElement(CompareView, { data: withAds([a.id, b.id], true) }));
    for (const term of ["Investimento", "CPM", "CPC", "ROAS", "Custo por"]) expect([term, host.textContent?.includes(term)]).toEqual([term, false]);
    await click(button("Gerar análise", host));
    // "R$" pode aparecer no nome do anúncio e em Valor de conversão, que o link mantém: aqui vale o texto gerado
    const analysis = host.querySelector('section[aria-label="Análise"]')!.textContent!;
    for (const name of [a.name, b.name]) expect(analysis).toContain(name);
    expect(analysis.split(a.name).join("").split(b.name).join("")).not.toContain("R$");
  });

  it("as escolhas de Personalizar não entram: mostra todas as métricas", async () => {
    await mount(createElement(CompareView, { data: withAds([a.id, b.id]) }));
    for (const term of ["CTR (todos)", "CPC (todos)", "Alcance médio por dia", "Engajamento no post"]) expect(host.textContent).toContain(term);
  });
});
