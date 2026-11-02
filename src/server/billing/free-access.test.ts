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
});
