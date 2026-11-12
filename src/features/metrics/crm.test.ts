import { describe, expect, it } from "vitest";
import { generateCrmData } from "@/features/sync/mock/crm";
import { crmStagesForDataset, crmTotals, type CrmRow } from "./crm";
import { datasetFromWarehouse } from "./warehouse-dataset";

const rows: CrmRow[] = [
  { date: "2026-11-01", stage: "*", stageOrder: 0, deals: 3, value: 3000, won: 1, wonValue: 1200, lost: 1, leads: 10 },
  { date: "2026-11-01", stage: "Proposta", stageOrder: 2, deals: 1, value: 1000, won: 0, wonValue: 0, lost: 0, leads: 0 },
  { date: "2026-11-02", stage: "*", stageOrder: 0, deals: 2, value: 800, won: 2, wonValue: 1800, lost: 0, leads: 5 },
  { date: "2026-11-02", stage: "Novo", stageOrder: 1, deals: 2, value: 800, won: 0, wonValue: 0, lost: 0, leads: 0 },
  // fora do período
  { date: "2026-10-01", stage: "*", stageOrder: 0, deals: 9, value: 9, won: 9, wonValue: 9, lost: 9, leads: 99 },
];
const range = { from: "2026-11-01", to: "2026-11-03" };

describe("CRM no dashboard", () => {
  it("soma o total do dia e as etapas, na ordem do CRM", () => {
    const t = crmTotals(rows, range);
    expect(t).toMatchObject({ leads: 15, deals: 5, value: 3800, won: 3, wonValue: 3000, lost: 1 });
    expect(t.stages.map((s) => s.stage)).toEqual(["Novo", "Proposta"]);
    expect(t.leadsSeries).toEqual([10, 5, 0]);
    expect(t.wonSeries).toEqual([1, 2, 0]);
  });

  it("etapas do widget: Leads, as abertas e Ganhos, em centavos", () => {
    expect(crmStagesForDataset(rows, range)).toEqual([
      { stage: "Leads", count: 15, value: 0 },
      { stage: "Novo", count: 2, value: 80000 },
      { stage: "Proposta", count: 1, value: 100000 },
      { stage: "Ganhos", count: 3, value: 300000 },
    ]);
    expect(crmStagesForDataset([], range)).toEqual([]);
  });

  it("o Dataset dos dados reais leva o CRM para os widgets", () => {
    const crm = generateCrmData({ accountExternalId: "x", endDate: "2026-11-11", days: 60 }).daily;
    const ds = datasetFromWarehouse([], { profile: "leads", today: "2026-11-12", current: { from: "2026-10-13", to: "2026-11-11" }, previous: { from: "2026-09-13", to: "2026-10-12" } }, [], crm);
    expect(ds.crm[0].stage).toBe("Leads");
    expect(ds.crm.at(-1)?.stage).toBe("Ganhos");
    expect(ds.crm[0].count).toBeGreaterThan(0);
    expect(datasetFromWarehouse([], { profile: "leads", today: "2026-11-12", current: { from: "2026-10-13", to: "2026-11-11" } }).crm).toEqual([]);
  });
});
