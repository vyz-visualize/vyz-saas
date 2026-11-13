import { describe, expect, it } from "vitest";
import { billableUnit, countUnits, fitsProject, planUsageLabel } from "./limits";

const meta = (externalId: string, bm: string | null) => ({ platformId: "meta", externalId, businessExternalId: bm });
const google = (externalId: string) => ({ platformId: "google", externalId, businessExternalId: null });

describe("contas por projeto", () => {
  it("no Meta, a BM conta uma vez; sem BM, conta a própria conta", () => {
    expect(billableUnit(meta("act_1", "bm1"))).toBe("meta:bm1");
    expect(billableUnit(meta("act_1", null))).toBe("meta:act_1");
    expect(countUnits([meta("act_1", "bm1"), meta("act_2", "bm1"), meta("act_3", "bm2")])).toBe(2);
    expect(countUnits([meta("act_1", null), meta("act_2", null)])).toBe(2);
  });

  it("nas outras plataformas, cada conta conta", () => {
    expect(countUnits([google("123-456-7890"), google("234-567-8901")])).toBe(2);
    expect(countUnits([google("123-456-7890"), meta("123-456-7890", null)])).toBe(2);
  });

  it("no projeto, outra conta da mesma BM não ocupa mais", () => {
    const on = [meta("act_1", "bm1")];
    expect(fitsProject(meta("act_2", "bm1"), on, 1)).toBe(true);
    expect(fitsProject(meta("act_3", "bm2"), on, 1)).toBe(false);
    expect(fitsProject(meta("act_3", "bm2"), on, 3)).toBe(true);
  });

  it("rótulo com singular", () => {
    expect(planUsageLabel(1, 1)).toBe("1 de 1 workspace do plano");
    expect(planUsageLabel(2, 3)).toBe("2 de 3 workspaces do plano");
  });
});
