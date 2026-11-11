// Orgânico no banco (migração 20261112090000): Instagram e Página chegam pelo login
// do Meta, contam 1 conta do plano cada e guardam os números em tabelas próprias.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser, freshDb, fullWorkspace, seedCatalog, seeder } from "@/server/admin/testing/pglite";

let db: PGlite;
let ws: string;
let conn: string;

const insertProfile = (platform: "instagram" | "facebook", externalId: string) =>
  db.query<{ id: string; is_enabled: boolean }>(
    `insert into public.ad_accounts (workspace_id, connection_id, platform_id, external_id, name, status, is_enabled, enabled_at)
     values ($1, $2, $3, $4, 'Perfil', 'active', true, now()) returning id, is_enabled`,
    [ws, conn, platform, externalId],
  );

beforeAll(async () => {
  db = await freshDb();
  const ins = seeder(db);
  await seedCatalog(db, ins);
  await ins("platforms", { id: "instagram", name: "Instagram", kind: "social", min_plan_id: "pro", oauth_provider: "meta" });
  await ins("platforms", { id: "facebook", name: "Página do Facebook", kind: "social", min_plan_id: "pro", oauth_provider: "meta" });
  const user = await createUser(db, "ana@exemplo.com");
  const w = await fullWorkspace(db, ins, { userId: user, name: "Da Ana", slug: "da-ana" });
  ws = w.id as string;
  conn = w.connectionId as string;
}, 120_000);

describe("orgânico no banco", () => {
  it("o tipo de plataforma 'social' existe", async () => {
    const r = await db.query<{ kind: string }>(`select kind from public.platforms where id = 'instagram'`);
    expect(r.rows[0].kind).toBe("social");
  });

  it("Instagram e Página ativam pela conexão do Meta e guardam os números por dia e por post", async () => {
    const ig = (await insertProfile("instagram", "17841400123456789")).rows[0];
    expect(ig.is_enabled).toBe(true);
    await db.query(`insert into public.organic_daily (workspace_id, ad_account_id, date, followers, views, reach, interactions, posts) values ($1, $2, '2026-11-10', 15000, 3400, 1200, 112, 2)`, [ws, ig.id]);
    await db.query(
      `insert into public.organic_posts (workspace_id, ad_account_id, external_id, kind, published_at, views, interactions) values ($1, $2, '1789', 'reel', '2026-11-10T12:00:00Z', 900, 40)`,
      [ws, ig.id],
    );
    const day = await db.query<{ views: string }>(`select views from public.organic_daily where ad_account_id = $1`, [ig.id]);
    expect(Number(day.rows[0].views)).toBe(3400);
    await expect(db.query(`insert into public.organic_posts (workspace_id, ad_account_id, external_id, kind, published_at) values ($1, $2, 'x', 'tiktok', now())`, [ws, ig.id])).rejects.toThrow(/organic_posts_kind_check/);
  });

  it("cada perfil conta 1 no limite do plano (por projeto e plataforma)", async () => {
    await db.exec(`update public.plan_entitlements set max_accounts_per_platform = 1`);
    await expect(insertProfile("instagram", "17841400999999999")).rejects.toThrow(/limit:accounts/);
    // a Página é outra plataforma: ainda cabe
    expect((await insertProfile("facebook", "104857392016483")).rows[0].is_enabled).toBe(true);
  });

  it("apagar a conta apaga os números dela", async () => {
    const r = await db.query<{ id: string }>(`select id from public.ad_accounts where platform_id = 'instagram' and external_id = '17841400123456789'`);
    await db.query(`delete from public.ad_accounts where id = $1`, [r.rows[0].id]);
    const left = await db.query<{ n: number }>(`select count(*)::int n from public.organic_daily where ad_account_id = $1`, [r.rows[0].id]);
    expect(left.rows[0].n).toBe(0);
  });
});
