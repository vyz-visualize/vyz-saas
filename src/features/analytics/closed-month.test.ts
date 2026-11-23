import { describe, expect, it } from "vitest";
import type { DayRow } from "@/features/metrics/source";
import { closedMonth, coversRange, isClosedMonth, rowsIn } from "./closed-month";
import { dashboardRanges } from "./ranges";

describe("mês anterior fechado", () => {
  it("em 23/11: outubro inteiro contra setembro, num período que vai de 01/10 a ontem", () => {
    const cm = closedMonth("2026-11-23");
    expect(cm.month).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(cm.before).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(cm.label).toBe("outubro de 2026");
    expect(cm.beforeLabel).toBe("setembro");
    expect(cm.periodDays).toBe(53);
    expect(cm.available).toBe(true);
    // o período personalizado cobre o mês e o anterior dele cobre setembro
    const r = dashboardRanges("custom", cm.periodDays, "2026-11-23");
    expect(r.current.from).toBe("2026-10-01");
    expect(r.previous.from <= "2026-09-01").toBe(true);
  });

  it("no dia 1, o mês que terminou ontem; o atual e o anterior juntos ainda cobrem o mês antes", () => {
    for (const today of ["2026-12-01", "2026-03-01", "2026-11-23", "2026-08-15"]) {
      const cm = closedMonth(today);
      const r = dashboardRanges("custom", cm.periodDays, today);
      expect(r.current.from <= cm.month.from, today).toBe(true);
      expect(r.previous.from <= cm.before.from, today).toBe(true);
    }
    expect(closedMonth("2026-12-01").month).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("virada de ano e o limite de 60 dias", () => {
    expect(closedMonth("2027-01-10").month).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(closedMonth("2027-01-10").label).toBe("dezembro de 2026");
    // 31/08: julho (31) + agosto até ontem (30) = 61 dias: não cabe
    expect(closedMonth("2026-08-31").available).toBe(false);
  });

  it("linhas do mês pela data e o trecho que é o mês", () => {
    const rows = Array.from({ length: 90 }, (_, i) => ({ ago: i + 1, spend: 1 }) as DayRow);
    const cm = closedMonth("2026-11-23");
    expect(rowsIn(rows, "2026-11-23", cm.month)).toHaveLength(31);
    expect(coversRange(rows, "2026-11-23", cm.before)).toBe(true);
    expect(coversRange(rows.slice(0, 60), "2026-11-23", cm.before)).toBe(false);
    expect(isClosedMonth(cm, { from: "2026-10-01", to: "2026-10-31" })).toBe(true);
    expect(isClosedMonth(cm, { from: "2026-10-02", to: "2026-10-31" })).toBe(false);
  });
});
