import { describe, expect, it } from "vitest";
import { respond } from "@/features/agent/engine/local";
import { NO_FILTERS } from "@/features/analytics/filters";
import { sampleData, sampleRowsFor } from "./engine";
import { DEMO_QUESTIONS, demoContext } from "./vyz-context";

describe("demonstração do site", () => {
  it("o VYZ entende todas as perguntas de atalho, e sem 'Mostrar no painel'", () => {
    const ctx = demoContext(new Date("2026-11-15T12:00:00-03:00"));
    for (const q of DEMO_QUESTIONS) {
      const a = respond(q, ctx);
      expect(a.understood, q).toBe(true);
      expect(a.text).not.toMatch(/não sei|Não tenho esse dado/i);
      expect(a.target).toBeUndefined();
    }
  });

  it("o mês do VYZ é o mesmo período que ele diz ('em novembro até hoje')", () => {
    const rows = sampleRowsFor("meta", "mes");
    expect(rows.current.from.slice(8, 10)).toBe("01");
  });

  it("filtrar uma campanha na amostra fecha com a linha dela e não passa do total", () => {
    const all = sampleData("meta");
    const top = all.view.campaigns[0];
    const one = sampleData("meta", { ...NO_FILTERS, campaigns: [top.id] });
    const spend = (d: typeof all) => d.view.kpis.find((k) => k.id === "spend")!.value!;
    expect(spend(one)).toBeCloseTo(top.spend!, 2);
    expect(spend(one)).toBeLessThan(spend(all));
    expect(one.view.campaigns.map((c) => c.id)).toEqual(all.view.campaigns.map((c) => c.id));
  });

  it("a amostra é marcada como amostra e não tem investimento oculto", () => {
    const d = sampleData("google");
    expect(d.sample).toBe(true);
    expect(d.hideSpend).toBe(false);
    expect(d.status).toBe("ok");
  });
});
