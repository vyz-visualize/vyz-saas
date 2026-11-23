import { describe, expect, it } from "vitest";
import type { Campaign, DayRow } from "@/features/metrics/source";
import { actionToday, bestDay, byHour, campaignMovers, dayNotes, heatPeak, pacing, stagePass, stateShares, waterfall, yesterdayVsWeek } from "./insights";

const day = (ago: number, spend: number, conversions = 0): DayRow => ({ ago, spend, conversions }) as unknown as DayRow;
const camp = (id: string, conversions: number, prev: number, daily?: Campaign["daily"]): Campaign =>
  ({ id, name: id, platform: "meta", spend: 1000, impressions: 0, clicks: 0, conversions, revenue: conversions * 100, prev: { spend: 1000, conversions: prev, revenue: prev * 100 }, daily }) as Campaign;

describe("ritmo da verba", () => {
  it("sem verba do mês: null (o bloco mostra o convite)", () => {
    expect(pacing({ budget: { monthly: 0, spent: 0, day: 10, daysInMonth: 30 }, current: [], previous: [] })).toBeNull();
  });

  it("acumulado do mês, linha ideal e onde o mês fecha no ritmo dos últimos 7 dias", () => {
    const current = Array.from({ length: 10 }, (_, i) => day(i, 100));
    const p = pacing({ budget: { monthly: 3000, spent: 1000, day: 10, daysInMonth: 30 }, current, previous: [] })!;
    expect(p.actual).toHaveLength(10);
    expect(p.actual.at(-1)).toBe(1000);
    expect(p.ideal.at(-1)).toBe(3000);
    expect(p.projected).toBe(3000);
    expect(p.status).toBe("no ritmo");
    const fast = pacing({ budget: { monthly: 2000, spent: 1000, day: 10, daysInMonth: 30 }, current, previous: [] })!;
    expect(fast.status).toBe("estoura");
    const slow = pacing({ budget: { monthly: 6000, spent: 1000, day: 10, daysInMonth: 30 }, current, previous: [] })!;
    expect(slow.status).toBe("sobra");
  });
});

describe("precisa de ação hoje", () => {
  it("gastou nos últimos 3 dias sem resultado, ou com o custo 30% acima da semana anterior", () => {
    const flat = (n: number, v: number) => Array.from({ length: n }, () => v);
    const semResultado = camp("A", 10, 10, { spend: [...flat(7, 100), 100, 100, 100], conversions: [...flat(7, 1), 0, 0, 0] });
    const caro = camp("B", 10, 10, { spend: [...flat(7, 100), 100, 100, 100], conversions: [...flat(7, 2), 1, 0, 0] });
    const ok = camp("C", 10, 10, { spend: flat(10, 100), conversions: flat(10, 2) });
    const r = actionToday([semResultado, caro, ok], 100);
    expect(r.map((a) => [a.campaign.id, a.reason])).toEqual([
      ["A", "sem resultado"],
      ["B", "custo subindo"],
    ]);
    expect(r[0].spark).toHaveLength(7);
  });

  it("sem o dia a dia da campanha, nada", () => {
    expect(actionToday([camp("A", 1, 1)], 100)).toEqual([]);
  });
});

describe("ontem e os picos", () => {
  it("ontem contra a faixa dos 7 dias antes", () => {
    const rows = [day(1, 500), ...Array.from({ length: 7 }, (_, i) => day(i + 2, 100 + i))];
    expect(yesterdayVsWeek(rows, (d) => d.spend)).toMatchObject({ value: 500, status: "acima", lo: 100, hi: 106 });
  });

  it("o dia fora do padrão aparece com o quanto passou do esperado", () => {
    const rows = Array.from({ length: 28 }, (_, i) => day(i, i === 10 ? 900 : 100 + ((i * 7) % 5)));
    const notes = dayNotes(rows, (d) => d.spend);
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.find((n) => n.ago === 10)?.change).toBeGreaterThan(1);
  });

  it("dias em maturação (os últimos 3) não viram nota", () => {
    const rows = Array.from({ length: 28 }, (_, i) => day(i, i === 1 ? 5 : 100 + ((i * 7) % 5)));
    expect(dayNotes(rows, (d) => d.spend).some((n) => n.ago < 3)).toBe(false);
  });

  it("o melhor dia", () => {
    expect(bestDay([day(3, 0, 5), day(1, 0, 9), day(0, 0, 9)], (d) => d.conversions)?.ago).toBe(0);
  });
});

describe("ranking e cascata", () => {
  it("subiu/desceu contra a posição no período anterior; nova = null", () => {
    const r = campaignMovers([camp("A", 10, 30), camp("B", 20, 10), camp("C", 5, 0)], "conversions");
    expect(r.map((m) => [m.item.id, m.moved])).toEqual([
      ["B", 1],
      ["A", -1],
      ["C", null],
    ]);
  });

  it("cascata: do total anterior ao atual, campanha por campanha", () => {
    const w = waterfall([camp("A", 10, 30), camp("B", 20, 10)], "conversions")!;
    expect(w.start).toBe(40);
    expect(w.end).toBe(30);
    expect(w.steps).toEqual([
      { label: "A", delta: -20 },
      { label: "B", delta: 10 },
    ]);
    expect(w.start + w.steps.reduce((a, s) => a + s.delta, 0)).toBe(w.end);
  });
});

describe("grade de horários, funil e estados", () => {
  it("o pico da grade e a soma por hora", () => {
    const grid = Array.from({ length: 7 }, (_, d) => Array.from({ length: 24 }, (_, h) => (d === 2 && h === 20 ? 9 : 1)));
    expect(heatPeak(grid)).toMatchObject({ day: 2, hour: 20, max: 9 });
    expect(byHour(grid)[20]).toBe(15);
    expect(heatPeak(undefined)).toBeNull();
  });

  it("passagem entre as etapas do funil", () => {
    expect(stagePass([{ stage: "Lead", count: 100 }, { stage: "Venda", count: 25 }]).map((s) => s.pass)).toEqual([null, 0.25]);
  });

  it("parte de cada estado (só os do mapa)", () => {
    const m = stateShares([{ key: "SP", conversions: 3 }, { key: "ba", conversions: 1 }, { key: "XX", conversions: 4 }]);
    expect(m.get("SP")).toBeCloseTo(3 / 8);
    expect(m.get("BA")).toBeCloseTo(1 / 8);
    expect(m.has("XX")).toBe(false);
  });
});

import { campaignStatus, tiredCreatives } from "./insights";
import type { Creative } from "@/features/metrics/source";

describe("status das campanhas e criativos cansando (Pulso)", () => {
  const flat = (n: number, v: number) => Array.from({ length: n }, () => v);
  it("sem gasto, sem resultado, custo subindo e normal pelo dia a dia", () => {
    expect(campaignStatus(camp("A", 1, 1, { spend: [...flat(7, 100), 0, 0, 0], conversions: flat(10, 1) }), 100)?.status).toBe("sem gasto");
    expect(campaignStatus(camp("B", 1, 1, { spend: flat(10, 100), conversions: [...flat(7, 1), 0, 0, 0] }), 100)?.status).toBe("sem resultado");
    expect(campaignStatus(camp("C", 1, 1, { spend: flat(10, 100), conversions: [...flat(7, 2), 1, 0, 0] }), 100)?.status).toBe("custo subindo");
    expect(campaignStatus(camp("D", 1, 1, { spend: flat(10, 100), conversions: flat(10, 2) }), 100)?.status).toBe("normal");
    expect(campaignStatus(camp("E", 1, 1), 100)).toBeNull();
  });
  it("cansando: frequência de 3 ou mais e CTR abaixo da média, os mais repetidos primeiro", () => {
    const cr = (id: string, frequency: number, clicks: number) => ({ id, name: id, frequency, clicks, impressions: 1000 }) as Creative;
    const r = tiredCreatives([cr("ok", 4, 30), cr("a", 3.2, 5), cr("b", 4.5, 8), cr("baixa", 2, 1)]);
    expect(r.map((t) => t.creative.id)).toEqual(["b", "a"]);
  });
});
