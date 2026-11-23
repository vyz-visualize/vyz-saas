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

type Route = (url: URL, init?: RequestInit) => Response | undefined;
let routes: Route[] = [];
const calls: URL[] = [];
const inits: (RequestInit | undefined)[] = [];

beforeEach(() => {
  calls.length = 0;
  inits.length = 0;
  routes = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push(url);
      inits.push(init);
      for (const r of routes) {
        const res = r(url, init);
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

// ---- outras plataformas ------------------------------------------------------------------------

const { generateKeyPairSync, createVerify } = await import("node:crypto");

describe("checkToken (GA4 por conta de serviço)", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const key = JSON.stringify({ type: "service_account", project_id: "p", client_email: "vyz@p.iam.gserviceaccount.com", private_key: pem });
  let assertion = "";
  const google: Route = (url, init) => {
    if (url.host === "oauth2.googleapis.com") {
      assertion = new URLSearchParams(String(init?.body)).get("assertion") ?? "";
      return json({ access_token: "ya29.sa", expires_in: 3600 });
    }
    if (url.pathname.endsWith("/accountSummaries")) return json({ accountSummaries: [{ account: "accounts/1", displayName: "Loja", propertySummaries: [{ property: "properties/321", displayName: "Site" }] }] });
    return undefined;
  };

  it("troca a chave por um token assinado, guarda a chave para renovar e lista as propriedades", async () => {
    routes = [google];
    const r = await checkToken("ga4", { json: key });
    expect(r.tokens.accessToken).toBe("ya29.sa");
    expect(r.tokens.refreshToken?.startsWith("sa:")).toBe(true);
    expect(r.tokens.scopes).toContain(TOKEN_SCOPE);
    expect(r.profile).toMatchObject({ id: "token:vyz@p.iam.gserviceaccount.com", email: "vyz@p.iam.gserviceaccount.com" });
    expect(r.accounts.map((a) => `${a.platform_id}:${a.external_id}`)).toEqual(["ga4:321"]);
    const [head, body, sig] = assertion.split(".");
    expect(JSON.parse(Buffer.from(body, "base64url").toString())).toMatchObject({ iss: "vyz@p.iam.gserviceaccount.com", aud: "https://oauth2.googleapis.com/token" });
    expect(createVerify("RSA-SHA256").update(`${head}.${body}`).verify(publicKey, sig, "base64url")).toBe(true);
  });

  it("conta de serviço sem acesso a nenhuma propriedade: diz qual e-mail adicionar", async () => {
    routes = [(url, init) => (url.pathname.endsWith("/accountSummaries") ? json({}) : google(url, init))];
    await expect(checkToken("ga4", { json: key })).rejects.toMatchObject({ fields: { json: expect.stringContaining("vyz@p.iam.gserviceaccount.com") } });
  });

  it("o que não é chave de conta de serviço nem sai do servidor", async () => {
    await expect(checkToken("ga4", { json: '{"type":"authorized_user"}' })).rejects.toMatchObject({ fields: { json: expect.stringContaining("passo 3") } });
    expect(calls).toHaveLength(0);
  });
});

describe("checkToken (TikTok pelo app do cliente)", () => {
  const tiktok: Route = (url) => {
    if (url.pathname.endsWith("/oauth2/access_token/")) return json({ code: 0, data: { access_token: "tt-long", scope: [1, 4] } });
    if (url.pathname.endsWith("/oauth2/advertiser/get/")) return json({ code: 0, data: { list: [{ advertiser_id: "7001", advertiser_name: "Loja" }] } });
    if (url.pathname.endsWith("/user/info/")) return json({ code: 0, data: { core_user_id: "u1", display_name: "Ana" } });
    return undefined;
  };

  it("troca o auth_code (colado dentro do endereço) pelo token de longo prazo", async () => {
    routes = [tiktok];
    const r = await checkToken("tiktok", { app_id: "7123456789", secret: "s3", auth_code: "https://loja.com/retorno?auth_code=abc123&state=x" });
    expect(JSON.parse(String(inits[0]?.body))).toEqual({ app_id: "7123456789", secret: "s3", auth_code: "abc123" });
    expect(r.tokens).toMatchObject({ accessToken: "tt-long", scopes: ["1", "4", TOKEN_SCOPE] });
    expect(r.tokens.refreshToken).toBeUndefined();
    expect(r.profile.id).toBe("token:u1");
    expect(r.accounts.map((a) => `${a.platform_id}:${a.external_id}`)).toEqual(["tiktok:7001"]);
  });

  it("código vencido ou de outro app: pede para autorizar de novo", async () => {
    routes = [(url) => (url.pathname.endsWith("/oauth2/access_token/") ? json({ code: 40105, message: "auth_code expired" }) : undefined)];
    await expect(checkToken("tiktok", { app_id: "7123456789", secret: "s3", auth_code: "abc" })).rejects.toMatchObject({ fields: { auth_code: expect.stringContaining("1 hora") } });
  });
});

describe("checkToken (LinkedIn, HubSpot, Pipedrive e Kommo)", () => {
  it("LinkedIn: lista as contas e, sem perfil no token, se identifica pela primeira conta; vale 60 dias", async () => {
    routes = [
      (url) => {
        if (url.pathname === "/rest/adAccounts") return json({ elements: [{ id: 501, name: "Conta", currency: "BRL", status: "ACTIVE" }] });
        if (url.pathname === "/v2/userinfo") return json({ status: 401 }, 401);
        return undefined;
      },
    ];
    const r = await checkToken("linkedin", { token: `AQV${"z".repeat(80)}` });
    expect(r.profile.id).toBe("token:ads-501");
    expect(r.accounts.map((a) => `${a.platform_id}:${a.external_id}`)).toEqual(["linkedin:501"]);
    const days = (Date.parse(r.tokens.expiresAt!) - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(60);
  });

  it("HubSpot: portal pelo token do app privado; sem o escopo de negócios, diz quais marcar", async () => {
    const hub = (deals: Response): Route => (url) => {
      if (url.pathname === "/account-info/v3/details") return json({ portalId: 123, uiDomain: "app.hubspot.com", companyCurrency: "BRL" });
      if (url.pathname === "/crm/v3/objects/deals") return deals;
      return undefined;
    };
    routes = [hub(json({ results: [] }))];
    const r = await checkToken("hubspot", { token: `pat-na1-${"a".repeat(36)}` });
    expect(r.accounts.map((a) => `${a.platform_id}:${a.external_id}`)).toEqual(["hubspot:123"]);
    expect(r.profile.id).toBe("token:123");

    routes = [hub(json({ status: "error", category: "MISSING_SCOPES" }, 403))];
    await expect(checkToken("hubspot", { token: `pat-na1-${"a".repeat(36)}` })).rejects.toMatchObject({ fields: { token: expect.stringContaining("passo 2") } });
    await expect(checkToken("hubspot", { token: "abc" })).rejects.toMatchObject({ fields: { token: expect.stringContaining("pat-") } });
  });

  it("Pipedrive: o token pessoal vai no endereço, não no cabeçalho, e fica guardado com o prefixo", async () => {
    const t = "0123456789abcdef0123456789abcdef01234567";
    routes = [(url) => (url.pathname === "/v1/users/me" ? json({ data: { id: 9, name: "Ana", company_id: 44, company_name: "Loja" } }) : undefined)];
    const r = await checkToken("pipedrive", { token: t });
    expect(r.tokens.accessToken).toBe(`api_token:${t}`);
    expect(calls.every((c) => c.searchParams.get("api_token") === t)).toBe(true);
    expect(inits.every((i) => !new Headers(i?.headers).has("authorization"))).toBe(true);
    expect(r.accounts.map((a) => `${a.platform_id}:${a.external_id}`)).toEqual(["pipedrive:44"]);
  });

  it("Kommo: completa o endereço, guarda domínio|token e lê a validade do token", async () => {
    const exp = Math.floor(Date.now() / 1000) + 365 * 86_400;
    const jwt = `${Buffer.from('{"alg":"RS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.${"s".repeat(120)}`;
    routes = [(url) => (url.host === "loja.kommo.com" && url.pathname === "/api/v4/account" ? json({ id: 31, name: "Loja", subdomain: "loja" }) : undefined)];
    const r = await checkToken("kommo", { domain: "Loja", token: jwt });
    expect(r.tokens.accessToken).toBe(`loja.kommo.com|${jwt}`);
    expect(r.tokens.expiresAt).toBe(new Date(exp * 1000).toISOString());
    expect(r.accounts.map((a) => `${a.platform_id}:${a.external_id}`)).toEqual(["kommo:loja"]);
    await expect(checkToken("kommo", { domain: "loja.exemplo.com", token: jwt })).rejects.toMatchObject({ fields: { domain: expect.any(String) } });
  });
});
