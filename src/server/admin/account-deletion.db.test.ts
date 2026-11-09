// A exclusão de verdade, num Postgres de verdade (PGlite, em memória) com as migrações reais.
// Os cenários dividem o mesmo banco e rodam em ordem; um terceiro, criado no começo, não pode mudar.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { applyPlan, loadPlan, planCode, readTokens, refuseReason, renderPlan, type DeletionPlan } from "./account-deletion";
import { revokeAll, type RevokeOutcome } from "./revoke-access";
import { adapter, count, createUser, freshDb, fullWorkspace, seedCatalog, seeder, type Ins } from "./testing/pglite";

let db: PGlite;
let ins: Ins;
const n = (from: string, params: unknown[] = []) => count(db, from, params);
const apply = (plan: DeletionPlan) => db.transaction((tx) => applyPlan(adapter(tx), plan));

let witness: { id: string; ws: string };
const witnessState = async () => ({
  ws: await n(`public.workspaces where id = $1`, [witness.ws]),
  insights: await n(`public.insights_account_daily where workspace_id = $1`, [witness.ws]),
  tasks: await n(`public.tasks where workspace_id = $1`, [witness.ws]),
  wa: await n(`public.whatsapp_subscriptions where user_id = $1`, [witness.id]),
  user: await n(`auth.users where id = $1`, [witness.id]),
  secrets: await n(`vault.secrets where name = 'vyz:do-ze'`),
});
let witnessBefore: Awaited<ReturnType<typeof witnessState>>;

/** Um provedor de mentira: responde como mandarem e guarda o que recebeu. */
function fakeProvider(reply: (url: string) => Response | Promise<Response>) {
  const calls: { url: string; method: string; body: string }[] = [];
  const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: String(init?.body ?? "") });
    return reply(url);
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeAll(async () => {
  db = await freshDb();
  ins = seeder(db);
  await seedCatalog(db, ins);
  const id = await createUser(db, "ze@exemplo.com");
  const w = await fullWorkspace(db, ins, { userId: id, name: "Do Zé", slug: "do-ze" });
  witness = { id, ws: w.id };
  witnessBefore = await witnessState();
}, 120_000);

describe("sozinha, sem registro financeiro: o workspace sai por inteiro", () => {
  let id: string;
  let ws: string;
  let plan: DeletionPlan;
  beforeAll(async () => {
    id = await createUser(db, "ana@exemplo.com");
    ws = (await fullWorkspace(db, ins, { userId: id, name: "Loja da Ana", slug: "loja-ana" })).id;
    await ins("push_tokens", { user_id: id, platform: "ios", token: "tok-ana-".padEnd(40, "0") });
    await ins("credit_ledger", { user_id: id, delta: 5, reason: "purchase" });
    await ins("workspace_invitations", { workspace_id: witness.ws, email: "ana@exemplo.com", token_hash: "b".repeat(64), invited_by: witness.id });
    await ins("checkout_sessions", { email: "ana@exemplo.com", full_name: "Ana", company_name: "Ana", provider: "mock", interval: "month", selection: {}, quote: {}, amount_due_now_cents: 1, tax_id: "12345678901" });
    plan = await loadPlan(adapter(db), "ANA@exemplo.com ");
  });

  it("a simulação classifica, lista o acesso a revogar e não apaga nada", async () => {
    expect(plan.workspaces[0].mode).toBe("delete");
    expect(plan.blockers).toEqual([]);
    expect(plan.revocations).toMatchObject([{ provider: "meta", account: "Facebook de Loja da Ana", workspaceName: "Loja da Ana" }]);
    expect(plan.workspaces[0].files).toEqual([`brand-assets/${ws}/logo-abc.png`]);
    expect(renderPlan(plan)).toMatch(/ACESSO A REVOGAR NA ORIGEM[^]*Meta · Facebook de Loja da Ana/);
    expect(await n(`auth.users where id = $1`, [id])).toBe(1);
    expect(await n(`public.workspaces where id = $1`, [ws])).toBe(1);
  });

  it("só aceita com o e-mail e o código", () => {
    expect(refuseReason(plan, {})).toBeTruthy();
    expect(refuseReason(plan, { email: "ana@exemplo.com", code: planCode(plan) })).toBeNull();
  });

  it("lê o token do Vault para revogar, e a revogação manda o token certo à Meta", async () => {
    const pending = await readTokens(adapter(db), plan);
    expect(pending).toHaveLength(1);
    expect(pending[0].tokens).toEqual({ accessToken: "token-secreto-loja-ana", refreshToken: null });
    const meta = fakeProvider(() => json(200, { success: true }));
    const outcomes = await revokeAll(pending, { fetch: meta.fetch, metaAppSecret: "segredo" });
    expect(outcomes.every((o) => o.revoked)).toBe(true);
    expect(meta.calls).toHaveLength(1);
    expect(meta.calls[0].method).toBe("DELETE");
    expect(new URL(meta.calls[0].url).searchParams.get("access_token")).toBe("token-secreto-loja-ana");
  });

  it("apaga tudo: login, workspace, conteúdo, token, push, créditos, convite e compra aberta", async () => {
    await apply(plan);
    expect(await n(`auth.users where id = $1`, [id])).toBe(0);
    expect(await n(`public.profiles where id = $1`, [id])).toBe(0);
    expect(await n(`public.workspaces where id = $1`, [ws])).toBe(0);
    for (const t of ["connections", "ad_accounts", "ad_campaigns", "insights_account_daily", "projects", "dashboards", "scheduled_reports", "tasks", "task_groups", "optimization_runs", "landing_pages", "landing_page_submissions", "whatsapp_subscriptions", "subscriptions"]) {
      expect(await n(`public.${t} where workspace_id = $1`, [ws]), t).toBe(0);
    }
    expect(await n(`vault.secrets where name = 'vyz:loja-ana'`)).toBe(0);
    expect(await n(`public.push_tokens where user_id = $1`, [id])).toBe(0);
    expect(await n(`public.credit_ledger where user_id = $1`, [id])).toBe(0);
    expect(await n(`public.workspace_invitations where email = 'ana@exemplo.com'`)).toBe(0);
    expect(await n(`public.checkout_sessions where email = 'ana@exemplo.com'`)).toBe(0);
  });
});

describe("sozinho, com fatura: os dois restrict seguram e o workspace vira casca", () => {
  let id: string;
  let ws: string;
  let plan: DeletionPlan;
  beforeAll(async () => {
    id = await createUser(db, "bia@exemplo.com");
    ws = (await fullWorkspace(db, ins, { userId: id, name: "Empresa da Bia", slug: "empresa-bia" })).id;
    // a assinatura simulada do workspace cheio dá lugar à da Stripe, já cancelada
    await db.query(`update public.subscriptions set status = 'canceled', canceled_at = now(), ended_at = now() where workspace_id = $1`, [ws]);
    const s = await ins("subscriptions", { workspace_id: ws, plan_id: "pro", provider: "stripe", status: "canceled", interval: "month", accounts_quantity: 1, current_period_start: "2026-11-01T00:00:00Z", current_period_end: "2026-12-01T00:00:00Z" });
    const cs = await db.query<{ id: string }>(
      `insert into public.checkout_sessions (status, completed_at, user_id, workspace_id, provider, email, full_name, company_name, interval, selection, quote, amount_due_now_cents, tax_id)
       values ('completed', now(), $1, $2, 'stripe', 'bia@exemplo.com', 'Bia', 'Empresa', 'month', '{}', '{}', 100, '12345678000199') returning id`,
      [id, ws],
    );
    const inv = await ins("invoices", { workspace_id: ws, subscription_id: s.id, checkout_session_id: cs.rows[0].id, provider: "stripe", status: "paid", subtotal_cents: 100, total_cents: 100 });
    await ins("payment_transactions", { workspace_id: ws, invoice_id: inv.id, provider: "stripe", status: "succeeded", amount_cents: 100 });
    await ins("billing_customers", { workspace_id: ws, provider: "stripe", provider_customer_id: "cus_bia", email: "bia@exemplo.com", legal_name: "Empresa da Bia Ltda", tax_id: "12345678000199" });
    await ins("checkout_sessions", { email: "bia@exemplo.com", full_name: "Bia", company_name: "Bia", provider: "mock", interval: "month", selection: {}, quote: {}, amount_due_now_cents: 1 });
  });

  it("prova: o banco não deixa apagar o workspace direto", async () => {
    await expect(db.query(`delete from public.workspaces where id = $1`, [ws])).rejects.toThrow(/foreign key|violates/);
  });

  it("a simulação classifica como casca e mostra o que fica", async () => {
    plan = await loadPlan(adapter(db), "bia@exemplo.com");
    expect(plan.workspaces[0].mode).toBe("shell");
    expect(renderPlan(plan)).toMatch(/1 em invoices[^]*1 em payment_transactions/);
  });

  it("apaga o conteúdo, anonimiza a casca e guarda o fiscal sem o vínculo com a pessoa", async () => {
    await apply(plan);
    expect(await n(`auth.users where id = $1`, [id])).toBe(0);
    const shell = (await db.query<Record<string, unknown>>(`select name, slug, created_by, brand_logo_path from public.workspaces where id = $1`, [ws])).rows[0];
    expect(shell).toMatchObject({ name: "Conta excluída", created_by: null, brand_logo_path: null });
    expect(String(shell.slug)).toMatch(/^excluida-/);
    expect(JSON.stringify(shell)).not.toContain("Bia");
    expect(await n(`public.invoices where workspace_id = $1`, [ws])).toBe(1);
    expect(await n(`public.payment_transactions where workspace_id = $1`, [ws])).toBe(1);
    expect(await n(`public.billing_customers where workspace_id = $1`, [ws])).toBe(1);
    expect(await n(`public.checkout_sessions where email = 'bia@exemplo.com' and status = 'completed' and user_id is null`)).toBe(1);
    expect(await n(`public.checkout_sessions where email = 'bia@exemplo.com' and status <> 'completed'`)).toBe(0);
    for (const t of ["connections", "ad_accounts", "insights_account_daily", "projects", "dashboards", "tasks", "optimization_runs", "landing_pages", "landing_page_submissions", "whatsapp_subscriptions", "subscriptions", "workspace_members"]) {
      expect(await n(`public.${t} where workspace_id = $1`, [ws]), t).toBe(0);
    }
    expect(await n(`vault.secrets where name = 'vyz:empresa-bia'`)).toBe(0);
  });
});

describe("dono de workspace com equipe: os dados ficam com a equipe", () => {
  let id: string;
  let dani: string;
  let ws: string;
  let plan: DeletionPlan;
  beforeAll(async () => {
    id = await createUser(db, "caio@exemplo.com");
    dani = await createUser(db, "dani@exemplo.com");
    ws = (await fullWorkspace(db, ins, { userId: id, name: "Agência", slug: "agencia" })).id;
    await ins("workspace_members", { workspace_id: ws, user_id: dani, role: "member" });
    const rep = (await db.query<{ id: string }>(`select id from public.scheduled_reports where workspace_id = $1 limit 1`, [ws])).rows[0];
    await ins("scheduled_report_recipients", { workspace_id: ws, report_id: rep.id, channel: "email", address: "caio@exemplo.com" });
    await ins("scheduled_report_recipients", { workspace_id: ws, report_id: rep.id, channel: "email", address: "dani@exemplo.com" });
    await ins("scheduled_report_recipients", { workspace_id: ws, report_id: rep.id, channel: "whatsapp", address: "5571988887777" });
    plan = await loadPlan(adapter(db), "caio@exemplo.com");
  });

  it("não revoga a conexão que fica, mas avisa que ela usa o acesso da pessoa", () => {
    expect(plan.workspaces[0].mode).toBe("leave");
    expect(plan.revocations).toEqual([]);
    expect(plan.warnings.some((w) => w.includes("propriedade"))).toBe(true);
    expect(plan.warnings.some((w) => /conexão Meta \(Facebook de Agência\) foi feita pela pessoa/.test(w))).toBe(true);
  });

  it("a pessoa sai; o workspace, as métricas e o colega ficam", async () => {
    await apply(plan);
    expect(await n(`auth.users where id = $1`, [id])).toBe(0);
    expect(await n(`public.workspaces where id = $1`, [ws])).toBe(1);
    expect(await n(`public.workspace_members where workspace_id = $1 and user_id = $2 and role = 'owner'`, [ws, dani])).toBe(1);
    expect(await n(`public.insights_account_daily where workspace_id = $1`, [ws])).toBe(1);
    expect(await n(`public.whatsapp_subscriptions where workspace_id = $1 and user_id = $2`, [ws, id])).toBe(0);
    expect(await n(`public.scheduled_report_recipients where address in ('caio@exemplo.com', '5571988887777')`)).toBe(0);
    expect(await n(`public.scheduled_report_recipients where address = 'dani@exemplo.com'`)).toBe(1);
  });
});

describe("o mesmo login da Meta num workspace que fica", () => {
  it("avisa que a revogação derruba a conexão da equipe", async () => {
    const id = await createUser(db, "gil@exemplo.com");
    const colega = await createUser(db, "hugo@exemplo.com");
    const mine = await fullWorkspace(db, ins, { userId: id, name: "Loja do Gil", slug: "loja-gil" });
    const team = await fullWorkspace(db, ins, { userId: colega, name: "Time", slug: "time" });
    await ins("workspace_members", { workspace_id: team.id, user_id: id, role: "member" });
    // a equipe conectou com o mesmo Facebook do Gil
    await db.query(`update public.connections set external_user_id = 'fb-loja-gil' where id = $1`, [team.connectionId]);
    const plan = await loadPlan(adapter(db), "gil@exemplo.com");
    expect(plan.revocations.map((r) => r.connectionId)).toEqual([mine.connectionId]);
    expect(plan.warnings.some((w) => w.startsWith(`"Time"`) && w.includes("mesmo login"))).toBe(true);
  });
});

describe("assinatura viva num provedor real: não apaga", () => {
  it("bloqueia, recusa e não apaga nada", async () => {
    const id = await createUser(db, "edu@exemplo.com");
    const w = await fullWorkspace(db, ins, { userId: id, name: "Loja do Edu", slug: "loja-edu" });
    await db.query(`update public.subscriptions set provider = 'stripe' where workspace_id = $1`, [w.id]);
    const plan = await loadPlan(adapter(db), "edu@exemplo.com");
    expect(plan.blockers).toHaveLength(1);
    expect(refuseReason(plan, { email: "edu@exemplo.com", code: planCode(plan) })).toMatch(/bloqueios/);
    await expect(apply(plan)).rejects.toThrow(/bloqueios/);
    expect(await n(`auth.users where id = $1`, [id])).toBe(1);
    expect(await n(`public.tasks where workspace_id = $1`, [w.id])).toBe(1);
  });
});

describe("sobra detectada: desfaz tudo", () => {
  it("uma tabela nova, sem classificação, barra a exclusão inteira", async () => {
    const id = await createUser(db, "fabi@exemplo.com");
    const w = await fullWorkspace(db, ins, { userId: id, name: "Fabi", slug: "fabi" });
    await ins("invoices", { workspace_id: w.id, provider: "stripe", status: "paid", subtotal_cents: 1, total_cents: 1 });
    await db.exec(`create table public.tabela_nova (workspace_id uuid not null, dado text)`);
    try {
      await db.query(`insert into public.tabela_nova values ($1, 'dado pessoal')`, [w.id]);
      const plan = await loadPlan(adapter(db), "fabi@exemplo.com");
      expect(renderPlan(plan)).toContain("Sem classificação (tabela_nova)");
      await expect(apply(plan)).rejects.toThrow(/tabela_nova/);
      expect(await n(`auth.users where id = $1`, [id])).toBe(1);
      expect(await n(`public.tasks where workspace_id = $1`, [w.id])).toBe(1);
      expect(await n(`vault.secrets where name = 'vyz:fabi'`)).toBe(1);
    } finally {
      await db.exec(`drop table public.tabela_nova`);
    }
  });
});

describe("revogação que falha: a exclusão segue e o que falta aparece", () => {
  it("Meta recusa (token vencido) e Google fora do ar: os dois voltam como não revogados, sem o token no motivo", async () => {
    const id = await createUser(db, "iara@exemplo.com");
    const w = await fullWorkspace(db, ins, { userId: id, name: "Loja da Iara", slug: "loja-iara" });
    const google = await ins("connections", { workspace_id: w.id, provider: "google", external_user_id: "g-iara", external_user_email: "iara@gmail.com", connected_by: id });
    const access = (await db.query<{ id: string }>(`select vault.create_secret('ya29-acesso-iara', 'vyz:g-iara') as id`)).rows[0].id;
    const refresh = (await db.query<{ id: string }>(`select vault.create_secret('1//refresh-iara', 'vyz:g-iara-r') as id`)).rows[0].id;
    await ins("connection_secrets", { connection_id: google.id, access_token_secret_id: access, refresh_token_secret_id: refresh });

    const plan = await loadPlan(adapter(db), "iara@exemplo.com");
    expect(plan.revocations.map((r) => r.provider).sort()).toEqual(["google", "meta"]);
    const provider = fakeProvider((url) =>
      url.startsWith("https://graph.facebook.com/") ? json(400, { error: { message: "Error validating access token: token-secreto-loja-iara", type: "OAuthException", code: 190, error_subcode: 463 } }) : Promise.reject(new TypeError("fetch failed")),
    );
    let outcomes: RevokeOutcome[] = [];
    await db.transaction(async (tx) => {
      const pending = await readTokens(adapter(tx), plan);
      outcomes = await revokeAll(pending, { fetch: provider.fetch });
      await applyPlan(adapter(tx), plan);
    });
    expect(outcomes.filter((o) => o.revoked)).toEqual([]);
    expect(outcomes.find((o) => o.provider === "meta")?.reason).toBe("HTTP 400 type=OAuthException code=190 error_subcode=463");
    expect(outcomes.find((o) => o.provider === "google")?.reason).toMatch(/sem resposta do provedor/);
    // o Google recebe o refresh token, que derruba o acesso inteiro
    expect(provider.calls.find((c) => c.url.includes("googleapis"))?.body).toBe("token=1%2F%2Frefresh-iara");
    expect(JSON.stringify(outcomes)).not.toMatch(/token-secreto|ya29|refresh-iara/);
    // a exclusão seguiu, e o Vault ficou limpo
    expect(await n(`auth.users where id = $1`, [id])).toBe(0);
    expect(await n(`vault.secrets where name like 'vyz:%iara%'`)).toBe(0);
  });
});

describe("o terceiro e as regras do banco", () => {
  it("nada do terceiro mudou", async () => {
    expect(await witnessState()).toEqual(witnessBefore);
  });
  it("os dois restrict continuam lá e nenhum gatilho foi desligado", async () => {
    const restrict = await db.query<{ t: string }>(`select conrelid::regclass::text t from pg_constraint where confrelid = 'public.workspaces'::regclass and confdeltype = 'r' order by 1`);
    expect(restrict.rows.map((r) => r.t)).toEqual(["invoices", "payment_transactions"]);
    expect((await db.query(`select tgname from pg_trigger where tgenabled = 'D' and not tgisinternal`)).rows).toEqual([]);
  });
});
