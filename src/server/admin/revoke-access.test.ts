import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GOOGLE_REVOKE_URL, META_GRAPH_VERSION, META_PERMISSIONS_URL, renderRevocations, revokeAccess, type AccessToRevoke } from "./revoke-access";

const meta: AccessToRevoke = { connectionId: "c1", workspaceId: "w1", workspaceName: "Loja", provider: "meta", account: "Facebook da Ana" };
const google: AccessToRevoke = { ...meta, connectionId: "c2", provider: "google", account: "ana@gmail.com" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fake(reply: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return reply();
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

describe("Meta", () => {
  it("DELETE em /me/permissions com o token e a prova do segredo do app", async () => {
    const f = fake(() => json(200, { success: true }));
    const out = await revokeAccess(meta, { accessToken: "EAAtoken", refreshToken: null }, { fetch: f.fetch, metaAppSecret: "segredo" });
    expect(out.revoked).toBe(true);
    const url = new URL(f.calls[0].url);
    expect(`${url.origin}${url.pathname}`).toBe(META_PERMISSIONS_URL);
    expect(f.calls[0].init.method).toBe("DELETE");
    expect(f.calls[0].init.redirect).toBe("error");
    expect(url.searchParams.get("access_token")).toBe("EAAtoken");
    expect(url.searchParams.get("appsecret_proof")).toBe(createHmac("sha256", "segredo").update("EAAtoken").digest("hex"));
  });
  it("200 sem success:true não conta como revogado", async () => {
    const out = await revokeAccess(meta, { accessToken: "EAAtoken", refreshToken: null }, { fetch: fake(() => json(200, {})).fetch });
    expect(out).toMatchObject({ revoked: false, reason: "HTTP 200" });
  });
  it("token vencido: volta o motivo, sem a mensagem do provedor (que pode citar o token)", async () => {
    const f = fake(() => json(400, { error: { message: "Invalid OAuth access token EAAtoken", type: "OAuthException", code: 190 } }));
    const out = await revokeAccess(meta, { accessToken: "EAAtoken", refreshToken: null }, { fetch: f.fetch });
    expect(out).toMatchObject({ revoked: false, reason: "HTTP 400 type=OAuthException code=190" });
    expect(JSON.stringify(out)).not.toContain("EAAtoken");
  });
  it("a versão da Graph API é a mesma da integração", () => {
    const src = readFileSync(join(process.cwd(), "src/server/integrations/providers/meta.ts"), "utf8");
    expect(src).toContain(`const VERSION = "${META_GRAPH_VERSION}"`);
  });
});

describe("Google", () => {
  it("POST no endpoint de revogação, com o refresh token quando houver", async () => {
    const f = fake(() => new Response("", { status: 200 }));
    const out = await revokeAccess(google, { accessToken: "ya29", refreshToken: "1//r" }, { fetch: f.fetch });
    expect(out.revoked).toBe(true);
    expect(f.calls[0].url).toBe(GOOGLE_REVOKE_URL);
    expect(f.calls[0].init.method).toBe("POST");
    expect(f.calls[0].init.body).toBe("token=1%2F%2Fr");
  });
  it("sem refresh token, revoga o de acesso", async () => {
    const f = fake(() => new Response("", { status: 200 }));
    await revokeAccess(google, { accessToken: "ya29", refreshToken: null }, { fetch: f.fetch });
    expect(f.calls[0].init.body).toBe("token=ya29");
  });
  it("invalid_token volta como não revogado", async () => {
    const out = await revokeAccess(google, { accessToken: "ya29", refreshToken: null }, { fetch: fake(() => json(400, { error: "invalid_token" })).fetch });
    expect(out).toMatchObject({ revoked: false, reason: "HTTP 400 invalid_token" });
  });
});

describe("falhas que não podem parar a exclusão", () => {
  it("rede fora e tempo esgotado viram motivo, sem lançar", async () => {
    const down = await revokeAccess(meta, { accessToken: "t", refreshToken: null }, { fetch: fake(() => Promise.reject(new TypeError("fetch failed"))).fetch });
    expect(down).toMatchObject({ revoked: false, reason: "sem resposta do provedor (rede)" });
    const slow = fake(() => new Promise<Response>(() => {}));
    const hang = (async (url: string | URL | Request, init: RequestInit = {}) => {
      void slow.fetch(url, init);
      return new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)));
    }) as typeof fetch;
    const timedOut = await revokeAccess(meta, { accessToken: "t", refreshToken: null }, { fetch: hang, timeoutMs: 20 });
    expect(timedOut).toMatchObject({ revoked: false, reason: "sem resposta do provedor (tempo esgotado)" });
  });
  it("sem token guardado ou provedor desconhecido: nem chama", async () => {
    const f = fake(() => json(200, { success: true }));
    expect(await revokeAccess(meta, null, { fetch: f.fetch })).toMatchObject({ revoked: false, reason: "sem token guardado" });
    expect(await revokeAccess({ ...meta, provider: "tiktok" }, { accessToken: "t", refreshToken: null }, { fetch: f.fetch })).toMatchObject({ revoked: false, reason: "provedor sem revogação automática" });
    expect(f.calls).toHaveLength(0);
  });
});

describe("o relatório", () => {
  it("separa o revogado do que falta remover à mão", () => {
    const text = renderRevocations([
      { ...meta, revoked: true },
      { ...google, revoked: false, reason: "HTTP 400 invalid_token" },
    ]);
    expect(text).toMatch(/1 de 2/);
    expect(text).toMatch(/NÃO REVOGADO[^]*Google · ana@gmail\.com \(workspace "Loja"\): HTTP 400 invalid_token/);
  });
  it("sem conexão real, diz isso", () => {
    expect(renderRevocations([])).toMatch(/nenhuma conexão real/);
  });
});
