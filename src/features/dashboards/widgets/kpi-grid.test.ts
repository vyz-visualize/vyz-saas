import { describe, expect, it } from "vitest";
import { kpiRows, kpiSpans } from "./kpi-grid";

describe("cards de KPI sem buraco", () => {
  it("fileiras de até 4, o mais parelhas possível", () => {
    expect(kpiRows(1)).toEqual([1]);
    expect(kpiRows(4)).toEqual([4]);
    expect(kpiRows(5)).toEqual([3, 2]);
    expect(kpiRows(6)).toEqual([3, 3]);
    expect(kpiRows(7)).toEqual([4, 3]);
    expect(kpiRows(8)).toEqual([4, 4]);
    expect(kpiRows(9)).toEqual([3, 3, 3]);
    expect(kpiRows(0)).toEqual([]);
  });
  it("toda fileira fecha as 12 colunas (qualquer quantidade)", () => {
    for (let n = 1; n <= 16; n++) {
      const spans = kpiSpans(n).map((c) => Number(/@\[440px\]:col-span-(\d+)/.exec(c)?.[1]));
      let i = 0;
      for (const perRow of kpiRows(n)) {
        expect(spans.slice(i, i + perRow).reduce((a, b) => a + b, 0)).toBe(12);
        i += perRow;
      }
      expect(i).toBe(n);
    }
  });
  it("6 cards: 2 fileiras de 3; no celular, ímpar fecha com o último na linha toda", () => {
    expect(kpiSpans(6)).toEqual(Array(6).fill("@[440px]:col-span-4"));
    expect(kpiSpans(5).at(-1)).toBe("col-span-2 @[440px]:col-span-6");
  });
});
