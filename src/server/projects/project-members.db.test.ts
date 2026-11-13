// Equipe por workspace (supabase/migrations/20261118090000_project_members.sql) num Postgres em
// memória com as migrações reais. Na interface, "projeto" é o workspace e o workspace de cima é a
// organização: dono e admin veem tudo; member e viewer só os projetos onde estão.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser, freshDb, fullWorkspace, seedCatalog, seeder } from "@/server/admin/testing/pglite";

let db: PGlite;
let ws: string;
let owner: string;
let admin: string;
let member: string;
let outsider: string;
let projA: string;
let projB: string;
let accB: string;
let dashB: string;

type Q = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

async function as(userId: string, fn: (q: Q) => Promise<void>) {
  await db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)`, [userId]);
    await tx.exec("set local role authenticated");
    await fn(async (sql, params = []) => (await tx.query(sql, params)).rows as never);
    await tx.rollback();
  });
}

const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

beforeAll(async () => {
  db = await freshDb();
  const ins = seeder(db);
  await seedCatalog(db, ins);
  owner = await createUser(db, "dono@exemplo.com");
  admin = await createUser(db, "admin@exemplo.com");
  member = await createUser(db, "member@exemplo.com");
  outsider = await createUser(db, "fora@exemplo.com");
  const w = await fullWorkspace(db, ins, { userId: owner, name: "Agência", slug: "agencia" });
  ws = w.id;
  // vagas e projetos de sobra no plano do teste
  await db.query(`update public.plan_entitlements set max_members = 10`);
  await db.query(`update public.subscriptions set accounts_quantity = 10 where workspace_id = $1`, [ws]);
  projA = (await db.query<{ id: string }>(`select id from public.projects where workspace_id = $1`, [ws])).rows[0].id;
  projB = (await ins("projects", { workspace_id: ws, name: "Clínica", created_by: owner })).id;
  accB = (await ins("ad_accounts", { workspace_id: ws, connection_id: w.connectionId, project_id: projB, platform_id: "meta", external_id: "act_b", name: "Conta B", status: "active" })).id;
  await ins("insights_account_daily", { workspace_id: ws, ad_account_id: accB, date: "2026-11-02" });
  dashB = (await ins("dashboards", { workspace_id: ws, template_id: "t1", name: "Dash B", created_by: owner, project_id: projB })).id;
  await ins("workspace_members", { workspace_id: ws, user_id: admin, role: "admin" });
  await ins("workspace_members", { workspace_id: ws, user_id: member, role: "member" });
  // o member só está no projeto A
  await ins("project_members", { workspace_id: ws, project_id: projA, user_id: member, added_by: owner });
});

describe("equipe por workspace", () => {
  it("dono e admin veem todos os projetos, contas e dashboards", async () => {
    for (const u of [owner, admin]) {
      await as(u, async (q) => {
        expect(ids(await q<{ id: string }>(`select id from public.projects`))).toEqual([projA, projB].sort());
        expect((await q(`select id from public.ad_accounts where id = $1`, [accB])).length).toBe(1);
        expect((await q(`select id from public.dashboards where id = $1`, [dashB])).length).toBe(1);
      });
    }
  });

  it("o member só vê o projeto dele, as contas, os dashboards e as métricas de lá", async () => {
    await as(member, async (q) => {
      expect(ids(await q<{ id: string }>(`select id from public.projects`))).toEqual([projA]);
      expect(await q(`select id from public.ad_accounts where id = $1`, [accB])).toEqual([]);
      expect(await q(`select id from public.dashboards where id = $1`, [dashB])).toEqual([]);
      expect(await q(`select 1 from public.insights_account_daily where ad_account_id = $1`, [accB])).toEqual([]);
      expect(await q(`select id from public.share_links where dashboard_id = $1`, [dashB])).toEqual([]);
      // o que é do projeto A continua aparecendo
      expect((await q(`select id from public.ad_accounts where project_id = $1`, [projA])).length).toBe(1);
      expect((await q(`select 1 from public.insights_account_daily where workspace_id = $1`, [ws])).length).toBe(1);
    });
  });

  it("o member não edita nem apaga o que é de outro projeto", async () => {
    await as(member, async (q) => {
      await q(`update public.dashboards set name = 'Invadido' where id = $1`, [dashB]);
      await q(`delete from public.dashboards where id = $1`, [dashB]);
    });
    const row = (await db.query<{ name: string }>(`select name from public.dashboards where id = $1`, [dashB])).rows[0];
    expect(row?.name).toBe("Dash B");
  });

  it("o member não põe um dashboard dele num projeto de que não participa", async () => {
    await as(member, async (q) => {
      await expect(q(`insert into public.dashboards (workspace_id, template_id, name, created_by, project_id) values ($1, 't1', 'X', $2, $3)`, [ws, member, projB])).rejects.toThrow();
    });
  });

  it("dashboard novo do member cai num projeto dele", async () => {
    await as(member, async (q) => {
      const [d] = await q<{ project_id: string }>(`insert into public.dashboards (workspace_id, template_id, name, created_by) values ($1, 't1', 'Meu', $2) returning project_id`, [ws, member]);
      expect(d.project_id).toBe(projA);
    });
  });

  it("quem cria um projeto entra nele", async () => {
    await as(member, async (q) => {
      const [p] = await q<{ id: string }>(`insert into public.projects (workspace_id, name, created_by) values ($1, 'Novo cliente', $2) returning id`, [ws, member]);
      expect(ids(await q<{ id: string }>(`select id from public.projects`))).toContain(p.id);
    });
  });

  it("só admin põe e tira gente de um projeto", async () => {
    await as(member, async (q) => {
      await expect(q(`insert into public.project_members (workspace_id, project_id, user_id, added_by) values ($1, $2, $3, $3)`, [ws, projB, member])).rejects.toThrow();
    });
    await as(admin, async (q) => {
      await q(`insert into public.project_members (workspace_id, project_id, user_id, added_by) values ($1, $2, $3, $4)`, [ws, projB, member, admin]);
      expect((await q(`select 1 from public.project_members where project_id = $1 and user_id = $2`, [projB, member])).length).toBe(1);
    });
  });

  it("quem é de fora não vê nada", async () => {
    await as(outsider, async (q) => {
      expect(await q(`select id from public.projects`)).toEqual([]);
      expect(await q(`select project_id from public.project_members`)).toEqual([]);
    });
  });

  it("o servidor sabe os projetos de cada pessoa (WhatsApp e push)", async () => {
    const one = async (u: string) => (await db.query<{ ids: string[] | null }>(`select public.user_project_ids($1, $2) as ids`, [ws, u])).rows[0].ids;
    expect(await one(owner)).toBeNull();
    expect(await one(member)).toEqual([projA]);
  });

  it("o convite leva os projetos escolhidos", async () => {
    const guest = await createUser(db, "convidado@exemplo.com");
    const token = "token-de-teste-convite";
    await db.query(
      `insert into public.workspace_invitations (workspace_id, email, role, token_hash, invited_by, project_ids) values ($1, 'convidado@exemplo.com', 'viewer', encode(extensions.digest($2, 'sha256'), 'hex'), $3, $4)`,
      [ws, token, owner, [projB]],
    );
    await as(guest, async (q) => {
      await q(`select public.accept_workspace_invitation($1)`, [token]);
      expect(ids(await q<{ id: string }>(`select id from public.projects`))).toEqual([projB]);
    });
  });

  it("saiu da organização, sai dos projetos", async () => {
    const temp = await createUser(db, "temp@exemplo.com");
    await db.query(`insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'member')`, [ws, temp]);
    await db.query(`insert into public.project_members (workspace_id, project_id, user_id) values ($1, $2, $3)`, [ws, projA, temp]);
    await db.query(`delete from public.workspace_members where workspace_id = $1 and user_id = $2`, [ws, temp]);
    expect((await db.query(`select 1 from public.project_members where user_id = $1`, [temp])).rows).toEqual([]);
  });
});
