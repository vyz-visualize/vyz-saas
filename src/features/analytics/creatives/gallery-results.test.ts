// @vitest-environment happy-dom

// Galeria e lista: o resultado segue o objetivo da campanha, ROAS só com receita.

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aggregateDashboard, redactSpend } from "../aggregate";
import { sampleRows } from "../preview";
import type { CompareAd, CreativeVM, MetaView, WarehouseRows } from "../types";
import { CreativeGallery } from "./CreativeGallery";
import { CreativeList } from "./CreativeList";
import { adStats, compareTable, type AdStats } from "./compare";
import { COMPARE_METRICS, RETENTION_HELP } from "./metrics";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let host: HTMLElement;
const mount = async (el: ReactElement) => {
  host = document.createElement("div");
  document.body.append(host);
  const next = createRoot(host);
  root = next;
  await act(async () => next.render(el));
};

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
  await act(async () => root?.unmount());
  root = undefined;
  document.body.innerHTML = "";
});

/** As linhas do simulador, sem receita nas campanhas de um objetivo. */
const rows = sampleRows("meta", { today: "2026-10-30" });
const objectiveOf = new Map(rows.campaigns.map((c) => [c.id, c.objective ?? null]));
const campaignOf = new Map(rows.ads.map((a) => [a.id, a.campaignId]));
const noRevenueIn = (objective: string): WarehouseRows => ({
  ...rows,
  adDaily: rows.adDaily.map((r) => (objectiveOf.get(campaignOf.get(r.adId) ?? "") === objective ? { ...r, conversionValue: 0 } : r)),
});
const view = (r: WarehouseRows) => aggregateDashboard(r, { breakEvenRoas: 2.5 }) as MetaView;
const adsOf = (v: MetaView, objective: string) => v.creatives.filter((c) => objectiveOf.get(campaignOf.get(c.id) ?? "") === objective);

describe("resultado de cada anúncio", () => {
  const v = view(noRevenueIn("OUTCOME_LEADS"));

  it("segue o objetivo da campanha, nos dados da galeria e da lista", () => {
    expect(adsOf(v, "OUTCOME_LEADS").length).toBeGreaterThan(0);
    for (const ad of adsOf(v, "OUTCOME_LEADS")) {
      expect(ad.result.label).toBe("leads");
      expect(v.creativeList.find((l) => l.id === ad.id)!.result).toEqual(ad.result);
    }
    expect(adsOf(v, "OUTCOME_ENGAGEMENT").every((a) => a.result.label === "interações")).toBe(true);
    expect(v.creatives.filter((c) => c.result.label === "compras").length).toBeGreaterThan(0);
  });

  it("sem o dado do resultado: sem valor, nunca 0, e sem custo por resultado", () => {
    const missing = view({ ...rows, adDaily: rows.adDaily.map((r) => ({ ...r, leads: null, postEngagement: null })) });
    for (const ad of adsOf(missing, "OUTCOME_LEADS")) {
      expect(ad.result).toEqual({ label: "leads", value: null });
      expect(ad.costPerResult).toBeNull();
      expect(missing.creativeList.find((l) => l.id === ad.id)!.result).toEqual({ label: "leads", value: null });
    }
    for (const ad of adsOf(missing, "OUTCOME_ENGAGEMENT")) expect(ad.result).toEqual({ label: "interações", value: null });
  });

  it("custo por resultado: investimento ÷ resultado", () => {
    const ad = adsOf(v, "OUTCOME_LEADS").find((a) => (a.result.value ?? 0) > 0)!;
    expect(ad.costPerResult).toBeCloseTo(ad.spend! / ad.result.value!, 6);
  });

  it("receita é da campanha: sem receita, não há ROAS", () => {
    expect(adsOf(v, "OUTCOME_LEADS").every((a) => !a.hasRevenue)).toBe(true);
    expect(v.creatives.some((a) => a.hasRevenue)).toBe(true);
  });

  it("investimento oculto: o custo por resultado não sai do servidor", () => {
    const clean = redactSpend(v);
    expect(clean.creatives.every((c) => c.costPerResult == null)).toBe(true);
    expect(clean.creatives.some((c) => (c.result.value ?? 0) > 0)).toBe(true);
  });
});

describe("na tela", () => {
  const card = (extra: Partial<CreativeVM>): CreativeVM => ({
    id: "a1",
    name: "Anúncio",
    campaignName: "Campanha",
    format: "video",
    status: "active",
    headline: null,
    thumbnailUrl: null,
    spend: 500,
    value: 0,
    conversions: 0,
    roas: 0,
    result: { label: "leads", value: 25 },
    costPerResult: 20,
    hasRevenue: false,
    linkCtr: 0.01,
    frequency: 1.5,
    hookRate: 0.32,
    holdRate: null,
    fatigue: null,
    ctrSpark: [],
    ...extra,
  });
  const gallery = (list: CreativeVM[], hideSpend = false) => mount(createElement(CreativeGallery, { data: { gallery: list, hideSpend, currency: "BRL", breakEvenRoas: 2.5 } }));
  const labels = () => [...host.querySelectorAll("dt")].map((d) => d.textContent);

  it("campanha de leads sem receita: Leads e Custo por resultado, sem Compras nem ROAS", async () => {
    await gallery([card({})]);
    expect(labels()).toEqual(expect.arrayContaining(["Leads", "Custo por resultado"]));
    expect(labels()).not.toContain("Compras");
    expect(labels()).not.toContain("ROAS");
    expect(host.textContent).toContain("25");
    expect(host.textContent).toContain("R$ 20");
  });

  it("campanha de vendas com receita: Compras e ROAS", async () => {
    await gallery([card({ result: { label: "compras", value: 12 }, hasRevenue: true, roas: 3.2, value: 1600, conversions: 12 })]);
    expect(labels()).toEqual(expect.arrayContaining(["Compras", "ROAS"]));
    expect(labels()).not.toContain("Custo por resultado");
  });

  it("engajamento: Interações", async () => {
    await gallery([card({ result: { label: "interações", value: 80 } })]);
    expect(labels()).toContain("Interações");
  });

  it('sem o dado do resultado, o card mostra "—", nunca 0', async () => {
    await gallery([card({ result: { label: "leads", value: null }, costPerResult: null })]);
    const dd = [...host.querySelectorAll("dt")].find((d) => d.textContent === "Leads")!.nextElementSibling!;
    expect(dd.textContent).toBe("—");
    const cost = [...host.querySelectorAll("dt")].find((d) => d.textContent === "Custo por resultado")!.nextElementSibling!;
    expect(cost.textContent).toBe("—");
  });

  it("ordenar por ROAS só existe com receita em alguma campanha", async () => {
    await gallery([card({})]);
    expect(host.textContent).not.toMatch(/InvestimentoROAS/);
    await act(async () => root?.unmount());
    root = undefined;
    await gallery([card({}), card({ id: "a2", hasRevenue: true, roas: 2 })]);
    expect(host.textContent).toContain("ROAS");
  });

  it("investimento oculto: nem ROAS nem custo por resultado", async () => {
    await gallery([card({ spend: null, costPerResult: null })], true);
    expect(labels()).not.toContain("Custo por resultado");
    expect(labels()).toContain("Leads");
  });

  describe('"Retenção 3 s" no lugar de "Hook rate"', () => {
    const TEXT = "% de quem assistiu pelo menos 3 segundos";
    const help = () => host.querySelector<HTMLElement>("[data-metric-help]")!;
    const note = () => host.querySelector("[data-metric-help-note]")?.textContent;
    const fire = (type: string, pointerType: string) => act(async () => void help().dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType, relatedTarget: document.body })));

    it("tem o nome novo e o ⓘ, sem o title do navegador", async () => {
      await gallery([card({})]);
      expect(labels()).toContain("Retenção 3 s");
      expect(host.textContent).not.toContain("Hook rate");
      expect(help().getAttribute("aria-label")).toBe("O que é Retenção 3 s");
      expect(host.querySelector(`[title="${TEXT}"]`)).toBeNull();
      expect(note()).toBeUndefined();
    });

    it("no toque: tocar abre e tocar de novo fecha", async () => {
      await gallery([card({})]);
      await act(async () => help().click());
      expect(note()).toBe(TEXT);
      expect(help().getAttribute("aria-expanded")).toBe("true");
      await act(async () => help().click());
      expect(note()).toBeUndefined();
    });

    it("com o mouse: passar por cima mostra, e sair esconde", async () => {
      await gallery([card({})]);
      await fire("pointerover", "mouse");
      expect(note()).toBe(TEXT);
      await fire("pointerout", "mouse");
      expect(note()).toBeUndefined();
    });

    it("no toque, o foco chega junto com o clique e não fecha o que acabou de abrir", async () => {
      await gallery([card({})]);
      // foco de toque: não é :focus-visible
      help().matches = () => false;
      await act(async () => void help().dispatchEvent(new FocusEvent("focusin", { bubbles: true })));
      await act(async () => help().click());
      expect(note()).toBe(TEXT);
    });

    it("no teclado, o foco mostra e sair esconde", async () => {
      await gallery([card({})]);
      help().matches = () => true;
      await act(async () => void help().dispatchEvent(new FocusEvent("focusin", { bubbles: true })));
      expect(note()).toBe(TEXT);
      await act(async () => void help().dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
      expect(note()).toBeUndefined();
    });

    it("o toque em si não abre por passar por cima: só o clique", async () => {
      await gallery([card({})]);
      await fire("pointerover", "touch");
      expect(note()).toBeUndefined();
    });
  });

  it("comparativo usa o mesmo nome e a mesma explicação", () => {
    const m = COMPARE_METRICS.find((x) => x.id === "hookRate")!;
    expect(m.label).toBe("Retenção 3 s");
    expect(m.help).toBe(RETENTION_HELP);
  });

  it("a lista mostra o traço quando falta o dado", async () => {
    await mount(createElement(CreativeList, { rows: [{ id: "a1", name: "Anúncio", campaignName: "Campanha", status: "active", spend: 100, result: { label: "leads", value: null } }], currency: "BRL", hideSpend: false }));
    expect(host.textContent).toContain("— leads");
  });

  it("a lista mostra o resultado do objetivo", async () => {
    await mount(createElement(CreativeList, { rows: [{ id: "a1", name: "Anúncio", campaignName: "Campanha", status: "active", spend: 100, result: { label: "leads", value: 7 } }], currency: "BRL", hideSpend: false }));
    expect(host.textContent).toContain("leads");
    expect(host.textContent).not.toContain("compras");
  });
});

describe("linha de resultado do comparativo", () => {
  const ad = (id: string, objective: string, day: Partial<CompareAd["days"][number]>): AdStats =>
    adStats({ id, name: id, campaignName: "C", objective, format: "video", status: "active", headline: null, thumbnailUrl: null, postUrl: null, days: [{ date: "2026-10-01", spend: 100, impressions: 1000, reach: 500, clicks: 50, linkClicks: 40, conversions: 0, conversionValue: 0, videoViews: null, videoThruplays: null, ...day }] as CompareAd["days"] });
  const rowsOf = (stats: AdStats[], mode: "total" | "day" = "total") => compareTable(stats, mode).flatMap((g) => g.rows);
  const row = (stats: AdStats[], id: string, mode: "total" | "day" = "total") => rowsOf(stats, mode).find((r) => r.metric.id === id);

  it("mesmo objetivo: a linha leva o nome dele e compara", () => {
    const r = row([ad("a", "OUTCOME_LEADS", { leads: 20 }), ad("b", "OUTCOME_LEADS", { leads: 30 })], "result")!;
    expect(r.metric.label).toBe("Leads");
    expect(r.cells.map((c) => c.text)).toEqual(["20", "30"]);
    expect(r.cells[1].isBest).toBe(true);
  });

  it("vendas: Compras; engajamento: Interações", () => {
    expect(row([ad("a", "OUTCOME_SALES", { conversions: 5 })], "result")!.metric.label).toBe("Compras");
    expect(row([ad("a", "OUTCOME_ENGAGEMENT", { postEngagement: 80 })], "result")!.metric.label).toBe("Interações");
  });

  it("objetivos diferentes: cada coluna mostra o seu tipo, e nada é melhor", () => {
    const r = row([ad("a", "OUTCOME_LEADS", { leads: 20 }), ad("b", "OUTCOME_SALES", { conversions: 7 }), ad("c", "OUTCOME_ENGAGEMENT", { postEngagement: 90 })], "result")!;
    expect(r.metric.label).toBe("Resultado");
    expect(r.cells.map((c) => c.text)).toEqual(["20 leads", "7 compras", "90 interações"]);
    expect(r.cells.some((c) => c.isBest)).toBe(false);
    expect(r.cells.every((c) => c.diff == null)).toBe(true);
  });

  it('sem o dado do resultado: "—", nunca 0, e continua dizendo o tipo pelo nome da linha', () => {
    const r = row([ad("a", "OUTCOME_LEADS", { leads: null })], "result")!;
    expect(r.metric.label).toBe("Leads");
    expect(r.cells[0].value).toBeNull();
    expect(r.cells[0].text).toBe("—");
  });

  it("não repete: sem linha Compras em vendas, nem Leads em leads", () => {
    expect(row([ad("a", "OUTCOME_SALES", { conversions: 5 })], "conversions")).toBeUndefined();
    expect(row([ad("a", "OUTCOME_LEADS", { leads: 5 })], "leads")).toBeUndefined();
  });

  it('nunca "Compras 0" em anúncio de leads', () => {
    expect(row([ad("a", "OUTCOME_LEADS", { leads: 5, conversions: 0 })], "conversions")).toBeUndefined();
    const mixed = row([ad("a", "OUTCOME_LEADS", { leads: 5, conversions: 0 }), ad("b", "OUTCOME_LEADS", { leads: 5, conversions: 3 })], "conversions")!;
    expect(mixed.cells.map((c) => c.text)).toEqual(["—", "3"]);
  });

  it("em Média/dia, divide pelos dias de veiculação", () => {
    const two = adStats({ id: "a", name: "a", campaignName: "C", objective: "OUTCOME_LEADS", format: "video", status: "active", headline: null, thumbnailUrl: null, postUrl: null, days: [{ date: "2026-10-01", impressions: 10, clicks: 1, leads: 4 }, { date: "2026-10-02", impressions: 10, clicks: 1, leads: 6 }] as CompareAd["days"] });
    expect(row([two], "result", "day")!.cells[0].value).toBe(5);
  });
});
