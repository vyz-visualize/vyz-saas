// @vitest-environment happy-dom

// Blocos que mostram a mesma métrica no mesmo visual batem: mesma métrica, mesmo período e mesma
// fonte. Desenha a primeira aba de cada visual (dados de exemplo e o caminho dos dados reais) e
// compara os números crus que os blocos expõem em data-*:
//   * Lavanda: a cascata começa e termina nos totais do comparativo (período anterior e atual);
//   * Areia e Noturno: o anel divide o total do card (as partes somam o total);
//   * Pulso: o % da verba do topo e o bloco de ritmo usam o mesmo gasto do mês;
//   * todos: o dia do mês e os dias do mês saem da mesma conta (São Paulo), nos dois geradores.

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { sampleRows } from "@/features/analytics/preview";
import { monthPosition, spentThisMonth } from "@/features/metrics/month";
import type { Dataset } from "@/features/metrics/source";
import { datasetFromWarehouse } from "@/features/metrics/warehouse-dataset";
import { anyDashboardTemplate } from "@/features/templates/live";
import { DashboardBody } from "./DashboardBody";
import { datasetFor, DEFAULT_SETTINGS } from "./data";
import { pacing, sharesOfTotal, waterfall } from "./skins/insights";
import { makeContext } from "./widgets/Widgets";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, replace: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const today = "2026-11-23";
const rows = { meta: sampleRows("meta", { period: "30d", today }), google: sampleRows("google", { period: "30d", today }) };

function datasets(templateId: string): { name: string; ds: Dataset }[] {
  const t = anyDashboardTemplate(templateId)!;
  const spec = { templateId, name: "Teste", client: "Cliente", pages: t.pages, settings: { ...DEFAULT_SETTINGS, budget: 5_000_000, goal: 4000 } };
  return [
    { name: "exemplo", ds: datasetFor(spec, 30) },
    { name: "real", ds: datasetFromWarehouse([rows.meta, rows.google], { profile: t.profile, today, current: rows.meta.current, previous: rows.meta.previous, budget: 5_000_000, goal: 4000 }) },
  ];
}

async function render(templateId: string, ds: Dataset): Promise<HTMLElement> {
  const t = anyDashboardTemplate(templateId)!;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(createElement(DashboardBody, { dataset: ds, spec: { templateId, name: "Teste", client: "Cliente", pages: t.pages, settings: DEFAULT_SETTINGS }, initialPage: t.pages[0] } as never)));
  return host;
}
const num = (el: Element | null, attr: string) => Number(el?.getAttribute(attr));

describe("mesma métrica, mesmo total", () => {
  for (const id of ["lavanda-ecommerce", "lavanda-leads"]) {
    for (const { name, ds } of datasets(id)) {
      it(`${id} (${name}): a cascata começa e termina nos totais do comparativo`, async () => {
        const host = await render(id, ds);
        const cascade = host.querySelector("[data-cascata-de]");
        const key = id.endsWith("ecommerce") ? "revenue" : "conversions";
        const row = host.querySelector(`[data-comparativo="${key}"]`);
        expect(row, "comparativo").not.toBeNull();
        if (cascade) {
          expect(num(cascade, "data-cascata-de")).toBe(num(row, "data-anterior"));
          expect(num(cascade, "data-cascata-para")).toBe(num(row, "data-atual"));
        }
        // e a conta pura: anterior + passos = atual
        const ctx = makeContext(ds);
        const w = waterfall(ds.campaigns, key, 4, { start: ctx.prev[key], end: ctx.cur[key] });
        if (w) expect(w.start + w.steps.reduce((a, s) => a + s.delta, 0)).toBeCloseTo(w.end, 6);
      }, 60_000);
    }
  }

  for (const id of ["areia-leads", "noturno-ecommerce"]) {
    for (const { name, ds } of datasets(id)) {
      it(`${id} (${name}): o anel por plataforma soma o total do card`, async () => {
        const host = await render(id, ds);
        const ring = host.querySelector("[data-anel-total]");
        expect(ring, "anel").not.toBeNull();
        expect(num(ring, "data-anel-partes")).toBe(Math.round(num(ring, "data-anel-total")));
        const ctx = makeContext(ds);
        const expected = id.startsWith("areia") ? ctx.cur.conversions : ctx.cur.revenue / 100;
        expect(num(ring, "data-anel-total")).toBeCloseTo(expected, 6);
      }, 60_000);
    }
  }

  for (const { name, ds } of datasets("pulso-ecommerce")) {
    it(`pulso-ecommerce (${name}): o % da verba do topo e o ritmo usam o mesmo gasto do mês`, async () => {
      const host = await render("pulso-ecommerce", ds);
      const top = host.querySelector("[data-verba-mes]");
      const pace = host.querySelector("[data-ritmo]");
      expect(top, "verba no topo").not.toBeNull();
      expect(pace, "ritmo").not.toBeNull();
      expect(num(top, "data-verba-mes")).toBe(num(pace, "data-ritmo"));
      expect(pacing(ds)?.spent).toBe(ds.budget.spent);
    }, 60_000);
  }
});

describe("o mês é o mesmo em todo lugar", () => {
  it("os dois geradores usam o dia do mês e os dias do mês da mesma conta", () => {
    const real = datasets("pulso-ecommerce")[1].ds;
    expect({ day: real.budget.day, daysInMonth: real.budget.daysInMonth }).toEqual({ day: 23, daysInMonth: 30 });
    expect(real.budget.spent).toBe(spentThisMonth([...real.current, ...real.previous], 23));
    const sample = datasets("pulso-ecommerce")[0].ds;
    const now = monthPosition();
    expect({ day: sample.budget.day, daysInMonth: sample.budget.daysInMonth }).toEqual({ day: now.day, daysInMonth: now.daysInMonth });
    // todos os visuais leem o mesmo budget: o mesmo dataset dá o mesmo dia em qualquer um
    for (const id of ["lavanda-ecommerce", "noturno-ecommerce", "areia-leads", "fachada-imob"]) {
      const ds = datasets(id)[0].ds;
      expect(ds.budget.day).toBe(now.day);
      expect(ds.budget.daysInMonth).toBe(now.daysInMonth);
    }
  });

  it("monthPosition: fevereiro, 31 dias e o fuso de São Paulo", () => {
    expect(monthPosition("2028-02-10")).toMatchObject({ day: 10, daysInMonth: 29 });
    expect(monthPosition("2026-12-31")).toMatchObject({ day: 31, daysInMonth: 31 });
  });

  it("partes do total: somam exatamente o total do card", () => {
    const r = sharesOfTotal([{ value: 1400 }, { value: 901 }], 1805);
    expect(r.items.reduce((a, i) => a + i.value, 0)).toBe(1805);
    expect(r.attributed).toBe(2301);
  });
});
