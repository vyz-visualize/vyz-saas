// Regras do servidor no primeiro acesso, com o banco imitado: o dashboard só é
// criado com conta ativa (do projeto da primeira conta), "Pular por agora" não
// cria nada, o conectar exige uma plataforma conectada e o reset não apaga nada
// e tolera a tabela de guias ainda não aplicada.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/server/analytics/queries", () => ({ dashboardTag: (id: string) => `dashboard:${id}` }));

class Redirect extends Error {
  constructor(public to: string) {
    super(`redirect:${to}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Redirect) throw err;
  },
}));

type Op = { table: string; kind: string; filters: [string, unknown][]; payload?: unknown };
const ops: Op[] = [];
const rpcs: { fn: string; args: Record<string, unknown> }[] = [];
const fixtures: Record<string, unknown[]> = {};
const errors: Record<string, { code: string; message: string } | undefined> = {};

function builder(table: string) {
  const op: Op = { table, kind: "select", filters: [] };
  const b = {
    select: () => b,
    eq: (c: string, v: unknown) => (op.filters.push([c, v]), b),
    is: (c: string, v: unknown) => (op.filters.push([c, v]), b),
    not: () => b,
    in: () => b,
    gte: () => b,
    order: () => b,
    limit: () => b,
    single: () => b,
    insert: (p: unknown) => ((op.kind = "insert"), (op.payload = p), b),
    update: (p: unknown) => ((op.kind = "update"), (op.payload = p), b),
    delete: () => ((op.kind = "delete"), b),
    upsert: (p: unknown) => ((op.kind = "upsert"), (op.payload = p), b),
    then: (ok: (v: unknown) => void) => {
      ops.push(op);
      const err = errors[`${table}:${op.kind}`];
      if (err) return Promise.resolve({ data: null, error: err }).then(ok);
      const data = op.kind === "select" ? (fixtures[table] ?? []) : op.kind === "insert" ? { id: "novo-1" } : [];
      return Promise.resolve({ data, error: null }).then(ok);
    },
  };
  return b;
}

vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: vi.fn(async () => ({
    from: (t: string) => builder(t),
    rpc: async (fn: string, args: Record<string, unknown>) => (rpcs.push({ fn, args }), { data: "dash-1", error: null }),
  })),
}));

const session = {
  user: { id: "u1", email: "pedro@vyz.dev", fullName: "Pedro Freitas" },
  role: "owner",
  workspace: { id: "ws1", name: "Agência", onboardingStep: "dashboard" as string, businessTypeId: "ecommerce", timezone: "America/Sao_Paulo" },
  access: { tier: "avancado", entitlements: { pages: "avancado" }, hasAccess: true },
};
vi.mock("@/server/auth/workspace", () => ({ authorize: vi.fn(async () => session) }));
vi.mock("@/server/history/log", () => ({ logActivity: vi.fn(async () => undefined) }));
const connect = { platforms: { meta: { connected: false }, google: { connected: false } } };
vi.mock("@/server/integrations/queries", () => ({ getConnectState: vi.fn(async () => connect) }));
const replayAllowed = { value: true };
vi.mock("@/server/env", () => ({ canReplayOnboarding: () => replayAllowed.value }));

const TEMPLATE = "vyz-ecommerce";
const workspaceUpdates = () => ops.filter((o) => o.table === "workspaces" && o.kind === "update").map((o) => o.payload as { onboarding_step: string });

beforeEach(() => {
  ops.length = 0;
  rpcs.length = 0;
  for (const k of Object.keys(fixtures)) delete fixtures[k];
  for (const k of Object.keys(errors)) delete errors[k];
  session.workspace.onboardingStep = "dashboard";
  connect.platforms.meta.connected = false;
  replayAllowed.value = true;
});

describe("montar o primeiro dashboard", () => {
  it("sem conta ativa, não cria dashboard nem conclui o primeiro acesso", async () => {
    const { buildFirstDashboard } = await import("./actions");
    fixtures.ad_accounts = [];
    const res = await buildFirstDashboard(TEMPLATE);
    expect(res).toMatchObject({ ok: false, error: { code: "onboarding:no_accounts" } });
    expect(rpcs).toEqual([]);
    expect(workspaceUpdates()).toEqual([]);
  });

  it("com contas, liga as do projeto da primeira conta, sem concluir ainda (a tela Montando segue no ar)", async () => {
    const { buildFirstDashboard } = await import("./actions");
    fixtures.ad_accounts = [
      { id: "a1", platform_id: "meta", project_id: "p1" },
      { id: "a2", platform_id: "google", project_id: "p1" },
      { id: "a3", platform_id: "meta", project_id: "p2" },
    ];
    fixtures.projects = [{ name: "Loja da Ana" }];
    const res = await buildFirstDashboard(TEMPLATE);
    expect(res).toEqual({ ok: true, data: { id: "dash-1" } });
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0].fn).toBe("create_dashboard");
    expect(rpcs[0].args.p_ad_account_ids).toEqual(["a1", "a2"]);
    expect(rpcs[0].args.p_client_name).toBe("Loja da Ana");
    // concluir agora redesenharia /comecar no meio da montagem: fica para finishFirstAccess
    expect(workspaceUpdates()).toEqual([]);
  });

  it("refazer o primeiro acesso reaproveita o dashboard do primeiro acesso anterior do projeto (contas e páginas de agora)", async () => {
    const { buildFirstDashboard } = await import("./actions");
    fixtures.ad_accounts = [{ id: "a1", platform_id: "meta", project_id: "p1" }];
    fixtures.activity_events = [{ entity_id: "dash-antigo" }];
    fixtures.dashboards = [{ id: "dash-antigo" }];
    expect(await buildFirstDashboard(TEMPLATE)).toEqual({ ok: true, data: { id: "dash-antigo" } });
    expect(rpcs.map((r) => r.fn)).toEqual(["set_dashboard_sources", "set_dashboard_pages"]);
    expect(rpcs[0].args).toMatchObject({ p_dashboard_id: "dash-antigo", p_ad_account_ids: ["a1"] });
  });

  it("sem primeiro acesso anterior no projeto, cria um novo", async () => {
    const { buildFirstDashboard } = await import("./actions");
    fixtures.ad_accounts = [{ id: "a1", platform_id: "meta", project_id: "p1" }];
    fixtures.activity_events = [];
    expect(await buildFirstDashboard(TEMPLATE)).toEqual({ ok: true, data: { id: "dash-1" } });
    expect(rpcs.map((r) => r.fn)).toEqual(["create_dashboard"]);
  });

  it("fase 2: conclui o primeiro acesso e abre o dashboard com o tour", async () => {
    const { finishFirstAccess } = await import("./actions");
    fixtures.dashboards = [{ id: "11111111-1111-4111-8111-111111111111", sources: [{ ad_account_id: "a1" }] }];
    await expect(finishFirstAccess("11111111-1111-4111-8111-111111111111")).rejects.toThrow("redirect:/painel/dashboards/11111111-1111-4111-8111-111111111111?tour=1");
    expect(workspaceUpdates().map((u) => u.onboarding_step)).toEqual(["done"]);
  });

  it("fase 2 com um id que não é do workspace: não conclui", async () => {
    const { finishFirstAccess } = await import("./actions");
    fixtures.dashboards = [];
    expect(await finishFirstAccess("11111111-1111-4111-8111-111111111111")).toMatchObject({ ok: false, error: { code: "dashboard:not_found" } });
    expect(workspaceUpdates()).toEqual([]);
  });

  it("antes do passo de contas e modelo, recusa", async () => {
    const { buildFirstDashboard } = await import("./actions");
    session.workspace.onboardingStep = "connect";
    const res = await buildFirstDashboard(TEMPLATE);
    expect(res).toMatchObject({ ok: false, error: { code: "onboarding:step" } });
    expect(rpcs).toEqual([]);
  });
});

describe("pular e conectar", () => {
  it('"Pular por agora" conclui sem criar nada e volta para a Início', async () => {
    const { skipOnboarding } = await import("./actions");
    session.workspace.onboardingStep = "connect";
    await expect(skipOnboarding("connect")).rejects.toThrow("redirect:/painel");
    expect(rpcs).toEqual([]);
    expect(ops.filter((o) => o.kind === "insert" && o.table !== "workspaces")).toEqual([]);
    expect(workspaceUpdates().map((u) => u.onboarding_step)).toEqual(["done"]);
  });

  it("do conectar só segue com uma plataforma conectada", async () => {
    const { continueToSetup } = await import("./actions");
    session.workspace.onboardingStep = "connect";
    fixtures.connections = [];
    expect(await continueToSetup()).toMatchObject({ ok: false, error: { code: "onboarding:no_connection" } });
    fixtures.connections = [{ id: "c1" }];
    await expect(continueToSetup()).rejects.toThrow("redirect:/comecar");
    expect(workspaceUpdates().map((u) => u.onboarding_step)).toEqual(["dashboard"]);
  });
});

describe("refazer primeiro acesso", () => {
  it("volta ao começo sem apagar nada além dos guias da pessoa", async () => {
    const { replayFirstAccess } = await import("./replay");
    session.workspace.onboardingStep = "done";
    await expect(replayFirstAccess()).rejects.toThrow("redirect:/comecar");
    expect(workspaceUpdates()).toEqual([{ onboarding_step: "business", onboarding_completed_at: null }]);
    const deletes = ops.filter((o) => o.kind === "delete");
    expect(deletes.map((d) => [d.table, d.filters])).toEqual([["user_guides", [["user_id", "u1"]]]]);
  });

  it("tolera a tabela de guias ainda não aplicada no banco", async () => {
    const { replayFirstAccess } = await import("./replay");
    errors["user_guides:delete"] = { code: "PGRST205", message: "Could not find the table 'public.user_guides' in the schema cache" };
    await expect(replayFirstAccess()).rejects.toThrow("redirect:/comecar");
    expect(workspaceUpdates()).toHaveLength(1);
  });

  it("e-mail fora da lista: não mexe em nada", async () => {
    const { replayFirstAccess } = await import("./replay");
    replayAllowed.value = false;
    expect(await replayFirstAccess()).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(ops).toEqual([]);
  });
});
