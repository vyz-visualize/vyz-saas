// Organização de teste (checkout simulado com a Stripe ligada): a marca na assinatura e o
// provedor escolhido pelo que foi gravado no pedido ou na assinatura.

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const base = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxxxxxxxxxxxxxxxxx", SUPABASE_SERVICE_ROLE_KEY: "service_role_xxxxxxxxxxxxxxxx", ALLOW_MOCKS_IN_PRODUCTION: "true" };
const stripe = { ...base, BILLING_PROVIDER: "stripe", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_x" };

async function load<T>(env: Record<string, string>, mod: string): Promise<T> {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import(mod) as Promise<T>;
}

describe("organização de teste", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("a marca é metadata.teste = true, e nada mais", async () => {
    const { isTestSubscription } = await load<typeof import("./simulated")>(stripe, "./simulated");
    expect(isTestSubscription({ teste: true })).toBe(true);
    expect(isTestSubscription({ teste: "true" })).toBe(false);
    expect(isTestSubscription({ cortesia: true })).toBe(false);
    expect(isTestSubscription(null)).toBe(false);
  });

  it("um pedido ou assinatura mock fica no simulado mesmo com a Stripe ligada; as lojas seguem o ligado", async () => {
    const { getBillingProvider } = await load<typeof import("./provider")>(stripe, "./provider");
    expect(getBillingProvider("mock").id).toBe("mock");
    expect(getBillingProvider("stripe").id).toBe("stripe");
    expect(getBillingProvider().id).toBe("stripe");
    expect(getBillingProvider("app_store").id).toBe("stripe");
    const mock = await load<typeof import("./provider")>({ ...base, BILLING_PROVIDER: "mock" }, "./provider");
    expect(mock.getBillingProvider().id).toBe("mock");
  });
});
