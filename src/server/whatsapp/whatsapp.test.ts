import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidSignature, signBody } from "./signature";
import { advances, parseWebhook } from "./webhook";

vi.mock("server-only", () => ({}));

const base = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xxxxxxxxxxxxxxxxxxxx", SUPABASE_SERVICE_ROLE_KEY: "service_role_xxxxxxxxxxxxxxxx", NODE_ENV: "test" };

async function client(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...base, ...env })) vi.stubEnv(k, v);
  return import("./client");
}

describe("assinatura do webhook", () => {
  const body = '{"entry":[]}';
  it("aceita a assinatura certa", () => expect(isValidSignature(body, signBody(body, "segredo"), "segredo")).toBe(true));
  it("recusa assinatura errada, ausente ou sem segredo", () => {
    expect(isValidSignature(body, signBody(body, "outro"), "segredo")).toBe(false);
    expect(isValidSignature(body + " ", signBody(body, "segredo"), "segredo")).toBe(false);
    expect(isValidSignature(body, null, "segredo")).toBe(false);
    expect(isValidSignature(body, signBody(body, "segredo"), undefined)).toBe(false);
    expect(isValidSignature(body, "sha256=abc", "segredo")).toBe(false);
  });
});

describe("corpo do webhook", () => {
  it("lê status e mensagens", () => {
    const r = parseWebhook({
      entry: [{ changes: [{ value: { statuses: [{ id: "w1", status: "read" }, { id: "w2", status: "failed", errors: [{ code: 131026, title: "Undeliverable" }] }], messages: [{ id: "m1", from: "5571999999999", type: "text", text: { body: "PARAR" } }] } }] }],
    });
    expect(r.statuses).toEqual([{ id: "w1", status: "read", error: null }, { id: "w2", status: "failed", error: "131026 Undeliverable" }]);
    expect(r.messages).toEqual([{ id: "m1", from: "+5571999999999", text: "PARAR" }]);
  });
  it("status não volta atrás", () => {
    expect(advances("delivered", "read")).toBe(true);
    expect(advances("read", "delivered")).toBe(false);
  });
});

describe("envio", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sem configuração: simulado, sem chamar a API", async () => {
    const { sendTemplate, sendText } = await client({ WHATSAPP_PHONE_NUMBER_ID: "", WHATSAPP_ACCESS_TOKEN: "" });
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetcher = vi.fn();
    const r = await sendTemplate("+5571999999999", "diario", ["Ana", "Loja", "Alta.", "Detalhe"], fetcher as unknown as typeof fetch);
    expect(r.status).toBe("simulado");
    expect(r.body).toContain("Bom dia, Ana!");
    expect((await sendText("+5571999999999", "oi", fetcher as unknown as typeof fetch)).status).toBe("simulado");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("configurado: chama o Graph com o template e traduz erros", async () => {
    const { sendTemplate } = await client({ WHATSAPP_PHONE_NUMBER_ID: "123", WHATSAPP_ACCESS_TOKEN: "tok" });
    const ok = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 }));
    const r = await sendTemplate("+5571999999999", "codigo", ["123456"], ok as unknown as typeof fetch);
    expect(r).toMatchObject({ status: "sent", providerMessageId: "wamid.1" });
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/123\/messages$/);
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({ to: "5571999999999", type: "template", template: { name: "vyz_codigo_verificacao", language: { code: "pt_BR" } } });
    expect(sent.template.components).toHaveLength(2);

    const bad = vi.fn(async () => new Response(JSON.stringify({ error: { code: 132001, message: "x" } }), { status: 400 }));
    const f = await sendTemplate("+5571999999999", "alertas", ["a", "b", "c", "d"], bad as unknown as typeof fetch);
    expect(f.status).toBe("failed");
    expect(f.error).toMatch(/Template não existe/);
  });
});
