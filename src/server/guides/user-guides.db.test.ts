// A tabela user_guides (supabase/migrations/20261115090000_user_guides.sql) num Postgres
// em memória com as migrações reais: cada pessoa só lê e grava os próprios guias (RLS),
// o estado é validado e os guias somem junto com a pessoa.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { freshDb } from "@/server/admin/testing/pglite";

let db: PGlite;
const ANA = "00000000-0000-0000-0000-00000000a001";
const BIA = "00000000-0000-0000-0000-00000000b002";

/** Roda como a pessoa logada (papel authenticated + o "sub" do JWT), sempre dentro de uma transação desfeita. */
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
  for (const [id, email] of [
    [ANA, "ana@exemplo.com"],
    [BIA, "bia@exemplo.com"],
  ]) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, email]);
    await db.query(`insert into public.profiles (id, email) values ($1, $2) on conflict (id) do nothing`, [id, email]);
  }
  await db.query(`insert into public.user_guides (user_id, guide, status) values ($1, 'dashboard_tour', 'done')`, [BIA]);
}, 120_000);

describe("user_guides", () => {
  it("cada pessoa grava e lê só os próprios guias", async () => {
    await as<{ guide: string; status: string }>(ANA, async (q) => {
      await q(`insert into public.user_guides (user_id, guide, status) values ($1, 'dashboard_tour', 'skipped')`, [ANA]);
      await q(`insert into public.user_guides (user_id, guide, status, snoozed_until) values ($1, 'nudge:google', 'snoozed', now() + interval '3 days')`, [ANA]);
      const rows = await q(`select guide, status from public.user_guides order by guide`);
      // a linha da Bia não aparece
      expect(rows).toEqual([
        { guide: "dashboard_tour", status: "skipped" },
        { guide: "nudge:google", status: "snoozed" },
      ]);
    });
  });

  it("não grava nem apaga guia de outra pessoa", async () => {
    await as(ANA, async (q) => {
      await expect(q(`insert into public.user_guides (user_id, guide, status) values ($1, 'dashboard_tour', 'done')`, [BIA])).rejects.toThrow(/row-level security/);
    });
    await as<{ n: number }>(ANA, async (q) => {
      await q(`delete from public.user_guides where user_id = $1`, [BIA]);
      await q(`update public.user_guides set status = 'skipped' where user_id = $1`, [BIA]);
    });
    const bia = (await db.query<{ status: string }>(`select status from public.user_guides where user_id = $1`, [BIA])).rows;
    expect(bia).toEqual([{ status: "done" }]);
  });

  it("estado válido: adiado sempre tem data, e só adiado tem data", async () => {
    await expect(db.query(`insert into public.user_guides (user_id, guide, status) values ($1, 'nudge:meta', 'snoozed')`, [ANA])).rejects.toThrow(/check/);
    await expect(db.query(`insert into public.user_guides (user_id, guide, status, snoozed_until) values ($1, 'nudge:meta', 'done', now())`, [ANA])).rejects.toThrow(/check/);
    await expect(db.query(`insert into public.user_guides (user_id, guide, status) values ($1, 'nudge:meta', 'talvez')`, [ANA])).rejects.toThrow(/check/);
    await expect(db.query(`insert into public.user_guides (user_id, guide, status) values ($1, 'Tour Grande!', 'done')`, [ANA])).rejects.toThrow(/check/);
  });

  it("atualiza updated_at e sai junto com a pessoa", async () => {
    await db.query(`insert into public.user_guides (user_id, guide, status, updated_at) values ($1, 'nudge:meta', 'done', now() - interval '1 day')`, [ANA]);
    await db.query(`update public.user_guides set status = 'done' where user_id = $1 and guide = 'nudge:meta'`, [ANA]);
    const [row] = (await db.query<{ fresh: boolean }>(`select updated_at > now() - interval '1 minute' as fresh from public.user_guides where user_id = $1 and guide = 'nudge:meta'`, [ANA])).rows;
    expect(row.fresh).toBe(true);
    await db.query(`delete from auth.users where id = $1`, [ANA]);
    const left = (await db.query<{ n: number }>(`select count(*)::int as n from public.user_guides where user_id = $1`, [ANA])).rows[0].n;
    expect(left).toBe(0);
  });
});
