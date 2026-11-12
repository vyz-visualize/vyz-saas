import { describe, expect, it } from "vitest";
import { describeGoal, goalStatus, parseMetricGoals, periodLabel, withGoal, type MetricGoal } from "./goals";

const cpm: MetricGoal = { metric: "cpm", value: 650, direction: "max", period: { kind: "month" } };
const leads: MetricGoal = { metric: "leads", value: 500, direction: "min", period: { kind: "custom", from: "2026-12-01", to: "2026-12-31" } };

describe("parseMetricGoals", () => {
  it("aceita só metas válidas e uma por métrica", () => {
    const out = parseMetricGoals([cpm, leads, { ...cpm, value: 700 }, { metric: "xyz", value: 1, direction: "max", period: { kind: "month" } }, { ...cpm, direction: "talvez" }, { ...leads, period: { kind: "custom", from: "2026-12-31", to: "2026-12-01" } }, null, "texto"]);
    expect(out).toEqual([{ ...cpm, value: 700 }, leads]);
  });

  it("não lista vira vazio", () => {
    expect(parseMetricGoals({})).toEqual([]);
    expect(parseMetricGoals(null)).toEqual([]);
  });
});

describe("withGoal", () => {
  it("troca a meta da mesma métrica e põe as novas no fim", () => {
    expect(withGoal([cpm], leads)).toEqual([cpm, leads]);
    expect(withGoal([cpm, leads], { ...cpm, value: 500 })).toEqual([{ ...cpm, value: 500 }, leads]);
  });
});

describe("texto", () => {
  it("período e descrição", () => {
    expect(periodLabel({ kind: "firstWeek" })).toBe("primeira semana do mês");
    expect(periodLabel(leads.period)).toBe("de 01/12 a 31/12");
    expect(describeGoal(leads, "leads")).toBe("Leads pelo menos 500 · de 01/12 a 31/12");
    expect(describeGoal({ metric: "ctr", value: 0.015, direction: "min", period: { kind: "month" } })).toBe("CTR pelo menos 1,50% · este mês");
    expect(describeGoal({ ...cpm, value: 700 })).toBe("CPM no máximo R$ 7 · este mês");
  });
});

describe("goalStatus", () => {
  it("custo: no alvo abaixo da meta", () => {
    expect(goalStatus(cpm, 600)).toMatchObject({ on: true, progress: 1 });
    const off = goalStatus(cpm, 1300)!;
    expect(off.on).toBe(false);
    expect(off.progress).toBeCloseTo(0.5);
    expect(off.text).toMatch(/Fora do alvo/);
  });

  it("volume: quanto da meta já foi", () => {
    const s = goalStatus(leads, 250)!;
    expect(s).toMatchObject({ on: false, progress: 0.5 });
    expect(s.text).toBe("50% da meta de 500");
    expect(goalStatus(leads, 600)).toMatchObject({ on: true, progress: 1 });
  });

  it("sem valor, sem status", () => {
    expect(goalStatus(cpm, Number.NaN)).toBeNull();
  });
});
