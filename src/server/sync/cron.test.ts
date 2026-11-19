// Quem pode chamar as rotas do agendador (/api/cron/*): só com o CRON_SECRET no Authorization.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const env: { CRON_SECRET?: string } = {};
vi.mock("@/server/env", () => ({ serverEnv: () => env }));

const { rejectCron } = await import("./cron");

const call = (authorization?: string) => new Request("https://vyzualize.com.br/api/cron/sync", { headers: authorization ? { authorization } : {} });

describe("rejectCron", () => {
  beforeEach(() => {
    env.CRON_SECRET = "segredo-de-teste-com-32-caracteres";
  });

  it("sem CRON_SECRET, a rota fica fechada (503)", async () => {
    delete env.CRON_SECRET;
    const r = rejectCron(call("Bearer qualquer"));
    expect(r?.status).toBe(503);
    expect(await r?.json()).toMatchObject({ ok: false, error: "cron:not_configured" });
  });

  it("sem cabeçalho ou com o segredo errado: 401", () => {
    expect(rejectCron(call())?.status).toBe(401);
    expect(rejectCron(call("Bearer errado"))?.status).toBe(401);
    expect(rejectCron(call("segredo-de-teste-com-32-caracteres"))?.status).toBe(401);
  });

  it("com o segredo certo, segue (null) e as respostas não vão para cache", () => {
    expect(rejectCron(call("Bearer segredo-de-teste-com-32-caracteres"))).toBeNull();
    expect(rejectCron(call())?.headers.get("cache-control")).toBe("no-store");
  });
});
