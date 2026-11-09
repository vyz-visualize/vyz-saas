import { describe, expect, it } from "vitest";
import { NO_FILTERS } from "@/features/analytics/filters";
import { sampleData } from "./engine";

describe("amostra do site", () => {
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
