// @vitest-environment happy-dom

// O modo personalizar no DOM: adicionar, remover, cancelar, salvar e o que não pode entrar.

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveDashboardView } from "@/features/analytics/LiveDashboardView";
import { sampleDashboardData } from "@/features/analytics/preview";
import { DashboardBody, type DashboardSpec } from "./DashboardBody";
import { DEFAULT_SETTINGS } from "./data";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const teste: DashboardSpec = { templateId: "criativos-meta", name: "Teste", client: "Loja", pages: ["visao-geral", "publico", "criativos", "campanhas"], settings: DEFAULT_SETTINGS, metricPrefs: { sample: { kpis: { hidden: ["cpm"], shown: [] } } } };
const save = vi.fn(async () => ({ ok: true as const }));
let root: Root;
let host: HTMLElement;

const mount = async (el: ReactElement) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(el));
};
const click = async (el: Element | null | undefined) => {
  expect(el).toBeTruthy();
  await act(async () => (el as HTMLElement).click());
};
const sample = (extra = {}) => mount(createElement(DashboardBody, { spec: teste, customizeId: "d1", saveMetrics: save, ...extra }));
const live = (extra = {}) => mount(createElement(LiveDashboardView, { data: sampleDashboardData("meta-ecommerce", { today: "2026-10-30" })!, initialPage: "visao-geral", canCustomize: true, saveMetrics: save, ...extra }));
const button = (text: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text || b.textContent?.includes(text));
const enter = () => click(button("Personalizar métricas"));
const counter = () => document.querySelector("[data-metric-counter]")?.textContent ?? "";
const count = () => Number(/^(\d+) de/.exec(counter())?.[1]);
const cards = () => [...host.querySelectorAll<HTMLElement>("[data-edit-metric]")].map((e) => e.dataset.editMetric);
const emptySlots = () => host.querySelectorAll("[data-empty-slot]").length;
const tray = () => document.querySelector("[data-metric-tray]");
const trayCard = async (label: string) => {
  const find = () => [...document.querySelectorAll<HTMLElement>("[data-tray-metric]")].find((c) => c.querySelector("p")?.textContent?.startsWith(label));
  for (const tab of document.querySelectorAll<HTMLElement>("[data-tray-tab]")) {
    await click(tab);
    if (find()) return find()!;
  }
  return find();
};
const add = async (label: string) => click((await trayCard(label))?.querySelector(`button[aria-label^="Adicionar ${label}"]`));
const remove = (label: string) => click(host.querySelector(`button[aria-label^="Remover ${label}"]`));
const announced = () => [...document.querySelectorAll('[aria-live="polite"].sr-only')].map((e) => e.textContent).join(" ");

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

describe("entrar no modo", () => {
  it("sem painel lateral: faixa, bandeja e encaixes no próprio dashboard", async () => {
    await sample();
    expect(tray()).toBeNull();
    await enter();
    expect(document.querySelector("dialog[open], [role='dialog']")).toBeNull();
    expect(document.querySelector("[data-metric-edit-bar]")?.textContent).toContain("Modo personalizar");
    for (const text of ["Restaurar padrão", "Cancelar", "Salvar"]) expect(button(text)).toBeTruthy();
    expect(tray()).toBeTruthy();
  });

  it("o contador bate com os encaixes: ativos + vazios = 10", async () => {
    await sample();
    await enter();
    expect(counter()).toContain("3 de 10");
    expect(cards()).toHaveLength(3);
    expect(emptySlots()).toBe(7);
    await add("Investimento");
    expect(count()).toBe(cards().length);
    expect(cards().length + emptySlots()).toBe(10);
  });

  it("dados reais: mesma conta", async () => {
    await live();
    await enter();
    expect(cards()).toHaveLength(9);
    expect(emptySlots()).toBe(1);
    expect(count()).toBe(9);
  });

  it("encaixe vazio leva a busca da bandeja", async () => {
    await sample();
    await enter();
    await click(host.querySelector("[data-empty-slot]"));
    expect(document.activeElement).toBe(document.querySelector("[data-metric-search]"));
  });

  it('o alternador diz "Cards" e "Colunas da tabela"', async () => {
    await sample();
    await enter();
    expect([...document.querySelectorAll('[data-metric-tray] [role="radio"]')].map((r) => r.textContent)).toEqual(["Cards", "Colunas da tabela"]);
  });

  it("Período e Comparar ficam desligados no modo", async () => {
    await sample();
    const period = () => button("Últimos 30 dias");
    expect(period()?.closest("[inert]")).toBeNull();
    await enter();
    expect(period()?.closest("[inert]")).toBeTruthy();
  });

  it("quem só visualiza nunca vê o modo", async () => {
    await mount(createElement(DashboardBody, { spec: teste }));
    expect(button("Personalizar métricas")).toBeUndefined();
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    await mount(createElement(LiveDashboardView, { data: sampleDashboardData("meta-ecommerce", { today: "2026-10-30" })!, initialPage: "visao-geral" }));
    expect(button("Personalizar métricas")).toBeUndefined();
    expect(host.querySelector("[data-empty-slot]")).toBeNull();
  });
});

describe("adicionar e remover", () => {
  it("adicionar pelo +: o card entra e o aviso anuncia", async () => {
    await sample();
    await enter();
    await add("Investimento");
    expect(cards()).toContain("spend");
    expect(announced()).toContain("Investimento adicionada, 4 de 10");
  });

  it("remover pelo ✕: o card sai e o aviso anuncia", async () => {
    await sample();
    await enter();
    await remove("CTR");
    expect(cards()).not.toContain("ctr");
    expect(count()).toBe(2);
    expect(announced()).toContain("CTR removida, 2 de 10");
  });

  it("mínimo de 1: o último card fica sem ✕", async () => {
    await sample();
    await enter();
    await remove("CTR");
    await remove("Custo por");
    expect(cards()).toHaveLength(1);
    expect(host.querySelector('button[aria-label^="Remover"]')).toBeNull();
  });

  it("fora do modo continua o olho; no modo, só o ✕", async () => {
    await sample();
    expect(host.querySelector('button[aria-label^="Ocultar"]')).toBeTruthy();
    await enter();
    expect(host.querySelector('button[aria-label^="Ocultar"]')).toBeNull();
    expect(host.querySelector('button[aria-label^="Remover"]')).toBeTruthy();
  });

  it("depois de 10, nada mais entra", async () => {
    await live({ metricPrefs: { meta: { kpis: { hidden: [], shown: ["reach"] } } } });
    await enter();
    expect(count()).toBe(10);
    expect(emptySlots()).toBe(0);
    const card = await trayCard("Cliques no link");
    expect(card?.querySelector('button[aria-label^="Adicionar"]')?.hasAttribute("disabled")).toBe(true);
  });
});

describe("cards apagados", () => {
  it("já em uso: ✓, sem +", async () => {
    await sample();
    await enter();
    const card = await trayCard("CTR");
    expect(card?.querySelector('[role="img"]')?.getAttribute("aria-label")).toContain("em uso");
    expect(card?.querySelector('button[aria-label^="Adicionar"]')).toBeNull();
  });

  it("sem dados: com o aviso, não entra e não arrasta", async () => {
    await sample();
    await enter();
    const card = await trayCard("Leads qualificados");
    expect(card?.textContent).toContain("sem dados nesta conta");
    expect(card?.getAttribute("draggable")).toBe("false");
    await click(card?.querySelector('button[aria-label^="Adicionar"]'));
    expect(cards()).toHaveLength(3);
  });

  it("tipos de resultado diferentes: com o aviso, não entra", async () => {
    await live();
    await enter();
    const card = await trayCard("Resultados");
    expect(card?.textContent).toContain("tipos de resultado diferentes no período");
    await click(card?.querySelector('button[aria-label^="Adicionar"]'));
    expect(count()).toBe(9);
  });
});

describe("rascunho", () => {
  it("Cancelar descarta tudo", async () => {
    await sample();
    await enter();
    await add("Investimento");
    await remove("CTR");
    await click(button("Cancelar"));
    expect(tray()).toBeNull();
    expect(cards()).toEqual(["conversions", "cpa", "ctr"]);
    expect(save).not.toHaveBeenCalled();
  });

  it("Esc também", async () => {
    await sample();
    await enter();
    await add("Investimento");
    await act(async () => void document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(tray()).toBeNull();
    expect(cards()).toEqual(["conversions", "cpa", "ctr"]);
    expect(save).not.toHaveBeenCalled();
  });

  it("Salvar grava e sai do modo", async () => {
    await sample();
    await enter();
    await add("Investimento");
    await click(button("Salvar"));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("d1", "sample", expect.objectContaining({ kpis: expect.objectContaining({ shown: ["spend"], hidden: ["cpm"] }) }));
    expect(tray()).toBeNull();
    expect(cards()).toContain("spend");
  });

  it("Restaurar padrão volta os cards do modelo, sem gravar", async () => {
    await sample();
    await enter();
    await click(button("Restaurar padrão"));
    expect(cards()).toEqual(["conversions", "cpa", "ctr", "cpm"]);
    expect(save).not.toHaveBeenCalled();
  });

  it("trocar de aba mantém o rascunho", async () => {
    await sample();
    await enter();
    await add("Investimento");
    await click([...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === "Campanhas"));
    await click([...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === "Visão geral"));
    expect(cards()).toContain("spend");
  });

  it("aba sem cards: avisa e leva para uma com cards", async () => {
    await sample();
    await enter();
    await click([...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === "Público"));
    expect(counter()).toContain("Esta aba não tem cards");
    await click(button("Ir para a aba com cards"));
    expect(cards().length).toBeGreaterThan(0);
  });
});

describe("colunas da tabela", () => {
  const colunas = () => click([...document.querySelectorAll('[role="radio"]')].find((r) => r.textContent === "Colunas da tabela"));
  const headers = () => [...host.querySelectorAll("thead th")].map((t) => t.textContent);

  it("+ adiciona a coluna e ✕ no cabeçalho remove", async () => {
    await live({ initialPage: "campanhas" });
    await enter();
    await colunas();
    expect(headers().join()).not.toContain("Cadastros");
    await add("Cadastros");
    expect(headers().join()).toContain("Cadastros");
    await click(host.querySelector('thead button[aria-label="Remover coluna Cadastros"]'));
    expect(headers().join()).not.toContain("Cadastros");
  });

  it("os ✕ dos cabeçalhos só aparecem em Colunas", async () => {
    await live({ initialPage: "campanhas" });
    await enter();
    expect(host.querySelector('thead button[aria-label^="Remover coluna"]')).toBeNull();
    await colunas();
    expect(host.querySelector('thead button[aria-label^="Remover coluna"]')).toBeTruthy();
  });
});

describe("arrastar", () => {
  /** O navegador real preenche o dataTransfer; aqui, o mínimo para o mesmo caminho. */
  const dataTransfer = () => {
    const store = new Map<string, string>();
    return { types: [] as string[], setData(t: string, v: string) { store.set(t, v); this.types = [...store.keys()]; }, getData: (t: string) => store.get(t) ?? "", effectAllowed: "", dropEffect: "" };
  };
  const fire = async (el: Element, type: string, dt: ReturnType<typeof dataTransfer>) => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as Event & { dataTransfer: unknown };
    e.dataTransfer = dt;
    await act(async () => void el.dispatchEvent(e));
  };

  it("destaca a fileira inteira, não um encaixe, e soltar adiciona", async () => {
    await sample();
    await enter();
    const dt = dataTransfer();
    const card = (await trayCard("Investimento"))!;
    expect(card.getAttribute("draggable")).toBe("true");
    await fire(card, "dragstart", dt);
    const row = host.querySelector("[data-kpi-row]")!;
    expect(row.textContent).toContain("Solte para adicionar");
    await fire(row, "dragover", dt);
    await fire(row, "drop", dt);
    await fire(card, "dragend", dt);
    expect(cards()).toContain("spend");
    expect(host.textContent).not.toContain("Solte para adicionar");
  });
});

describe("sair com mudança não salva", () => {
  const withLink = (extra = {}) =>
    mount(
      createElement("div", null, createElement("a", { href: "/painel/contas", id: "fora" }, "Contas"), createElement(DashboardBody, { spec: teste, customizeId: "d1", saveMetrics: save, ...extra })),
    );
  const link = () => document.getElementById("fora")!;

  it("sem mudança, o link segue direto", async () => {
    await withLink();
    await enter();
    const seen = vi.fn((e: Event) => e.preventDefault());
    link().addEventListener("click", seen);
    await click(link());
    expect(seen).toHaveBeenCalled();
    expect(document.querySelector("dialog[open], [role='dialog']")).toBeNull();
  });

  it("com mudança, abre a janela própria, sem nada nativo", async () => {
    const nativo = vi.fn();
    Object.assign(window, { confirm: nativo, alert: nativo });
    await withLink();
    await enter();
    await add("Investimento");
    await click(link());
    expect(document.querySelector("dialog[open], [role='dialog']")?.textContent).toContain("Sair sem salvar?");
    expect(nativo).not.toHaveBeenCalled();
    await click(button("Continuar editando"));
    expect(document.querySelector("dialog[open], [role='dialog']")).toBeNull();
    expect(cards()).toContain("spend");
  });

  it("descartar sai e não grava", async () => {
    await withLink();
    await enter();
    await add("Investimento");
    const seen = vi.fn((e: Event) => e.preventDefault());
    link().addEventListener("click", seen);
    await click(link());
    expect(seen).not.toHaveBeenCalled();
    await click(button("Descartar e sair"));
    expect(seen).toHaveBeenCalled();
    expect(tray()).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it("fechar ou recarregar usa o aviso do navegador, só com mudança", async () => {
    await withLink();
    await enter();
    const leave = () => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(leave()).toBe(false);
    await add("Investimento");
    expect(leave()).toBe(true);
    await click(button("Cancelar"));
    expect(leave()).toBe(false);
  });
});

describe("Meta e Google na aba Criativos", () => {
  it('os cards levam "· Meta" no nome; só Meta, não', async () => {
    const { sampleCreatives } = await import("@/features/analytics/creatives/sample");
    const { dashboardTemplate } = await import("@/features/templates/dashboards");
    const load = (id: string) => sampleCreatives(dashboardTemplate(id)!, { name: "T", client: "C", settings: DEFAULT_SETTINGS }, ["criativos"], { tier: "pro" }, { period: "30d", customDays: 30 });
    await mount(createElement(DashboardBody, { spec: { ...teste, templateId: "ecommerce-completo", pages: ["criativos"], metricPrefs: undefined }, creatives: load("ecommerce-completo"), initialPage: "criativos" }));
    const labels = () => [...host.querySelectorAll("[data-edit-metric] p:first-child")].map((p) => p.textContent);
    expect(labels().length).toBe(4);
    for (const l of labels()) expect(l).toMatch(/ · Meta$/);
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    await mount(createElement(DashboardBody, { spec: { ...teste, pages: ["criativos"], metricPrefs: undefined }, creatives: load("criativos-meta"), initialPage: "criativos" }));
    for (const l of labels()) expect(l).not.toContain("· Meta");
  });
});
