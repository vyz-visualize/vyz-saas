import { describe, expect, it } from "vitest";
import { generateOrganicData } from "./organic";

const input = { platform: "instagram" as const, accountExternalId: "17841400123456789", accountName: "@lojaexemplo", endDate: "2026-11-10", days: 30, anchorDate: "2026-11-10" };

describe("orgânico simulado", () => {
  it("um dia por data, do mais antigo ao mais novo", () => {
    const d = generateOrganicData(input);
    expect(d.daily).toHaveLength(30);
    expect(d.range).toEqual({ from: "2026-10-12", to: "2026-11-10" });
    expect(d.daily[0].date).toBe("2026-10-12");
  });

  it("o mesmo dia gera os mesmos números, qualquer que seja o período", () => {
    const a = generateOrganicData(input).daily.at(-1);
    const b = generateOrganicData({ ...input, days: 7 }).daily.at(-1);
    expect(a).toEqual(b);
  });

  it("números coerentes: seguidores crescem, alcance não passa das visualizações, interações somam as partes", () => {
    const d = generateOrganicData(input);
    expect(d.daily.at(-1)!.followers!).toBeGreaterThan(d.daily[0].followers!);
    for (const day of d.daily) {
      expect(day.reach!).toBeLessThanOrEqual(day.views);
      expect(day.interactions).toBe((day.likes ?? 0) + (day.comments ?? 0) + (day.shares ?? 0) + (day.saves ?? 0));
      expect(day.accountsEngaged!).toBeLessThanOrEqual(day.reach!);
    }
    expect(d.posts.length).toBeGreaterThan(10);
    expect(new Set(d.posts.map((p) => p.externalId)).size).toBe(d.posts.length);
  });

  it("Página do Facebook: sem salvamentos nem visitas ao perfil", () => {
    const d = generateOrganicData({ ...input, platform: "facebook", accountExternalId: "104857392016483" });
    expect(d.daily.every((x) => x.saves === null && x.profileViews === null)).toBe(true);
    expect(d.posts.every((p) => p.kind !== "story" && p.kind !== "carousel")).toBe(true);
  });
});
