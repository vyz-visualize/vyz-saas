// Conexão do Meta por token: confere o token sem a prova do segredo do VYZ (o token é do app
// do cliente), lista contas e Páginas e traduz os erros do Meta em passos do tutorial.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/env", () => ({ serverEnv: () => ({ META_APP_SECRET: "segredo-do-vyz" }) }));
vi.mock("@/server/cache/redis", () => ({
  getRedis: () => null,
  cached: (_k: string, _s: number, load: () => unknown) => load(),
  countGoogleAdsOp: vi.fn(),
  googleAdsDailyCap: () => 0,
  metaAccountFromUrl: () => null,
  metaUsagePause: () => ({ pausePlatformSeconds: 0, pauseAccountSeconds: 0 }),
  pauseCalls: vi.fn(),
  requestHash: () => "h",
  secondsToUtcMidnight: () => 0,
}));

const { checkToken } = await import("./token-flow");
const { metaAuthParams } = await import("./meta-auth");
const { TOKEN_SCOPE } = await import("@/features/integrations/token-connect");

const TOKEN = `EAA${"x".repeat(120)}`;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Route = (url: URL) => Response | undefined;
let routes: Route[] = [];
const calls: URL[] = [];

beforeEach(() => {
  calls.length = 0;
  routes = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      calls.push(url);
      for (const r of routes) {
        const res = r(url);
        if (res) return res;
      }
      return json({ error: { type: "OAuthException", code: 803 } }, 404);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const metaOk: Route = (url) => {
  const p = url.pathname.replace(/^\/v[\d.]+/, "");
  if (p === "/me") return json({ id: "999", name: "VYZ" });
  if (p === "/me/permissions") return json({ data: [{ permission: "ads_read", status: "granted" }, { permission: "pages_show_list", status: "granted" }, { permission: "ads_management", status: "declined" }] });
  if (p === "/me/adaccounts") return json({ data: [{ id: "act_123", account_id: "123", name: "Loja", currency: "BRL", timezone_name: "America/Sao_Paulo", account_status: 1, business: { id: "77", name: "Agência" } }] });
  if (p === "/me/accounts") return json({ data: [{ id: "555", name: "Página da Loja", instagram_business_account: { id: "888", username: "loja" } }] });
  if (p === "/debug_token") return json({ data: { expires_at: 0 } });
  return undefined;
};

describe("checkToken (Meta)", () => {
  it("token válido: contas de anúncio, Página e Instagram, com a marca de token e sem a prova do segredo do VYZ", async () => {
    routes = [metaOk];
    const r = await checkToken("meta", { token: `  Bearer ${TOKEN}\n` });
    expect(r.tokens.accessToken).toBe(TOKEN);
    expect(r.tokens.scopes).toEqual(["ads_read", "pages_show_list", TOKEN_SCOPE]);
    expect(r.tokens.expiresAt).toBeUndefined();
    expect(r.profile).toEqual({ id: "999", name: "VYZ · token" });
    expect(r.accounts.map((a) => `${a.platform_id}:${a.external_id}`)).toEqual(["meta:act_123", "facebook:555", "instagram:888"]);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      expect(c.searchParams.get("access_token")).toBe(TOKEN);
      expect(c.searchParams.has("appsecret_proof")).toBe(false);
    }
    // depois de marcado, o mesmo token segue sem a prova também na sincronização
    expect(metaAuthParams(TOKEN)).toEqual({ access_token: TOKEN });
    expect(metaAuthParams("EAAoutro")).toHaveProperty("appsecret_proof");
  });

  it("formato errado nem chega ao Meta", async () => {
    await expect(checkToken("meta", { token: "abc123" })).rejects.toMatchObject({ code: "validation", fields: { token: expect.stringContaining("EAA") } });
    expect(calls).toHaveLength(0);
  });

  it("token recusado (190): pede um token novo", async () => {
    routes = [() => json({ error: { type: "OAuthException", code: 190 } }, 400)];
    await expect(checkToken("meta", { token: TOKEN })).rejects.toMatchObject({ code: "validation", fields: { token: expect.stringContaining("Gere um novo") } });
  });

  it("recusa genérica (100): lembra do segredo do app", async () => {
    routes = [() => json({ error: { type: "OAuthException", code: 100 } }, 400)];
    await expect(checkToken("meta", { token: TOKEN })).rejects.toMatchObject({ fields: { token: expect.stringContaining("Exigir segredo do app") } });
  });

  it("token sem nenhum ativo: manda atribuir as contas ao usuário do sistema", async () => {
    routes = [
      (url) => {
        const p = url.pathname.replace(/^\/v[\d.]+/, "");
        if (p === "/me/adaccounts" || p === "/me/accounts") return json({ data: [] });
        return metaOk(url);
      },
    ];
    await expect(checkToken("meta", { token: TOKEN })).rejects.toMatchObject({ fields: { token: expect.stringContaining("passo 4") } });
  });

  it("Meta fora do ar: pede para tentar de novo, sem culpar o token", async () => {
    routes = [() => json({ error: { code: 2 } }, 503)];
    const err = await checkToken("meta", { token: TOKEN }).catch((e) => e);
    expect(err.code).toBe("unavailable");
    expect(err.fields).toBeUndefined();
  });

  it("plataforma sem tutorial de token", async () => {
    await expect(checkToken("google", { token: "x" })).rejects.toMatchObject({ code: "validation" });
  });
});
