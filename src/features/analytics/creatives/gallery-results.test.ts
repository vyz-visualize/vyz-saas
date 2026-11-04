// @vitest-environment happy-dom

// Galeria e lista: o resultado segue o objetivo da campanha, ROAS só com receita.

import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aggregateDashboard, redactSpend } from "../aggregate";
import { sampleRows } from "../preview";
import type { CreativeVM, MetaView, WarehouseRows } from "../types";
import { CreativeGallery } from "./CreativeGallery";
import { CreativeList } from "./CreativeList";
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

  it("nunca há compras em campanha de leads, nem em quem não tem o dado", () => {
    const missing = view({ ...rows, adDaily: rows.adDaily.map((r) => ({ ...r, leads: null, conversions: 0 })) });
    for (const ad of adsOf(missing, "OUTCOME_LEADS")) expect(ad.result).toEqual({ label: "leads", value: 0 });
  });

  it("custo por resultado: investimento ÷ resultado", () => {
    const ad = adsOf(v, "OUTCOME_LEADS").find((a) => a.result.value > 0)!;
    expect(ad.costPerResult).toBeCloseTo(ad.spend! / ad.result.value, 6);
  });

  it("receita é da campanha: sem receita, não há ROAS", () => {
    expect(adsOf(v, "OUTCOME_LEADS").every((a) => !a.hasRevenue)).toBe(true);
    expect(v.creatives.some((a) => a.hasRevenue)).toBe(true);
  });

  it("investimento oculto: o custo por resultado não sai do servidor", () => {
    const clean = redactSpend(v);
    expect(clean.creatives.every((c) => c.costPerResult == null)).toBe(true);
    expect(clean.creatives.some((c) => c.result.value > 0)).toBe(true);
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

  it('"Retenção 3 s" no lugar de "Hook rate", com a explicação no hover', async () => {
    await gallery([card({})]);
    expect(labels()).toContain("Retenção 3 s");
    expect(host.textContent).not.toContain("Hook rate");
    const item = [...host.querySelectorAll("dt")].find((d) => d.textContent === "Retenção 3 s")!.parentElement!;
    expect(item.getAttribute("title")).toBe("% de quem assistiu pelo menos 3 segundos");
  });

  it("comparativo usa o mesmo nome e a mesma explicação", () => {
    const m = COMPARE_METRICS.find((x) => x.id === "hookRate")!;
    expect(m.label).toBe("Retenção 3 s");
    expect(m.help).toBe(RETENTION_HELP);
  });

  it("a lista mostra o resultado do objetivo", async () => {
    await mount(createElement(CreativeList, { rows: [{ id: "a1", name: "Anúncio", campaignName: "Campanha", status: "active", spend: 100, result: { label: "leads", value: 7 } }], currency: "BRL", hideSpend: false }));
    expect(host.textContent).toContain("leads");
    expect(host.textContent).not.toContain("compras");
  });
});
