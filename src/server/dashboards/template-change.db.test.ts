// Troca de modelo de um dashboard (supabase/migrations/20261116090000_dashboard_template_change.sql)
// num Postgres em memória com as migrações reais: quem edita troca; o modelo precisa estar ativo
// e caber no plano; quem só visualiza não troca; o resto do dashboard fica.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser, freshDb, seedCatalog, seeder } from "@/server/admin/testing/pglite";

let db: PGlite;
let editor: string;
let viewer: string;
let dash: string;

async function as<T>(userId: string, fn: (q: (sql: string, params?: unknown[]) => Promise<T[]>) => Promise<void>) {
  await db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)`, [userId]);
    await tx.exec("set local role authenticated");
    await fn(async (sql, params = []) => (await tx.query<T>(sql, params)).rows);
    await tx.rollback();
  });
}

beforeAll(async () => {
  db = await freshDb();
  const ins = seeder(db);
  await seedCatalog(db, ins);
  await ins("plans", { id: "avancado", name: "Avançado", rank: 3 });
  await ins("dashboard_templates", { id: "t2", name: "Outro", min_plan_id: "pro" });
  await ins("dashboard_templates", { id: "t3", name: "Do Avançado", min_plan_id: "avancado" });
  await ins("dashboard_templates", { id: "t4", name: "Desligado", min_plan_id: "pro", is_active: false });
  editor = await createUser(db, "edita@exemplo.com");
  viewer = await createUser(db, "ve@exemplo.com");
  const w = await ins("workspaces", { name: "W", slug: "w-troca", created_by: editor });
  // a assinatura antes dos membros: o limite de pessoas vem do plano
  await ins("subscriptions", { workspace_id: w.id, plan_id: "pro", provider: "mock", status: "active", interval: "month", accounts_quantity: 1, current_period_start: "2026-11-01T00:00:00Z", current_period_end: "2026-12-01T00:00:00Z" });
  await ins("workspace_members", { workspace_id: w.id, user_id: editor, role: "owner" });
  await ins("workspace_members", { workspace_id: w.id, user_id: viewer, role: "viewer" });
  dash = (await ins("dashboards", { workspace_id: w.id, template_id: "t1", name: "Dash", client_name: "Cliente", created_by: editor, goal_cents: 5000 })).id;
}, 120_000);

describe("troca de modelo do dashboard", () => {
  it("quem edita troca para um modelo do plano; nome e metas ficam", async () => {
    await as<{ template_id: string; name: string; goal_cents: number }>(editor, async (q) => {
      await q(`update public.dashboards set template_id = 't2' where id = $1`, [dash]);
      const [d] = await q(`select template_id, name, goal_cents from public.dashboards where id = $1`, [dash]);
      expect(d).toEqual({ template_id: "t2", name: "Dash", goal_cents: 5000 });
    });
  });
  it("modelo acima do plano ou desligado é recusado", async () => {
    await as(editor, async (q) => {
      await expect(q(`update public.dashboards set template_id = 't3' where id = $1`, [dash])).rejects.toThrow(/plan:template/);
    });
    await as(editor, async (q) => {
      await expect(q(`update public.dashboards set template_id = 't4' where id = $1`, [dash])).rejects.toThrow(/dashboard:template_unavailable/);
    });
  });
  it("quem só visualiza não troca", async () => {
    await as(viewer, async (q) => {
      await q(`update public.dashboards set template_id = 't2' where id = $1`, [dash]);
    });
    const [d] = (await db.query<{ template_id: string }>(`select template_id from public.dashboards where id = $1`, [dash])).rows;
    expect(d.template_id).toBe("t1");
  });
});
