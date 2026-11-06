import { describe, expect, it } from "vitest";
import { sampleDashboardData } from "@/features/analytics/preview";
import { dashboardInsights } from "./insights";

describe("dashboardInsights", () => {
  for (const id of ["meta-ecommerce", "google-ecommerce"]) {
    it(`gera análises com números do período (${id})`, () => {
      const data = sampleDashboardData(id, { period: "30d", breakEvenRoas: 2.5, today: "2026-11-05" })!;
      const list = dashboardInsights(data, 10);
      expect(list.length).toBeGreaterThan(0);
      for (const i of list) {
        expect(i.dashboardId).toBe(data.dashboard.id);
        expect(i.title.length).toBeGreaterThan(5);
        expect(i.body).not.toMatch(/undefined|NaN|null/);
      }
      // mais importantes primeiro
      expect([...list].sort((a, b) => b.weight - a.weight)).toEqual(list);
    });
  }

  it("sem dados, sem análise", () => {
    const data = sampleDashboardData("meta-ecommerce")!;
    expect(dashboardInsights({ ...data, status: "no_data" })).toEqual([]);
  });

  it("campanha com verba e sem conversão vira alerta", () => {
    const data = sampleDashboardData("meta-ecommerce", { today: "2026-11-05" })!;
    const c = { ...data.view.campaigns[0], conversions: 0, spendShare: 0.3, spend: 900 };
    const list = dashboardInsights({ ...data, view: { ...data.view, campaigns: [c] } } as typeof data, 10);
    expect(list.find((i) => i.id === `zero:${c.id}`)?.tone).toBe("bad");
  });
});
