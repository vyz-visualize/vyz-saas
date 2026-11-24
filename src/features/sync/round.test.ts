import { describe, expect, it } from "vitest";
import { estimateMs, failureMessage, fitsInRound, hourInSaoPaulo, parseSyncGroup, rereadAllPosts, SYNC_GROUPS } from "./round";

describe("rodada de sincronização", () => {
  it("grupos: anúncios e analytics num cron, Instagram e Página no outro", () => {
    expect(SYNC_GROUPS.organico).toEqual(["instagram", "facebook"]);
    expect(SYNC_GROUPS.anuncios).toEqual(expect.arrayContaining(["meta", "google", "ga4", "hubspot"]));
    expect(SYNC_GROUPS.anuncios).not.toContain("instagram");
    expect(parseSyncGroup("organico")).toBe("organico");
    expect(parseSyncGroup("outro")).toBeNull();
    expect(parseSyncGroup(null)).toBeNull();
  });

  it("só começa a conta se o tempo que ela costuma levar couber no que falta", () => {
    expect(estimateMs("instagram")).toBe(70_000);
    expect(estimateMs("ga4")).toBe(15_000);
    // 195 s de rodada: aos 120 s cabe um orgânico (75 s sobrando); aos 130 s, não
    expect(fitsInRound("instagram", 120_000, 195_000)).toBe(true);
    expect(fitsInRound("instagram", 130_000, 195_000)).toBe(false);
    // o GA4 (rápido) ainda cabe
    expect(fitsInRound("ga4", 175_000, 195_000)).toBe(true);
  });

  it("orgânico: relê todos os posts na primeira rodada do dia e em sincronização pedida por alguém", () => {
    // 07 UTC = 04 h em Brasília: a primeira rodada do dia
    expect(hourInSaoPaulo(new Date("2026-11-23T07:20:00Z"))).toBe(4);
    expect(rereadAllPosts("scheduled", new Date("2026-11-23T07:20:00Z"))).toBe(true);
    expect(rereadAllPosts("scheduled", new Date("2026-11-23T12:20:00Z"))).toBe(false);
    expect(rereadAllPosts("scheduled", new Date("2026-11-23T19:40:00Z"))).toBe(false);
    expect(rereadAllPosts("manual", new Date("2026-11-23T12:20:00Z"))).toBe(true);
    expect(rereadAllPosts("initial", new Date("2026-11-23T12:20:00Z"))).toBe(true);
  });

  it("falta de permissão (403) diz o que fazer; o resto fica com a mensagem genérica", () => {
    const generic = "Não foi possível importar os dados agora. Tente de novo em alguns minutos.";
    expect(failureMessage("GA4: relatório diário: HTTP 403 code=403 status=PERMISSION_DENIED", generic)).toMatch(/^Sem permissão \(HTTP 403\)/);
    expect(failureMessage("Meta: HTTP 500 code=1", generic)).toBe(generic);
    expect(failureMessage(null, generic)).toBe(generic);
  });
});

import { fetchBreakdownsNow } from "./round";
import { breakdownPrune } from "./rows";

describe("quebras da Meta uma vez por dia", () => {
  const at = (iso: string) => new Date(iso);
  it("na primeira rodada de anúncios (09 UTC) e sempre na primeira sincronização da conta", () => {
    expect(fetchBreakdownsNow("scheduled", at("2026-11-24T09:00:30Z"))).toBe(true);
    expect(fetchBreakdownsNow("scheduled", at("2026-11-24T15:00:30Z"))).toBe(false);
    expect(fetchBreakdownsNow("scheduled", at("2026-11-24T21:00:30Z"))).toBe(false);
    expect(fetchBreakdownsNow("initial", at("2026-11-24T21:00:30Z"))).toBe(true);
    expect(fetchBreakdownsNow("manual", at("2026-11-24T15:00:30Z"))).toBe(false);
  });
  it("sem as quebras na rodada, as do banco ficam; com parte delas, só essas são regravadas", () => {
    expect(breakdownPrune(undefined)).toBe("all");
    expect(breakdownPrune([])).toBe("none");
    expect(breakdownPrune(["placement", "hour"])).toEqual(["placement", "hour"]);
  });
});
