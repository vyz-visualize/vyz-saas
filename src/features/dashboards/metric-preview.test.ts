// @vitest-environment happy-dom

// A prévia ao vivo no DOM de verdade: abre o painel, liga e desliga sem salvar e
// confere que o contador diz o que a tela desenha. Foi aqui que o erro apareceu:
// as funções estavam certas, mas o painel recebia o catálogo errado.

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveDashboardView } from "@/features/analytics/LiveDashboardView";
import { sampleDashboardData } from "@/features/analytics/preview";
import { DashboardBody, type DashboardSpec } from "./DashboardBody";
import { DEFAULT_SETTINGS } from "./data";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// o dashboard Teste como está no banco: CPM oculto e salvo
const teste: DashboardSpec = {
  templateId: "criativos-meta",
  name: "Teste",
  client: "Loja",
  pages: ["visao-geral", "publico", "criativos", "campanhas", "metas"],
  settings: DEFAULT_SETTINGS,
  metricPrefs: { sample: { kpis: { hidden: ["cpm"], shown: [] } } },
};

let root: Root;
let host: HTMLElement;
const save = vi.fn(async () => ({ ok: true as const }));

const mount = async (el: ReturnType<typeof createElement>) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(el));
};
const sampleCards = () => [...host.querySelectorAll<HTMLElement>("[data-vyz-metric]")].map((e) => e.dataset.vyzMetric);
const counter = () => Number(/^(\d+) de/.exec(document.querySelector('[role="dialog"] [role="status"]')?.textContent ?? "")?.[1]);
const click = async (el: Element | null | undefined) => {
  expect(el).toBeTruthy();
  await act(async () => (el as HTMLElement).click());
};
const openPanel = () => click([...host.querySelectorAll("button")].find((b) => b.textContent?.includes("Personalizar métricas")));
const toggle = (label: string) => click([...document.querySelectorAll('[role="dialog"] li')].find((l) => l.querySelector("label")?.textContent?.startsWith(label))?.querySelector('[role="switch"]'));

beforeEach(() => {
  save.mockClear();
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

describe("prévia não salva", () => {
  it("cada métrica ligada aparece na hora e o contador acompanha, sem gravar nada", async () => {
    await mount(createElement(DashboardBody, { spec: teste, customizeId: "d1", saveMetrics: save }));
    expect(sampleCards()).toEqual(["conversions", "cpa", "ctr"]);
    await openPanel();
    expect(counter()).toBe(3);

    for (const [label, id] of [
      ["Investimento", "spend"],
      ["Impressões", "impressions"],
      ["Cliques", "clicks"],
    ]) {
      await toggle(label);
      expect(sampleCards()).toContain(id);
      expect(counter()).toBe(sampleCards().length);
    }
    expect(counter()).toBe(6);
    expect(save).not.toHaveBeenCalled();
  });

  it("desligar um card da aba também bate, e fechar sem salvar volta ao que estava", async () => {
    await mount(createElement(DashboardBody, { spec: teste, customizeId: "d1", saveMetrics: save }));
    await openPanel();
    await toggle("CTR");
    expect(sampleCards()).toEqual(["conversions", "cpa"]);
    expect(counter()).toBe(2);
    await toggle("Investimento");
    expect(counter()).toBe(sampleCards().length);
    await click(document.querySelector('[role="dialog"] button[aria-label="Fechar sem salvar"]'));
    expect(sampleCards()).toEqual(["conversions", "cpa", "ctr"]);
    expect(save).not.toHaveBeenCalled();
  });

  it("o contador acompanha a aba aberta", async () => {
    await mount(createElement(DashboardBody, { spec: teste, customizeId: "d1", saveMetrics: save }));
    await click([...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === "Campanhas"));
    await openPanel();
    expect(sampleCards()).toContain("spend");
    expect(counter()).toBe(sampleCards().length);
    await toggle("Impressões");
    expect(counter()).toBe(sampleCards().length);
  });

  it("dashboards com dados reais: mesma regra", async () => {
    const data = sampleDashboardData("meta-ecommerce", { today: "2026-10-30" })!;
    await mount(createElement(LiveDashboardView, { data, initialPage: "visao-geral", canCustomize: true, saveMetrics: save }));
    const cards = () => host.querySelectorAll("article").length;
    await openPanel();
    expect(counter()).toBe(cards());
    await toggle("CPM");
    await toggle("Impressões");
    await toggle("Cliques");
    expect(counter()).toBe(cards());
    expect(cards()).toBe(10);
    expect(save).not.toHaveBeenCalled();
  });
});
