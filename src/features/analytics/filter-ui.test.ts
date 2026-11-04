// @vitest-environment happy-dom

// O dashboard interativo no DOM: clicar, destacar, chips, URL, teclado e modo personalizar.

import { act, createElement, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardBody, type DashboardSpec } from "@/features/dashboards/DashboardBody";
import { DEFAULT_SETTINGS } from "@/features/dashboards/data";
import { aggregateFiltered } from "./filtered";
import { parseFilters } from "./filters";
import { LiveDashboardView } from "./LiveDashboardView";
import { sampleDashboardData, sampleRows } from "./preview";
import type { LiveDashboardData } from "./types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let host: HTMLElement;
const TODAY = "2026-10-30";

const mount = async (el: ReactElement) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(el));
};
const click = async (el: Element | null | undefined, init: MouseEventInit = {}) => {
  expect(el).toBeTruthy();
  await act(async () => void el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...init })));
};
const chips = () => [...host.querySelectorAll("[data-filter-chip]")].map((c) => c.textContent?.trim());
const bar = () => host.querySelector("[data-filter-bar]");
const announced = () => [...document.querySelectorAll('[aria-live="polite"].sr-only')].map((e) => e.textContent).join(" ");
const button = (text: string) => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes(text));

beforeEach(() => {
  window.history.replaceState(null, "", "/painel/dashboards/d1");
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

describe("dados reais: a URL manda e o servidor refaz a conta", () => {
  const rows = sampleRows("meta", { today: TODAY });
  const base = sampleDashboardData("meta-ecommerce", { today: TODAY })!;
  const dataFor = (search: string): LiveDashboardData => {
    const view = aggregateFiltered(rows, parseFilters(new URLSearchParams(search)), { breakEvenRoas: 2.5 });
    return { ...base, view };
  };
  const firstCampaign = base.view.campaigns[0];

  /** Monta o dashboard com um "servidor": navegar devolve os dados da URL nova, com uma função nova, como na página real. */
  const live = async (search = "", extra = {}) => {
    const seen: string[] = [];
    const Wrapper = () => {
      const [current, setCurrent] = useState(search);
      return createElement(LiveDashboardView, {
        data: dataFor(current),
        initialPage: "visao-geral",
        ...extra,
        filterNavigate: (s: string) => {
          seen.push(s);
          setCurrent(s);
        },
      });
    };
    await mount(createElement(Wrapper));
    return seen;
  };
  const row = (id: string) => host.querySelector(`[data-filter-item="${id}"]`);

  it("sem filtro não há barra; as linhas têm rótulo e funcionam como botão", async () => {
    await live();
    expect(bar()).toBeNull();
    const b = row(firstCampaign.id)!;
    expect(b.tagName).toBe("BUTTON");
    expect(b.getAttribute("aria-label")).toBe(`Filtrar por campanha ${firstCampaign.name}`);
    expect(b.getAttribute("aria-pressed")).toBe("false");
  });

  it("clicar leva o filtro para a URL, mostra o chip e avisa o leitor de tela", async () => {
    const seen = await live();
    await click(row(firstCampaign.id));
    expect(seen).toEqual([`?campanha=${firstCampaign.id}`]);
    expect(chips()[0]).toContain(`Campanha: ${firstCampaign.name}`);
    expect(announced()).toContain(`Filtro aplicado: Campanha ${firstCampaign.name}`);
    expect(row(firstCampaign.id)!.getAttribute("aria-pressed")).toBe("true");
  });

  it("a escolhida fica destacada e as outras esmaecidas", async () => {
    await live();
    await click(row(firstCampaign.id));
    const tones = [...host.querySelectorAll("tr[data-filter-tone]")].map((t) => t.getAttribute("data-filter-tone"));
    expect(tones.filter((t) => t === "selected")).toHaveLength(1);
    expect(tones.filter((t) => t === "dimmed").length).toBeGreaterThan(0);
  });

  it("clicar de novo tira; Cmd/Ctrl soma; o ✕ e o Limpar tudo removem", async () => {
    const other = base.view.campaigns[1];
    const seen = await live();
    await click(row(firstCampaign.id));
    await click(row(firstCampaign.id));
    expect(bar()).toBeNull();
    expect(seen.at(-1)).toBe("");

    await click(row(firstCampaign.id));
    await click(row(other.id), { ctrlKey: true });
    expect(chips()).toHaveLength(2);
    await click(host.querySelector(`[aria-label^="Remover filtro Campanha: ${other.name}"]`));
    expect(chips()).toHaveLength(1);
    await click(row(other.id), { metaKey: true });
    await click(button("Limpar tudo"));
    expect(bar()).toBeNull();
    expect(announced()).toContain("Filtros limpos");
    expect(seen.at(-1)).toBe("");
  });

  it("clicar em qualquer parte da linha também filtra", async () => {
    const seen = await live();
    await click(host.querySelector(`tr:has([data-filter-item="${firstCampaign.id}"]) td`));
    expect(seen).toHaveLength(1);
  });

  it("URL já filtrada: abre com os chips, e o card usa a comparação do trecho", async () => {
    const from = base.view.daily[5].date;
    const to = base.view.daily[9].date;
    await live(`?campanha=${firstCampaign.id}&de=${from}&ate=${to}`);
    expect(chips()).toHaveLength(2);
    expect(chips()[1]).toMatch(/^Dias: .* · vs /);
    expect(host.textContent).toMatch(/vs \d\d–\d\d\/\d\d/);
    expect(host.textContent).toContain("Trecho ");
  });

  it("selo: frequência com duas campanhas; os cards filtrados não têm selo", async () => {
    const other = base.view.campaigns[1];
    await live(`?campanha=${firstCampaign.id},${other.id}`);
    const badges = [...host.querySelectorAll("[data-not-filtered]")].map((b) => b.textContent);
    expect(badges).toContain("não filtrado por Campanha");
    const spend = [...host.querySelectorAll("article")].find((a) => a.textContent?.startsWith("Investimento"));
    expect(spend?.querySelector("[data-not-filtered]")).toBeNull();
  });

  it("recorte sem dados: diz isso e oferece limpar, sem falar em dados chegando", async () => {
    const adOutside = (base.view as { creatives: { id: string; campaignName: string }[] }).creatives.find((c) => c.campaignName !== firstCampaign.name)!;
    const view = aggregateFiltered(rows, parseFilters(new URLSearchParams(`?campanha=${firstCampaign.id}&anuncio=${adOutside.id}`)), { breakEvenRoas: 2.5 });
    await mount(createElement(LiveDashboardView, { data: { ...base, status: "no_data", view }, filterNavigate: () => {} }));
    expect(host.textContent).toContain("Nada com esses filtros");
    expect(host.textContent).not.toContain("Os dados ainda estão chegando");
    expect(button("Limpar filtros")).toBeTruthy();
  });

  it("prévias (sem URL para trocar): nada é clicável", async () => {
    await mount(createElement(LiveDashboardView, { data: base, initialPage: "visao-geral" }));
    expect(host.querySelector("[data-filter-item]")).toBeNull();
    expect(bar()).toBeNull();
  });

  it("modo personalizar: suspende os filtros e devolve ao sair", async () => {
    const seen = await live(`?campanha=${firstCampaign.id}`, { canCustomize: true, saveMetrics: async () => ({ ok: true as const }) });
    expect(chips()).toHaveLength(1);
    await click(button("Personalizar métricas"));
    expect(seen.at(-1)).toBe("");
    expect(bar()).toBeNull();
    expect(host.querySelector("[data-filter-item]")).toBeNull();
    await click(button("Cancelar"));
    expect(seen.at(-1)).toBe(`?campanha=${firstCampaign.id}`);
    expect(chips()).toHaveLength(1);
    expect(host.querySelector("[data-filter-item]")).toBeTruthy();
  });

});

describe("amostras: a conta é no navegador", () => {
  const spec: DashboardSpec = { templateId: "ecommerce-completo", name: "Teste", client: "Loja", pages: ["visao-geral", "campanhas"], settings: DEFAULT_SETTINGS };
  const sample = (extra = {}) => mount(createElement(DashboardBody, { spec, initialPage: "campanhas", ...extra }));
  const item = (id: string) => host.querySelector(`[data-filter-item="${id}"]`);

  it("clicar na campanha troca a URL sem navegar, mostra o chip e muda os cards", async () => {
    await sample();
    const before = host.querySelector("[data-kpi-row]")?.textContent;
    await click(item("c0"));
    expect(window.location.search).toBe("?campanha=c0");
    expect(chips()).toHaveLength(1);
    expect(host.querySelector("[data-kpi-row]")?.textContent).not.toBe(before);
    await click(item("c0"));
    expect(window.location.search).toBe("");
    expect(host.querySelector("[data-kpi-row]")?.textContent).toBe(before);
  });

  it("URL já filtrada abre filtrada", async () => {
    await sample({ initialFilters: parseFilters({ campanha: "c1" }) });
    expect(chips()).toHaveLength(1);
    expect(item("c1")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("a plataforma filtra pela fonte, no topo", async () => {
    await sample();
    await click(item("meta"));
    expect(window.location.search).toBe("?plataforma=meta");
    expect(chips()[0]).toContain("Plataforma: Meta");
  });

  it("widget sem a dimensão mostra o selo e o total", async () => {
    await mount(createElement(DashboardBody, { spec: { ...spec, pages: ["visao-geral", "publico"] }, initialPage: "publico", initialFilters: parseFilters({ campanha: "c0" }) }));
    expect([...host.querySelectorAll("[data-not-filtered]")].map((b) => b.textContent)).toContain("não filtrado por Campanha");
  });

  it("o card de Frequência filtra sem selo, e o valor muda", async () => {
    const criativos: DashboardSpec = { ...spec, templateId: "criativos-meta", pages: ["visao-geral", "criativos"] };
    const card = () => host.querySelector('[data-vyz-metric="frequency"]');
    await mount(createElement(DashboardBody, { spec: criativos, initialPage: "criativos" }));
    const before = card()?.textContent;
    expect(before).toBeTruthy();
    await act(async () => root.unmount());
    await mount(createElement(DashboardBody, { spec: criativos, initialPage: "criativos", initialFilters: parseFilters({ campanha: "c0" }) }));
    expect(card()?.querySelector("[data-not-filtered]")).toBeNull();
    expect(card()?.textContent).not.toBe(before);
  });

  it("o PDF sai com os filtros e os chips no topo", async () => {
    await sample({ printing: true, initialFilters: parseFilters({ campanha: "c0" }) });
    const cover = host.querySelector("[data-print-filters]");
    expect(cover?.textContent).toContain("Filtros ativos");
    expect(cover?.textContent).toContain("Campanha:");
  });

  it("investimento oculto: o card continua escondido com filtro", async () => {
    await sample({ hideSpend: true, initialFilters: parseFilters({ campanha: "c0" }) });
    expect(host.querySelector('[data-vyz-metric="spend"]')?.textContent ?? "").not.toMatch(/R\$\s*\d/);
  });

  it("modo personalizar: os chips somem e voltam", async () => {
    await sample({ customizeId: "d1", saveMetrics: async () => ({ ok: true as const }), initialFilters: parseFilters({ campanha: "c0" }) });
    expect(chips()).toHaveLength(1);
    await click(button("Personalizar métricas"));
    expect(bar()).toBeNull();
    expect(window.location.search).toBe("");
    await click(button("Cancelar"));
    expect(chips()).toHaveLength(1);
    expect(window.location.search).toBe("?campanha=c0");
  });
});
