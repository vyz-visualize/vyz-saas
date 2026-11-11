import { describe, expect, it } from "vitest";
import { FIT_COMPACT_MIN, FIT_MIN_ROW, fitRows, GAP, ROW, rowTops, type PageGrid } from "./model";

// cards de KPI em cima (4 fileiras), dois gráficos embaixo (12 fileiras)
const grid: PageGrid = [
  { id: "kpis", x: 0, y: 0, w: 12, h: 4 },
  { id: "w:0", x: 0, y: 4, w: 8, h: 12 },
  { id: "w:1", x: 8, y: 4, w: 4, h: 12 },
];
const isCard = (id: string) => id === "kpis";
const total = (rows: number[]) => rows.reduce((a, b) => a + b, 0) - GAP;

describe("fitRows (encaixe na altura da tela)", () => {
  it("ocupa exatamente a altura livre", () => {
    for (const h of [500, 700, 900]) {
      const rows = fitRows(grid, h, isCard)!;
      expect(rows).toHaveLength(16);
      expect(total(rows)).toBeCloseTo(h, 5);
    }
  });

  it("as fileiras de cards não crescem além da altura padrão", () => {
    const rows = fitRows(grid, 1400, isCard)!;
    expect(rows[0]).toBe(ROW);
    expect(rows[10]).toBeGreaterThan(ROW);
  });

  it("no aperto os cards cedem até o mínimo antes dos gráficos", () => {
    const rows = fitRows(grid, 330, isCard)!;
    expect(rows[0]).toBe(FIT_COMPACT_MIN);
    expect(rows[10]).toBeGreaterThanOrEqual(FIT_MIN_ROW);
  });

  it("desiste quando os gráficos ficariam ilegíveis (a página volta a rolar)", () => {
    expect(fitRows(grid, 200, isCard)).toBeNull();
    expect(fitRows([], 800, isCard)).toBeNull();
    expect(fitRows(grid, 0, isCard)).toBeNull();
  });

  it("rowTops acumula as alturas", () => {
    expect(rowTops([10, 20, 30])).toEqual([0, 10, 30, 60]);
  });
});
