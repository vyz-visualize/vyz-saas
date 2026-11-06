import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Supabase falso: registra as chamadas e simula o insert do evento.
const calls: { table?: string; op: string; args?: unknown }[] = [];
let insertError: { code?: string } | null = null;

vi.mock("@/server/supabase/admin", () => ({
  createAdminSupabase: () => ({
    from: (table: string) => ({
      insert: (args: unknown) => {
        calls.push({ table, op: "insert", args });
        return { select: async () => ({ error: insertError }) };
      },
      update: (args: unknown) => {
        calls.push({ table, op: "update", args });
        return { eq: async () => ({ error: null }) };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
    rpc: async (fn: string, args: unknown) => {
      calls.push({ op: `rpc:${fn}`, args });
      return { error: null };
    },
  }),
}));

vi.mock("@/server/billing/store", () => ({ syncStoreSubscription: vi.fn() }));

const USER = "7b0e4f2a-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
const BASE_ENV = {
  NODE_ENV: "test",
  NEXT_PUBLIC_SUPABASE_URL: "https://exemplo.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "chave-publica-de-teste-123456",
  SUPABASE_SERVICE_ROLE_KEY: "chave-servico-de-teste-123456",
};

function req(auth: string | null, event: Record<string, unknown>) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth !== null) headers.authorization = auth;
  return new Request("http://localhost/api/webhooks/revenuecat", { method: "POST", headers, body: JSON.stringify({ event }) });
}

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...BASE_ENV, ...env })) vi.stubEnv(k, v);
  return (await import("./route")).POST;
}

beforeEach(() => {
  calls.length = 0;
  insertError = null;
});
afterEach(() => vi.unstubAllEnvs());

describe("webhook RevenueCat", () => {
  it("aceita o segredo pelo nome REVENUECAT_WEBHOOK_AUTH (com Bearer)", async () => {
    const POST = await load({ REVENUECAT_WEBHOOK_AUTH: "Bearer segredo-xyz" });
    const res = await POST(req("Bearer segredo-xyz", { id: "e1", type: "TEST" }));
    expect(res.status).toBe(200);
  });

  it("aceita header sem Bearer quando o segredo foi salvo com Bearer", async () => {
    const POST = await load({ REVENUECAT_WEBHOOK_SECRET: "Bearer segredo-xyz" });
    const res = await POST(req("segredo-xyz", { id: "e2", type: "TEST" }));
    expect(res.status).toBe(200);
  });

  it("401 com segredo errado ou ausente", async () => {
    const POST = await load({ REVENUECAT_WEBHOOK_SECRET: "segredo-xyz" });
    expect((await POST(req("Bearer outro", { id: "e3", type: "TEST" }))).status).toBe(401);
    expect((await POST(req(null, { id: "e4", type: "TEST" }))).status).toBe(401);
  });

  it("503 sem segredo configurado", async () => {
    const POST = await load({});
    expect((await POST(req("Bearer x", { id: "e5", type: "TEST" }))).status).toBe(503);
  });

  it("evento de plano (vyz_<plano>_<período>_ate<projetos>) relê a assinatura no RevenueCat", async () => {
    const POST = await load({ REVENUECAT_WEBHOOK_SECRET: "s" });
    const { syncStoreSubscription } = await import("@/server/billing/store");
    const res = await POST(req("s", { id: "p1", type: "INITIAL_PURCHASE", app_user_id: USER, product_id: "vyz_avancado_anual_ate30", store: "APP_STORE" }));
    expect(res.status).toBe(200);
    expect(syncStoreSubscription).toHaveBeenCalledWith(USER);
    expect(calls.some((c) => c.op.startsWith("rpc:credit"))).toBe(false);
  });

  it("produto de plano antigo (por projeto) não vira plano nem crédito", async () => {
    const POST = await load({ REVENUECAT_WEBHOOK_SECRET: "s" });
    const { syncStoreSubscription } = await import("@/server/billing/store");
    vi.mocked(syncStoreSubscription).mockClear();
    const res = await POST(req("s", { id: "p2", type: "INITIAL_PURCHASE", app_user_id: USER, product_id: "vyz_pro_mensal_7", store: "APP_STORE" }));
    expect(res.status).toBe(200);
    expect(syncStoreSubscription).not.toHaveBeenCalled();
  });

  it("compra de vyz_creditos_500 credita 500 uma vez", async () => {
    const POST = await load({ REVENUECAT_WEBHOOK_SECRET: "s" });
    const res = await POST(
      req("s", { id: "e6", type: "NON_RENEWING_PURCHASE", app_user_id: USER, product_id: "vyz_creditos_500", transaction_id: "GPA.1", store: "PLAY_STORE" }),
    );
    expect(res.status).toBe(200);
    const rpc = calls.find((c) => c.op === "rpc:credit_store_purchase");
    expect(rpc?.args).toMatchObject({ p_user_id: USER, p_credits: 500, p_store: "play_store", p_reason: "purchase" });
  });

  it("evento repetido responde 200 sem creditar de novo", async () => {
    const POST = await load({ REVENUECAT_WEBHOOK_SECRET: "s" });
    insertError = { code: "23505" };
    const res = await POST(
      req("s", { id: "e6", type: "NON_RENEWING_PURCHASE", app_user_id: USER, product_id: "vyz_creditos_100", transaction_id: "GPA.1" }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(calls.some((c) => c.op.startsWith("rpc:"))).toBe(false);
  });

  it("TEST padrão do painel (sem usuário nem transação) responde 200 sem creditar", async () => {
    const POST = await load({ REVENUECAT_WEBHOOK_SECRET: "s" });
    const res = await POST(req("s", { id: "e7", type: "TEST", app_user_id: "$RCAnonymousID:abc", product_id: "test_product" }));
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.op.startsWith("rpc:"))).toBe(false);
  });
  it("evento TEST real do RevenueCat (campos null) responde 200", async () => {
    const POST = await load({ REVENUECAT_WEBHOOK_SECRET: "s" });
    const res = await POST(
      req("s", { id: "e8", type: "TEST", app_user_id: "$RCAnonymousID:abc", product_id: "test_product", transaction_id: null, original_transaction_id: null, store: "APP_STORE", new_product_id: null, environment: "SANDBOX" }),
    );
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.op.startsWith("rpc:"))).toBe(false);
  });
});
