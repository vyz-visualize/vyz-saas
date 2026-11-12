import { describe, expect, it } from "vitest";
import { buildCrmDays, CRM_TOTAL, crmDayRow, crmInstant, crmNumber, isCrmSyncPlatform } from "./crm";
import { generateCrmData } from "./mock/crm";

const range = { from: "2026-11-01", to: "2026-11-10" };
const at = (iso: string) => new Date(iso);

describe("CRM: montagem das linhas", () => {
  it("leads e negócios criados no dia vão para o total; os abertos também para a etapa", () => {
    const days = buildCrmDays({
      range,
      timeZone: "America/Sao_Paulo",
      leads: [at("2026-11-02T12:00:00Z"), at("2026-11-02T15:00:00Z"), at("2026-10-20T12:00:00Z"), null],
      deals: [
        { createdAt: at("2026-11-02T12:00:00Z"), closedAt: null, status: "open", stage: "Proposta", stageOrder: 2, value: 1000 },
        { createdAt: at("2026-11-02T13:00:00Z"), closedAt: at("2026-11-05T13:00:00Z"), status: "won", stage: "Ganho", stageOrder: 9, value: 2500 },
        // criado antes do período e ganho nele: conta só no fechamento
        { createdAt: at("2026-10-01T13:00:00Z"), closedAt: at("2026-11-06T13:00:00Z"), status: "won", stage: "Ganho", stageOrder: 9, value: 500 },
        { createdAt: at("2026-11-03T13:00:00Z"), closedAt: at("2026-11-04T13:00:00Z"), status: "lost", stage: "Perdido", stageOrder: 9, value: 300 },
      ],
    });
    const total = (date: string) => days.find((d) => d.date === date && d.stage === CRM_TOTAL);
    expect(total("2026-11-02")).toMatchObject({ leads: 2, deals: 2, value: 3500, won: 0 });
    expect(days.find((d) => d.date === "2026-11-02" && d.stage === "Proposta")).toMatchObject({ deals: 1, value: 1000, stageOrder: 2 });
    expect(total("2026-11-05")).toMatchObject({ won: 1, wonValue: 2500 });
    expect(total("2026-11-06")).toMatchObject({ won: 1, wonValue: 500, deals: 0 });
    expect(total("2026-11-04")).toMatchObject({ lost: 1 });
    // negócio fechado não fica numa etapa aberta
    expect(days.some((d) => d.stage === "Ganho" || d.stage === "Perdido")).toBe(false);
  });

  it("data no fuso da conta: 01h UTC ainda é o dia anterior em São Paulo", () => {
    const days = buildCrmDays({ range, timeZone: "America/Sao_Paulo", leads: [at("2026-11-05T01:00:00Z")], deals: [] });
    expect(days).toEqual([expect.objectContaining({ date: "2026-11-04", leads: 1 })]);
  });

  it("linha do banco: limites, arredondamento e etapa vazia", () => {
    expect(crmDayRow({ date: "2026-11-01", stage: "  ", stageOrder: 1.6, deals: 2.4, value: 10.555, won: -1, wonValue: 3.333, lost: 0, leads: 3 })).toEqual({
      date: "2026-11-01",
      stage: "(sem etapa)",
      stage_order: 2,
      deals: 2,
      value: 10.56,
      won: 0,
      won_value: 3.33,
      lost: 0,
      leads: 3,
    });
  });

  it("datas e números dos CRMs", () => {
    expect(crmInstant("2026-11-02 10:00:00")?.toISOString()).toBe("2026-11-02T10:00:00.000Z");
    expect(crmInstant(1_762_000_000)?.getTime()).toBe(1_762_000_000_000);
    expect(crmInstant("1762000000000")?.getTime()).toBe(1_762_000_000_000);
    expect(crmInstant("2026-11-02T10:00:00.000Z")?.toISOString()).toBe("2026-11-02T10:00:00.000Z");
    expect(crmInstant("lixo")).toBeNull();
    expect(crmNumber("1500.5")).toBe(1500.5);
    expect(crmNumber(null)).toBe(0);
    expect(isCrmSyncPlatform("hubspot")).toBe(true);
    expect(isCrmSyncPlatform("meta")).toBe(false);
  });
});

describe("CRM simulado", () => {
  it("determinístico e com total e etapas por dia", () => {
    const a = generateCrmData({ accountExternalId: "123", endDate: "2026-11-10", days: 30 });
    const b = generateCrmData({ accountExternalId: "123", endDate: "2026-11-10", days: 30 });
    expect(a).toEqual(b);
    expect(a.range).toEqual({ from: "2026-10-12", to: "2026-11-10" });
    expect(a.daily.filter((d) => d.stage === CRM_TOTAL)).toHaveLength(30);
    expect(a.daily.some((d) => d.stage !== CRM_TOTAL)).toBe(true);
    for (const d of a.daily) expect(crmDayRow(d).deals).toBeGreaterThanOrEqual(0);
  });
});
