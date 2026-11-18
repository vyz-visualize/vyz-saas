// Acessos do cliente (supabase/migrations/20261121090000_share_visits.sql) num Postgres em
// memória com as migrações reais: só o servidor grava visitas (record_share_visit), o link
// precisa estar valendo, e cada membro só lê as visitas dos dashboards que acessa.

import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser, freshDb, fullWorkspace, seedCatalog, seeder } from "@/server/admin/testing/pglite";

let db: PGlite;
let ws: string;
let owner: string;
let member: string;
let outsider: string;
let projA: string;
let projB: string;
let dashA: string;
let dashB: string;
let linkA: string;
let linkB: string;
let ins: ReturnType<typeof seeder>;

type Q = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

async function as(userId: string, fn: (q: Q) => Promise<void>) {
  await db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)`, [userId]);
    await tx.exec("set local role authenticated");
    await fn(async (sql, params = []) => (await tx.query(sql, params)).rows as never);
    await tx.rollback();
  });
}

const hex = (s: string) => Buffer.from(s.padEnd(32, "0").slice(0, 32)).toString("hex");

/** O servidor (service_role) registrando um sinal da página aberta. */
async function ping(linkId: string, visitId: string, page: string | null, seconds: number, device: string | null = "desktop") {
  const r = await db.query<{ ok: boolean }>(`select public.record_share_visit($1, $2, $3, $4, $5) as ok`, [linkId, visitId, page, seconds, device]);
  return r.rows[0].ok;
}

const visitRow = async (id: string) =>
  (await db.query<{ seconds: number; pages: string[]; device: string | null; project_id: string; share_link_id: string }>(`select seconds, pages, device, project_id, share_link_id from public.share_visits where id = $1`, [id])).rows[0];

beforeAll(async () => {
  db = await freshDb();
  ins = seeder(db);
  await seedCatalog(db, ins);
  owner = await createUser(db, "dono@exemplo.com");
  member = await createUser(db, "member@exemplo.com");
  outsider = await createUser(db, "fora@exemplo.com");
  const w = await fullWorkspace(db, ins, { userId: owner, name: "Agência", slug: "agencia" });
  ws = w.id;
  await db.query(`update public.plan_entitlements set max_members = 10`);
  await db.query(`update public.subscriptions set accounts_quantity = 10 where workspace_id = $1`, [ws]);
  projA = (await db.query<{ id: string }>(`select id from public.projects where workspace_id = $1`, [ws])).rows[0].id;
  projB = (await ins("projects", { workspace_id: ws, name: "Clínica", created_by: owner })).id;
  dashA = (await ins("dashboards", { workspace_id: ws, template_id: "t1", name: "Dash A", created_by: owner, project_id: projA })).id;
  dashB = (await ins("dashboards", { workspace_id: ws, template_id: "t1", name: "Dash B", created_by: owner, project_id: projB })).id;
  linkA = (await ins("share_links", { workspace_id: ws, dashboard_id: dashA, token_hash: hex("link-a"), token_hint: "aaaa", recipient_name: "Maria" })).id;
  linkB = (await ins("share_links", { workspace_id: ws, dashboard_id: dashB, token_hash: hex("link-b"), token_hint: "bbbb" })).id;
  await ins("workspace_members", { workspace_id: ws, user_id: member, role: "member" });
  await ins("project_members", { workspace_id: ws, project_id: projA, user_id: member, added_by: owner });
}, 120_000);

describe("gravação das visitas", () => {
  it("o primeiro sinal cria a visita; os seguintes somam tempo e telas novas", async () => {
    const v = randomUUID();
    expect(await ping(linkA, v, "visao-geral", 0, "mobile")).toBe(true);
    expect(await visitRow(v)).toMatchObject({ seconds: 0, pages: ["visao-geral"], device: "mobile", project_id: projA, share_link_id: linkA });
    await ping(linkA, v, "campanhas", 30);
    await ping(linkA, v, "visao-geral", 30);
    await ping(linkA, v, null, 25);
    expect(await visitRow(v)).toMatchObject({ seconds: 85, pages: ["visao-geral", "campanhas"] });
  });

  it("cada sinal vale no máximo 2 minutos; tela e aparelho fora do formato são ignorados", async () => {
    const v = randomUUID();
    await ping(linkA, v, "<script>", 9999, "geladeira");
    expect(await visitRow(v)).toMatchObject({ seconds: 120, pages: [], device: null });
    await ping(linkA, v, "funil", -50);
    expect(await visitRow(v)).toMatchObject({ seconds: 120, pages: ["funil"] });
  });

  it("a mesma visita não passa para outro link", async () => {
    const v = randomUUID();
    await ping(linkA, v, "visao-geral", 10);
    await ping(linkB, v, "funil", 60);
    expect(await visitRow(v)).toMatchObject({ seconds: 10, pages: ["visao-geral"], share_link_id: linkA });
  });

  it("link revogado, expirado ou inexistente não grava nada", async () => {
    const revoked = (await ins("share_links", { workspace_id: ws, dashboard_id: dashA, token_hash: hex("revogado"), token_hint: "rrrr", revoked_at: new Date().toISOString() })).id;
    const expired = (await ins("share_links", { workspace_id: ws, dashboard_id: dashA, token_hash: hex("expirado"), token_hint: "eeee", expires_at: "2026-01-01T00:00:00Z" })).id;
    for (const id of [revoked, expired, randomUUID()]) {
      const v = randomUUID();
      expect(await ping(id, v, "visao-geral", 10)).toBe(false);
      expect(await visitRow(v)).toBeUndefined();
    }
  });

  it("quem está logado não grava visita (nem direto, nem pela função)", async () => {
    await as(owner, async (q) => {
      await expect(q(`select public.record_share_visit($1, $2, 'visao-geral', 10, 'desktop')`, [linkA, randomUUID()])).rejects.toThrow();
      await expect(q(`insert into public.share_visits (id, workspace_id, share_link_id, dashboard_id) values ($1, $2, $3, $4)`, [randomUUID(), ws, linkA, dashA])).rejects.toThrow();
    });
  });
});

describe("leitura das visitas", () => {
  it("o dono vê as visitas de todos os workspaces; o member só as dos dashboards dele", async () => {
    await ping(linkB, randomUUID(), "visao-geral", 10);
    await as(owner, async (q) => {
      const links = (await q<{ share_link_id: string }>(`select distinct share_link_id from public.share_visits`)).map((r) => r.share_link_id).sort();
      expect(links).toEqual([linkA, linkB].sort());
    });
    await as(member, async (q) => {
      const links = (await q<{ share_link_id: string }>(`select distinct share_link_id from public.share_visits`)).map((r) => r.share_link_id);
      expect(links).toEqual([linkA]);
    });
  });

  it("quem é de fora não vê nada", async () => {
    await as(outsider, async (q) => {
      expect(await q(`select id from public.share_visits`)).toEqual([]);
    });
  });
});

describe("para quem é o link", () => {
  it("o member dá nome ao criar e renomeia o link; nome vazio ou longo é recusado", async () => {
    await as(member, async (q) => {
      const [l] = await q<{ id: string; recipient_name: string }>(
        `insert into public.share_links (workspace_id, dashboard_id, token_hash, token_hint, created_by, recipient_name) values ($1, $2, $3, 'mmmm', $4, 'João, financeiro') returning id, recipient_name`,
        [ws, dashA, hex("do-member"), member],
      );
      expect(l.recipient_name).toBe("João, financeiro");
      await q(`update public.share_links set recipient_name = 'João' where id = $1`, [l.id]);
      expect((await q<{ recipient_name: string }>(`select recipient_name from public.share_links where id = $1`, [l.id]))[0].recipient_name).toBe("João");
      await expect(q(`update public.share_links set recipient_name = '   ' where id = $1`, [l.id])).rejects.toThrow();
      await expect(q(`update public.share_links set recipient_name = $2 where id = $1`, [l.id, "x".repeat(81)])).rejects.toThrow();
    });
  });

  it("apagar o dashboard leva os links e as visitas junto", async () => {
    const d = (await ins("dashboards", { workspace_id: ws, template_id: "t1", name: "Temporário", created_by: owner, project_id: projA })).id;
    const l = (await ins("share_links", { workspace_id: ws, dashboard_id: d, token_hash: hex("temporario"), token_hint: "tttt" })).id;
    const v = randomUUID();
    await ping(l, v, "visao-geral", 10);
    await db.query(`delete from public.dashboards where id = $1`, [d]);
    expect(await visitRow(v)).toBeUndefined();
  });
});
