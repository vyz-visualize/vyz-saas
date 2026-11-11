// A regra do banco para contas de planilha (migração 20261111130000): ficam
// ativas sem conexão só com metadata.source = 'import', e contam no limite do
// plano como qualquer outra. Roda num Postgres em memória com todas as migrações.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser, freshDb, fullWorkspace, seedCatalog, seeder } from "@/server/admin/testing/pglite";

let db: PGlite;
let ws: string;

const insert = (externalId: string, over: { status?: string; enabled?: boolean; metadata?: string } = {}) =>
  db.query(
    `insert into public.ad_accounts (workspace_id, platform_id, external_id, name, status, is_enabled, enabled_at, metadata)
     values ($1, 'shopee', $2, 'Loja', $3, $4, case when $4 then now() end, $5::jsonb) returning id, is_enabled, project_id`,
    [ws, externalId, over.status ?? "active", over.enabled ?? true, over.metadata ?? '{"source":"import"}'],
  );

beforeAll(async () => {
  db = await freshDb();
  const ins = seeder(db);
  await seedCatalog(db, ins);
  await ins("platforms", { id: "shopee", name: "Shopee Ads", kind: "ads", min_plan_id: "pro" });
  const user = await createUser(db, "ana@exemplo.com");
  ws = (await fullWorkspace(db, ins, { userId: user, name: "Da Ana", slug: "da-ana" })).id as string;
}, 120_000);

describe("conta de planilha no banco", () => {
  it("fica ativa sem conexão e entra num projeto", async () => {
    const r = await insert("planilha-loja");
    expect(r.rows[0]).toMatchObject({ is_enabled: true });
    expect((r.rows[0] as { project_id: string | null }).project_id).not.toBeNull();
  });

  it("sem a marca de planilha, conta sem conexão não ativa", async () => {
    await expect(insert("sem-marca", { metadata: "{}" })).rejects.toThrow(/account:not_connected/);
    await expect(insert("manual", { metadata: '{"source":"manual"}' })).rejects.toThrow(/account:not_connected/);
  });

  it("conta pendente marcada como planilha não ativa (o status só muda pelo servidor)", async () => {
    const r = await insert("pendente", { status: "pending", enabled: false });
    const id = (r.rows[0] as { id: string }).id;
    await expect(db.query(`update public.ad_accounts set is_enabled = true, enabled_at = now() where id = $1`, [id])).rejects.toThrow(/account:not_connected/);
  });

  it("conta no limite do plano como as outras", async () => {
    // o plano do teste permite 1 conta de cada plataforma por projeto: a primeira já ocupou
    await db.exec(`update public.plan_entitlements set max_accounts_per_platform = 1`);
    await expect(insert("planilha-segunda")).rejects.toThrow(/limit:accounts/);
  });

  it("a regra da tabela vale mesmo sem o gatilho", async () => {
    await db.exec(`alter table public.ad_accounts disable trigger ad_accounts_enforce_rules`);
    try {
      await expect(insert("sem-gatilho", { metadata: "{}" })).rejects.toThrow(/ad_accounts_enabled_needs_source/);
    } finally {
      await db.exec(`alter table public.ad_accounts enable trigger ad_accounts_enforce_rules`);
    }
  });
});
