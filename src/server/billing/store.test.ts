import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { storeStateFrom } = await import("./store");

const now = new Date("2026-10-30T12:00:00Z");
const sub = (over: Record<string, unknown> = {}) => ({
  expires_date: "2026-11-30T12:00:00Z",
  purchase_date: "2026-10-30T12:00:00Z",
  store: "app_store",
  unsubscribe_detected_at: null,
  billing_issues_detected_at: null,
  grace_period_expires_date: null,
  refunded_at: null,
  ...over,
});

describe("storeStateFrom", () => {
  it("lê plano, período e limite de projetos do produto", () => {
    const s = storeStateFrom({ vyz_pro_anual_ate15: sub() }, now);
    expect(s).toMatchObject({ plan: { tier: "pro", period: "anual", accounts: 15 }, status: "active", store: "app_store", cancelAtPeriodEnd: false });
  });

  it("ignora créditos e fica com o plano que vence por último (troca de plano)", () => {
    const s = storeStateFrom(
      { vyz_creditos_100: sub(), "vyz_base_mensal_ate5:mensal": sub({ store: "play_store", expires_date: "2026-11-05T00:00:00Z" }), vyz_avancado_mensal_ate30: sub({ store: "play_store" }) },
      now,
    );
    expect(s?.plan).toEqual({ tier: "avancado", period: "mensal", accounts: 30 });
  });

  it("vencido vira cancelado; em carência vira past_due; cancelamento agendado", () => {
    expect(storeStateFrom({ vyz_base_mensal_ate5: sub({ expires_date: "2026-10-01T00:00:00Z", purchase_date: "2026-09-01T00:00:00Z" }) }, now)?.status).toBe("canceled");
    expect(
      storeStateFrom({ vyz_base_mensal_ate5: sub({ expires_date: "2026-10-29T00:00:00Z", purchase_date: "2026-09-29T00:00:00Z", grace_period_expires_date: "2026-11-05T00:00:00Z" }) }, now)?.status,
    ).toBe("past_due");
    expect(storeStateFrom({ vyz_base_mensal_ate5: sub({ unsubscribe_detected_at: "2026-10-30T13:00:00Z" }) }, now)?.cancelAtPeriodEnd).toBe(true);
  });

  it("sem plano = null; produtos antigos ou com limite errado não contam", () => {
    expect(storeStateFrom({ vyz_creditos_500: sub() }, now)).toBeNull();
    expect(storeStateFrom({ vyz_pro_anual_3: sub(), vyz_base_mensal_ate15: sub() }, now)).toBeNull();
  });
});
