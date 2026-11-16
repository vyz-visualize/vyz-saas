// Limite de workspaces por plano (supabase/migrations/20261120090000_plan_projects.sql) num
// Postgres em memória com as migrações reais: vale o menor entre o teto do plano
// (plan_entitlements.max_projects) e a quantidade da assinatura; quem já passou do limite
// continua com o que tem, só não cria nem desarquiva acima dele. Avançado e Personalizado
// (max_projects nulo) não têm limite.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { count, createUser, freshDb, fullWorkspace, seedCatalog, seeder, type Ins } from "@/server/admin/testing/pglite";

let db: PGlite;
let ins: Ins;
let ws: string;
let owner: string;

const active = () => count(db, `public.projects where workspace_id = $1 and archived_at is null`, [ws]);
const create = (name: string) => ins("projects", { workspace_id: ws, name, created_by: owner });

beforeAll(async () => {
  db = await freshDb();
  ins = seeder(db);
  await seedCatalog(db, ins);
  owner = await createUser(db, "dono@exemplo.com");
  ws = (await fullWorkspace(db, ins, { userId: owner, name: "Agência", slug: "agencia" })).id;
}, 120_000);

describe("limite de workspaces do plano", () => {
  it("o catálogo novo tem a coluna, com 200 por padrão (quem manda é a assinatura)", async () => {
    const r = await db.query<{ max_projects: number }>(`select max_projects from public.plan_entitlements where plan_id = 'pro'`);
    expect(r.rows[0].max_projects).toBe(200);
  });

  it("vale o teto do plano, mesmo com a assinatura maior", async () => {
    await db.exec(`update public.plan_entitlements set max_projects = 5 where plan_id = 'pro'`);
    await db.query(`update public.subscriptions set accounts_quantity = 30 where workspace_id = $1`, [ws]);
    while ((await active()) < 5) await create(`Cliente ${await active()}`);
    await expect(create("Sexto")).rejects.toThrow(/limit:projects/);
    await expect(create("Sexto")).rejects.toMatchObject({ hint: "Seu plano tem até 5 workspaces." });
  });

  it("vale a assinatura quando ela é menor que o teto", async () => {
    await db.exec(`update public.plan_entitlements set max_projects = 200 where plan_id = 'pro'`);
    await db.query(`update public.subscriptions set accounts_quantity = 3 where workspace_id = $1`, [ws]);
    await expect(create("Mais um")).rejects.toMatchObject({ hint: "Seu plano tem até 3 workspaces." });
  });

  it("acima do limite: os que existem ficam; arquivar pode, desarquivar não", async () => {
    expect(await active()).toBe(5);
    const [first] = (await db.query<{ id: string }>(`select id from public.projects where workspace_id = $1 and archived_at is null order by created_at desc limit 1`, [ws])).rows;
    await db.query(`update public.projects set archived_at = now() where id = $1`, [first.id]);
    expect(await active()).toBe(4);
    await expect(db.query(`update public.projects set archived_at = null where id = $1`, [first.id])).rejects.toThrow(/limit:projects/);
  });
});

describe("workspaces ilimitados (Avançado e Personalizado)", () => {
  it("max_projects nulo deixa passar, mesmo acima da quantidade da assinatura", async () => {
    const d = await freshDb();
    const i = seeder(d);
    await seedCatalog(d, i);
    await i("plans", { id: "avancado", name: "Avançado", rank: 3 });
    // o Avançado com as mesmas regras do Padrão do catálogo de teste, sem teto de workspaces
    await d.exec(`insert into public.plan_entitlements select (jsonb_populate_record(null::public.plan_entitlements, to_jsonb(e) || '{"plan_id": "avancado", "max_projects": null}')).* from public.plan_entitlements e where e.plan_id = 'pro'`);
    const u = await createUser(d, "avancado@exemplo.com");
    const w = (await fullWorkspace(d, i, { userId: u, name: "Rede", slug: "rede" })).id;
    // a quantidade gravada não importa: 1 não segura, e passa dos 30 de antes
    await d.query(`update public.subscriptions set plan_id = 'avancado', accounts_quantity = 1 where workspace_id = $1`, [w]);
    for (let n = 0; n < 35; n++) await i("projects", { workspace_id: w, name: `Cliente ${n}`, created_by: u });
    expect(await count(d, `public.projects where workspace_id = $1 and archived_at is null`, [w])).toBe(36);
    // sem plano ativo, continua barrando
    await d.query(`update public.subscriptions set status = 'canceled' where workspace_id = $1`, [w]);
    await expect(i("projects", { workspace_id: w, name: "Depois do cancelamento", created_by: u })).rejects.toThrow(/plan:/);
  }, 120_000);
});
