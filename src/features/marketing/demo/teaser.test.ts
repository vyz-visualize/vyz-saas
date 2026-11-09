import { describe, expect, it } from "vitest";
import { metricById } from "@/features/analytics/creatives/compare";
import { TEASER_ADS, TEASER_ROWS } from "./compare-teaser-data";

// "R$ 9.828" / "2,17%" / "3,30" → número
const num = (t: string) => Number(t.replace(/[^\d,]/g, "").replace(",", "."));

describe("slide de criativos: só uma prévia", () => {
  it("o comparativo mostra 2 anúncios e só 4 métricas, com os nomes do produto", () => {
    expect(TEASER_ADS).toHaveLength(2);
    expect(TEASER_ROWS.map((r) => r.id)).toEqual(["spend", "ctr", "cpa", "roas"]);
    for (const r of TEASER_ROWS) {
      const m = metricById(r.id)!;
      expect(r.label).toBe(m.label);
      expect(r.better).toBe(m.better);
    }
  });

  it("troféu no melhor valor e a diferença 'vs melhor' certa", () => {
    for (const r of TEASER_ROWS) {
      const v = r.cells.map((c) => num(c.text));
      if (!r.better) {
        expect(r.cells.every((c) => !c.best && !c.diff)).toBe(true);
        continue;
      }
      const best = r.better === "up" ? Math.max(...v) : Math.min(...v);
      r.cells.forEach((c, i) => {
        expect(c.best).toBe(v[i] === best);
        if (c.best) expect(c.diff).toBeNull();
        else {
          const pct = Math.round(Math.abs((v[i] - best) / best) * 100);
          expect(c.diff).toBe(`${v[i] < best ? "−" : "+"}${pct}% vs melhor`);
        }
      });
    }
  });
});
