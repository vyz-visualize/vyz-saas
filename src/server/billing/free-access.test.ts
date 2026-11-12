import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("@/server/env");
}

describe("acesso de teste com pagamento simulado", () => {
  afterEach(() => vi.unstubAllEnvs());
  const base = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxxxxxxxxxxxxxxxxx", SUPABASE_SERVICE_ROLE_KEY: "service_role_xxxxxxxxxxxxxxxx", BILLING_PROVIDER: "mock", ALLOW_MOCKS_IN_PRODUCTION: "true" };

  it("em produção, só os e-mails da lista (sem diferenciar maiúsculas)", async () => {
    const { canCheckout } = await load({ ...base, NODE_ENV: "production", BILLING_FREE_EMAILS: "a@vyz.dev, B@vyz.dev" });
    expect(canCheckout("a@vyz.dev")).toBe(true);
    expect(canCheckout("b@VYZ.dev")).toBe(true);
    expect(canCheckout("c@vyz.dev")).toBe(false);
    expect(canCheckout(null)).toBe(false);
  });

  it("fora de produção, todos", async () => {
    const { canCheckout } = await load({ ...base, NODE_ENV: "development", BILLING_FREE_EMAILS: "" });
    expect(canCheckout("qualquer@vyz.dev")).toBe(true);
  });

  it("Recomeçar teste: só a lista, e nunca com cobrança real", async () => {
    const prod = await load({ ...base, NODE_ENV: "production", BILLING_FREE_EMAILS: "a@vyz.dev" });
    expect(prod.isTestAccount("A@vyz.dev")).toBe(true);
    expect(prod.isTestAccount("c@vyz.dev")).toBe(false);
    const empty = await load({ ...base, NODE_ENV: "production", BILLING_FREE_EMAILS: "" });
    expect(empty.isTestAccount("a@vyz.dev")).toBe(false);
    const real = await load({ ...base, NODE_ENV: "production", BILLING_PROVIDER: "stripe", BILLING_FREE_EMAILS: "a@vyz.dev", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_x" });
    expect(real.isTestAccount("a@vyz.dev")).toBe(false);
  });

  it("Refazer primeiro acesso: só a lista própria, com cobrança real ou simulada; vazia = ninguém", async () => {
    const sim = await load({ ...base, NODE_ENV: "production", ONBOARDING_REPLAY_EMAILS: "pedro@vyz.dev" });
    expect(sim.canReplayOnboarding("Pedro@vyz.dev")).toBe(true);
    expect(sim.canReplayOnboarding("outra@vyz.dev")).toBe(false);
    expect(sim.canReplayOnboarding(null)).toBe(false);
    const real = await load({ ...base, NODE_ENV: "production", BILLING_PROVIDER: "stripe", ONBOARDING_REPLAY_EMAILS: "pedro@vyz.dev", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_x" });
    expect(real.canReplayOnboarding("pedro@vyz.dev")).toBe(true);
    const empty = await load({ ...base, NODE_ENV: "development", ONBOARDING_REPLAY_EMAILS: "" });
    // diferente da conta de teste, fora de produção a lista vazia também é ninguém
    expect(empty.canReplayOnboarding("qualquer@vyz.dev")).toBe(false);
  });
});
