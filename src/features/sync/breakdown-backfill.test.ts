import { describe, expect, it } from "vitest";
import { backfillSlots, BREAKDOWN_BACKFILLS_PER_ROUND, fetchBreakdownsNow, needsBreakdownBackfill } from "./round";

const base = { trigger: "scheduled" as const, platform: "meta", isMock: false, hasBreakdownRows: false, hasRecentSpend: true };

describe("carga única das quebras de 90 dias", () => {
  it("conta da Meta sem nenhuma linha de quebra e com gasto recente: pede os 90 dias, em qualquer hora da rodada", () => {
    expect(needsBreakdownBackfill(base)).toBe(true);
    expect(needsBreakdownBackfill({ ...base, trigger: "manual" })).toBe(true);
    // fora da rodada das 09 UTC as quebras do dia não viriam; a carga vem mesmo assim
    expect(fetchBreakdownsNow("scheduled", new Date("2026-11-25T15:00:00Z"))).toBe(false);
  });

  it("uma vez por conta: depois da carga (já tem linhas), volta à rodada diária", () => {
    expect(needsBreakdownBackfill({ ...base, hasBreakdownRows: true })).toBe(false);
  });

  it("não pede: primeira sincronização (já busca 90 dias), outra plataforma, conta simulada ou sem gasto", () => {
    expect(needsBreakdownBackfill({ ...base, trigger: "initial" })).toBe(false);
    expect(needsBreakdownBackfill({ ...base, platform: "google" })).toBe(false);
    expect(needsBreakdownBackfill({ ...base, isMock: true })).toBe(false);
    expect(needsBreakdownBackfill({ ...base, hasRecentSpend: false })).toBe(false);
  });

  it("limite por rodada: as contas além das vagas ficam para a próxima rodada", () => {
    const slot = backfillSlots();
    const got = Array.from({ length: 10 }, () => slot());
    expect(got.filter(Boolean)).toHaveLength(BREAKDOWN_BACKFILLS_PER_ROUND);
    expect(got.slice(0, BREAKDOWN_BACKFILLS_PER_ROUND).every(Boolean)).toBe(true);
    // a rodada seguinte tem vagas novas
    expect(backfillSlots()()).toBe(true);
  });
});
