// A retenção de 5 anos (supabase/migrations/20261109120000_retention_five_years.sql), rodando
// pela limpeza diária num Postgres em memória com as migrações reais.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { count, freshDb } from "./testing/pglite";

let db: PGlite;
const n = (from: string) => count(db, from);
const runs = async () => (await db.query<{ table_name: string; mode: string; rows_found: number; error: string | null }>(`select table_name, mode, rows_found, error from private.retention_runs order by id`)).rows;
const housekeeping = async () => (await db.query<{ out: Record<string, unknown> }>(`select private.housekeeping() as out`)).rows[0].out;

const OLD = "now() - interval '5 years 1 day'";
const RECENT = "now() - interval '4 years 11 months'";

beforeAll(async () => {
  db = await freshDb();
  const user = "00000000-0000-0000-0000-0000000000aa";
  const ws = "00000000-0000-0000-0000-0000000000bb";
  for (const at of [OLD, RECENT]) {
    await db.exec(`insert into public.legal_acceptances (user_id, email, document, document_version, created_at) values ('${user}', 'p@exemplo.com', 'terms', '2021-01', ${at})`);
    // sem partição mensal para essa data: cai na partição padrão, que nunca é derrubada por partição
    await db.exec(`insert into public.activity_events (workspace_id, actor_id, event, created_at) values ('${ws}', '${user}', 'dashboard.created', ${at})`);
    await db.exec(`insert into public.audit_events (workspace_id, actor_id, actor_role, action, table_name, record_id, created_at) values ('${ws}', '${user}', 'postgres', 'update', 'profiles', '${user}', ${at})`);
  }
}, 120_000);

describe("retenção de 5 anos", () => {
  it("roda dentro da limpeza diária que já está no cron", async () => {
    const jobs = (await db.query<{ jobname: string; command: string }>(`select jobname, command from cron.job`)).rows;
    expect(jobs.find((j) => j.jobname === "vyz-housekeeping")?.command).toContain("private.housekeeping()");
    expect(jobs.filter((j) => /retention/i.test(j.jobname))).toEqual([]);
  });

  it("começa em simulação: conta e registra, sem apagar nada", async () => {
    const policy = (await db.query<{ table_name: string; apply: boolean; keep: string }>(`select table_name, apply, keep::text as keep from private.retention_policy order by 1`)).rows;
    expect(policy).toEqual([
      { table_name: "activity_events", apply: false, keep: "5 years" },
      { table_name: "audit_events", apply: false, keep: "5 years" },
      { table_name: "legal_acceptances", apply: false, keep: "5 years" },
    ]);
    const before = { legal: await n("public.legal_acceptances"), activity: await n("public.activity_events"), audit: await n("public.audit_events") };
    const out = await housekeeping();
    expect(out.retention_5y).toEqual({
      activity_events: { mode: "simulacao", rows: 1 },
      audit_events: { mode: "simulacao", rows: 1 },
      legal_acceptances: { mode: "simulacao", rows: 1 },
    });
    expect(await runs()).toEqual([
      { table_name: "activity_events", mode: "simulacao", rows_found: 1, error: null },
      { table_name: "audit_events", mode: "simulacao", rows_found: 1, error: null },
      { table_name: "legal_acceptances", mode: "simulacao", rows_found: 1, error: null },
    ]);
    expect({ legal: await n("public.legal_acceptances"), activity: await n("public.activity_events"), audit: await n("public.audit_events") }).toEqual(before);
  });

  it("liberada, apaga só o que passou de 5 anos e registra", async () => {
    await db.exec(`update private.retention_policy set apply = true, updated_at = now()`);
    await housekeeping();
    expect((await runs()).slice(-3).map((r) => [r.table_name, r.mode, r.rows_found])).toEqual([
      ["activity_events", "exclusao", 1],
      ["audit_events", "exclusao", 1],
      ["legal_acceptances", "exclusao", 1],
    ]);
    for (const t of ["legal_acceptances", "activity_events", "audit_events"]) {
      expect(await n(`public.${t} where created_at < now() - interval '5 years'`), t).toBe(0);
      expect(await n(`public.${t} where created_at > now() - interval '5 years' and created_at < now() - interval '4 years'`), t).toBe(1);
    }
  });

  it("o prazo não aceita menos de 6 meses nem tabela fora da lista", async () => {
    await expect(db.exec(`update private.retention_policy set keep = interval '1 day' where table_name = 'audit_events'`)).rejects.toThrow(/check/);
    await expect(db.exec(`insert into private.retention_policy (table_name, keep) values ('invoices', interval '5 years')`)).rejects.toThrow(/check/);
  });

  it("ninguém além do banco lê ou muda a política e o registro", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const t of ["private.retention_policy", "private.retention_runs"]) {
        const can = (await db.query<{ ok: boolean }>(`select has_table_privilege('${role}', '${t}', 'select') or has_table_privilege('${role}', '${t}', 'update') as ok`)).rows[0].ok;
        expect(can, `${role} em ${t}`).toBe(false);
      }
      const exec = (await db.query<{ ok: boolean }>(`select has_function_privilege('${role}', 'private.apply_retention()', 'execute') as ok`)).rows[0].ok;
      expect(exec, `${role} executa`).toBe(false);
    }
  });
});
