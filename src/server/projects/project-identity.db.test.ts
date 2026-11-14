// Identidade do workspace (supabase/migrations/20261119090000_project_identity.sql) num Postgres em
// memória com as migrações reais: a cor é #rrggbb e a logo só aceita o caminho da pasta do próprio
// workspace; quem edita o workspace troca as duas, quem só lê não.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser, freshDb, fullWorkspace, seedCatalog, seeder } from "@/server/admin/testing/pglite";

let db: PGlite;
let ws: string;
let owner: string;
let viewer: string;
let proj: string;
let other: string;

type Q = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

async function as(userId: string, fn: (q: Q) => Promise<void>) {
  await db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)`, [userId]);
    await tx.exec("set local role authenticated");
    await fn(async (sql, params = []) => (await tx.query(sql, params)).rows as never);
    await tx.rollback();
  });
}

beforeAll(async () => {
  db = await freshDb();
  const ins = seeder(db);
  await seedCatalog(db, ins);
  owner = await createUser(db, "dono@exemplo.com");
  viewer = await createUser(db, "leitor@exemplo.com");
  const w = await fullWorkspace(db, ins, { userId: owner, name: "Agência", slug: "agencia" });
  ws = w.id;
  await db.query(`update public.subscriptions set accounts_quantity = 10 where workspace_id = $1`, [ws]);
  proj = (await db.query<{ id: string }>(`select id from public.projects where workspace_id = $1`, [ws])).rows[0].id;
  other = (await ins("projects", { workspace_id: ws, name: "Clínica", created_by: owner })).id;
  await ins("workspace_members", { workspace_id: ws, user_id: viewer, role: "viewer" });
  await ins("project_members", { workspace_id: ws, project_id: proj, user_id: viewer, added_by: owner });
});

const logo = (projectId: string, file = "logo-0123456789abcdef.png") => `${ws}/projects/${projectId}/${file}`;

describe("identidade do workspace", () => {
  it("a cor é #rrggbb em minúsculas (ou nenhuma)", async () => {
    await as(owner, async (q) => {
      expect(await q(`update public.projects set color = '#2563eb' where id = $1 returning id`, [proj])).toHaveLength(1);
      expect(await q(`update public.projects set color = null where id = $1 returning id`, [proj])).toHaveLength(1);
    });
    for (const bad of ["#2563EB", "blue", "#fff", "2563eb"]) {
      await expect(as(owner, async (q) => void (await q(`update public.projects set color = $2 where id = $1`, [proj, bad])))).rejects.toThrow(/projects_color_hex/);
    }
  });

  it("a logo só aceita o caminho da pasta do próprio workspace", async () => {
    await as(owner, async (q) => {
      expect(await q(`update public.projects set logo_path = $2 where id = $1 returning id`, [proj, logo(proj)])).toHaveLength(1);
      expect(await q(`update public.projects set logo_path = $2 where id = $1 returning id`, [proj, logo(proj, "logo-0123456789abcdef.webp")])).toHaveLength(1);
    });
    const bad = [logo(other), `${ws}/logo-0123456789abcdef.png`, logo(proj, "logo-x.png"), logo(proj, "logo-0123456789abcdef.svg"), `00000000-0000-4000-8000-000000000000/projects/${proj}/logo-0123456789abcdef.png`];
    for (const path of bad) {
      await expect(as(owner, async (q) => void (await q(`update public.projects set logo_path = $2 where id = $1`, [proj, path])))).rejects.toThrow(/projects_logo_path_own/);
    }
  });

  it("quem só lê não troca a identidade", async () => {
    await as(viewer, async (q) => {
      expect(await q(`select id from public.projects where id = $1`, [proj])).toHaveLength(1);
      expect(await q(`update public.projects set color = '#2563eb' where id = $1 returning id`, [proj])).toHaveLength(0);
    });
  });
});
