import { describe, expect, it } from "vitest";
import { buildManualAccount, isManualPlatform, MANUAL_PLATFORMS } from "./manual";

describe("cadastro manual", () => {
  it("Meta e Google entram pelo login; o resto pelo ID", () => {
    expect(MANUAL_PLATFORMS).not.toContain("meta");
    expect(MANUAL_PLATFORMS).not.toContain("google");
    expect(MANUAL_PLATFORMS).toContain("ga4");
    expect(isManualPlatform("tiktok")).toBe(true);
    expect(isManualPlatform("meta")).toBe(false);
    expect(isManualPlatform("pinterest")).toBe(false);
    expect(isManualPlatform("hubspot")).toBe(true);
  });

  it("GA4: normaliza a medição e guarda os campos", () => {
    const r = buildManualAccount({ platformId: "ga4", name: "  GA4   · Loja ", values: { account: "312345678", measurement: "g-abc1234567" } });
    expect(r).toEqual({
      ok: true,
      row: {
        platform_id: "ga4",
        external_id: "312345678",
        name: "GA4 · Loja",
        business_external_id: null,
        manager_external_id: null,
        metadata: { source: "manual", fields: { account: "312345678", measurement: "G-ABC1234567" } },
      },
    });
  });

  it("sem nome, usa a plataforma e o ID", () => {
    const r = buildManualAccount({ platformId: "tiktok", values: { account: "7012345678901234567" } });
    expect(r.ok && r.row.name).toBe("TikTok · 7012345678901234567");
  });

  it("YouTube: Customer ID no formato do Google", () => {
    const r = buildManualAccount({ platformId: "youtube", values: { account: "1234567890" } });
    expect(r.ok && r.row.external_id).toBe("123-456-7890");
  });

  it("erros por campo; campos que a plataforma não tem são ignorados", () => {
    expect(buildManualAccount({ platformId: "ga4", values: { account: "G-123", measurement: "x" } })).toEqual({
      ok: false,
      errors: { account: "O ID da propriedade tem só dígitos (6 a 12).", measurement: "Use o formato G-XXXXXXX." },
    });
    expect(buildManualAccount({ platformId: "crm", values: {} })).toEqual({ ok: false, errors: { provider: "Preencha este campo.", account: "Preencha este campo." } });
    const r = buildManualAccount({ platformId: "linkedin", values: { account: "512345678", business: "999999" } });
    expect(r.ok && r.row.metadata.fields).toEqual({ account: "512345678" });
  });
});
