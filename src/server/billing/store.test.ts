import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// banco falso: store_customers devolve `customer`, subscriptions devolve `live`;
// guarda os updates e responde às chamadas do rpc na ordem de `rpcs`
type Fake = { customer: { workspace_id: string } | null; live: { id: string; provider: string }[]; rpcs: { data: unknown; error: { message: string } | null }[] };
let fake: Fake;
const updates: { table: string; values: Record<string, unknown> }[] = [];
const rpc = vi.fn(async () => fake.rpcs.shift() ?? { data: null, error: null });
function from(table: string) {
  let updating = false;
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "not", "in"]) q[m] = () => q;
  q.update = (values: Record<string, unknown>) => {
    updating = true;
    updates.push({ table, values });
    return q;
  };
  q.maybeSingle = async () => ({ data: fake.customer, error: null });
  q.then = (resolve: (v: unknown) => void) => resolve(updating ? { error: null } : { data: fake.live, error: null });
  return q;
}
vi.mock("@/server/supabase/admin", () => ({ createAdminSupabase: () => ({ rpc, from }) }));
vi.mock("@/server/env", () => ({ serverEnv: () => ({ REVENUECAT_SECRET_API_KEY: "sk_test" }) }));

const { storeStateFrom, syncStoreSubscription } = await import("./store");

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
    expect(s).toMatchObject({ plan: { tier: "pro", period: "anual", accounts: 5 }, status: "active", store: "app_store", cancelAtPeriodEnd: false });
  });

  it("ignora créditos e fica com o plano que vence por último (troca de plano)", () => {
    const s = storeStateFrom(
      { vyz_creditos_1: sub(), "vyz_base_mensal_ate5:mensal": sub({ store: "play_store", expires_date: "2026-11-05T00:00:00Z" }), vyz_avancado_mensal_ate30: sub({ store: "play_store" }) },
      now,
    );
    expect(s?.plan).toEqual({ tier: "avancado", period: "mensal", accounts: 200 });
  });

  it("vencido vira cancelado; em carência vira past_due; cancelamento agendado", () => {
    expect(storeStateFrom({ vyz_base_mensal_ate5: sub({ expires_date: "2026-10-01T00:00:00Z", purchase_date: "2026-09-01T00:00:00Z" }) }, now)?.status).toBe("canceled");
    expect(
      storeStateFrom({ vyz_base_mensal_ate5: sub({ expires_date: "2026-10-29T00:00:00Z", purchase_date: "2026-09-29T00:00:00Z", grace_period_expires_date: "2026-11-05T00:00:00Z" }) }, now)?.status,
    ).toBe("past_due");
    expect(storeStateFrom({ vyz_base_mensal_ate5: sub({ unsubscribe_detected_at: "2026-10-30T13:00:00Z" }) }, now)?.cancelAtPeriodEnd).toBe(true);
  });

  it("sem plano = null; produtos antigos ou com limite errado não contam", () => {
    expect(storeStateFrom({ vyz_creditos_5: sub() }, now)).toBeNull();
    expect(storeStateFrom({ vyz_pro_anual_3: sub(), vyz_base_mensal_ate15: sub() }, now)).toBeNull();
  });
});

describe("syncStoreSubscription com plano do site no workspace", () => {
  const later = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const subscriber = { subscriber: { subscriptions: { vyz_base_mensal_ate5: sub({ expires_date: later, purchase_date: new Date().toISOString() }) } } };
  const hasPlan = { data: null, error: { message: "store:workspace_has_plan" } };

  afterEach(() => {
    vi.unstubAllGlobals();
    rpc.mockClear();
    updates.length = 0;
  });
  const stubRevenueCat = () => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(subscriber), { status: 200 })));

  it("plano simulado (conta de teste): encerra o do site e grava o da loja", async () => {
    stubRevenueCat();
    fake = { customer: { workspace_id: "ws1" }, live: [{ id: "sub-mock", provider: "mock" }], rpcs: [hasPlan, { data: "sub-loja", error: null }] };
    await expect(syncStoreSubscription("user-1")).resolves.toBe("sub-loja");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(updates).toEqual([{ table: "subscriptions", values: expect.objectContaining({ status: "canceled" }) }]);
  });

  it("plano pago no cartão: não encerra e o erro continua", async () => {
    stubRevenueCat();
    fake = { customer: { workspace_id: "ws1" }, live: [{ id: "sub-stripe", provider: "stripe" }], rpcs: [hasPlan] };
    await expect(syncStoreSubscription("user-1")).rejects.toThrow("store:workspace_has_plan");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(updates).toEqual([]);
  });
});
