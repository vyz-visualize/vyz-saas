// Postgres de teste em memória (PGlite), com as migrações reais do projeto. Só para os testes:
// nada de rede, nada de produção. auth, vault, storage e cron são imitações mínimas do Supabase,
// com as colunas que as migrações e a exclusão usam.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import type { Db } from "../account-deletion";

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls; create role authenticator nologin; create role supabase_auth_admin nologin;
create schema auth; create schema vault; create schema storage; create schema extensions; create schema cron;
grant usage on schema auth, storage, extensions to anon, authenticated, service_role;

create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, raw_user_meta_data jsonb default '{}'::jsonb, raw_app_meta_data jsonb default '{}'::jsonb, email_confirmed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now(), last_sign_in_at timestamptz);
create table auth.identities (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, provider text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'postgres') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;

create table vault.secrets (id uuid primary key default gen_random_uuid(), secret text, name text, description text);
create view vault.decrypted_secrets as select id, secret as decrypted_secret, name, description from vault.secrets;
create function vault.create_secret(new_secret text, new_name text default null, new_description text default '', new_key_id uuid default null) returns uuid language sql as $$ insert into vault.secrets(secret, name, description) values (new_secret, new_name, new_description) returning id $$;
create function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null, new_description text default null, new_key_id uuid default null) returns void language sql as $$ update vault.secrets set secret = coalesce(new_secret, secret) where id = secret_id $$;

create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;

create function extensions.digest(data text, kind text) returns bytea language sql immutable as $$ select sha256(convert_to(data, 'utf8')) $$;
create function extensions.digest(data bytea, kind text) returns bytea language sql immutable as $$ select sha256(data) $$;

create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create function cron.schedule(jobname text, schedule text, command text) returns bigint language sql as $$ insert into cron.job(jobname, schedule, command) values (jobname, schedule, command) returning jobid $$;
create function cron.unschedule(name text) returns boolean language sql as $$ delete from cron.job where jobname = name returning true $$;
`;

/** Um banco novo, com todas as migrações de supabase/migrations aplicadas em ordem. */
export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(STUBS);
  const dir = join(process.cwd(), "supabase/migrations");
  for (const f of readdirSync(dir).sort()) {
    // as extensões do Supabase não existem aqui; o que elas dão vem das imitações acima
    const sql = readFileSync(join(dir, f), "utf8").replace(/create extension[^;]*;/gi, "");
    try {
      await db.exec(sql);
    } catch (e) {
      const err = e as Error & { where?: string };
      throw new Error(`Migração ${f}: ${err.message}${err.where ? ` | ${err.where.slice(0, 200)}` : ""}`);
    }
  }
  return db;
}

/** O banco (ou uma transação dele) no formato que a exclusão usa. */
export const adapter = (db: PGlite | Transaction): Db => ({
  query: async <T,>(text: string, params: unknown[] = []) => (await db.query<T>(text, params)).rows,
});

type Row = Record<string, unknown>;
type Col = { c: string; d: string; u: string };

/** Insere uma linha, preenchendo sozinho as colunas obrigatórias que o teste não liga. */
export function seeder(db: PGlite) {
  const cache = new Map<string, Col[]>();
  const required = async (table: string) => {
    if (!cache.has(table)) {
      const r = await db.query<Col>(
        `select column_name c, data_type d, udt_name u from information_schema.columns
          where table_schema = 'public' and table_name = $1 and is_nullable = 'NO' and column_default is null and is_identity = 'NO'`,
        [table],
      );
      cache.set(table, r.rows);
    }
    return cache.get(table)!;
  };
  const filler = async (col: Col): Promise<unknown> => {
    if (col.d === "USER-DEFINED") return (await db.query<{ l: string }>(`select enumlabel l from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = $1 order by enumsortorder limit 1`, [col.u])).rows[0].l;
    if (col.d === "ARRAY") return "{}";
    if (col.d.includes("json")) return "{}";
    if (col.d.includes("int") || col.d === "numeric") return 1;
    if (col.d === "boolean") return false;
    if (col.d === "date") return "2026-11-01";
    if (col.d.startsWith("timestamp")) return "2026-11-01T00:00:00Z";
    if (col.d === "uuid") return "00000000-0000-0000-0000-000000000000";
    return `x-${col.c}-${Math.random().toString(36).slice(2, 9)}`;
  };
  return async function ins(table: string, values: Row = {}): Promise<Row & { id: string }> {
    const row: Row = { ...values };
    for (const col of await required(table)) if (!(col.c in row)) row[col.c] = await filler(col);
    const keys = Object.keys(row);
    const params = keys.map((k) => (row[k] !== null && typeof row[k] === "object" && !Array.isArray(row[k]) ? JSON.stringify(row[k]) : row[k]));
    const sql = `insert into public.${table} (${keys.map((k) => `"${k}"`).join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")}) returning *`;
    return (await db.query<Row & { id: string }>(sql, params)).rows[0];
  };
}

export type Ins = ReturnType<typeof seeder>;

/** O catálogo mínimo para criar workspaces como o produto cria: plano, plataforma e modelos. */
export async function seedCatalog(db: PGlite, ins: Ins) {
  await ins("plans", { id: "pro", name: "Padrão", rank: 2 });
  await ins("plan_entitlements", { plan_id: "pro", pages_plan_id: "pro", platforms: "all", audio: "none" });
  const cols = await db.query<{ c: string; d: string }>(`select column_name c, data_type d from information_schema.columns where table_schema = 'public' and table_name = 'plan_entitlements'`);
  for (const c of cols.rows) {
    // limites folgados; colunas com regra própria recusam e ficam como estão
    if (["integer", "smallint", "bigint"].includes(c.d)) await db.exec(`update public.plan_entitlements set "${c.c}" = 1000`).catch(() => {});
    if (c.d === "boolean") await db.exec(`update public.plan_entitlements set "${c.c}" = true`).catch(() => {});
  }
  await ins("platforms", { id: "meta", name: "Meta", kind: "ads", min_plan_id: "pro" });
  await ins("dashboard_templates", { id: "t1", name: "T", min_plan_id: "pro" });
  await ins("landing_templates", { id: "lp1", name: "L", min_plan_id: "pro" });
}

export async function createUser(db: PGlite, email: string): Promise<string> {
  return (await db.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email])).rows[0].id;
}

/** Um workspace cheio, com tudo o que a página diz que apaga, e uma conexão Meta real com token no Vault. */
export async function fullWorkspace(db: PGlite, ins: Ins, { userId, name, slug }: { userId: string; name: string; slug: string }) {
  const w = await ins("workspaces", { name, slug, created_by: userId });
  await ins("workspace_members", { workspace_id: w.id, user_id: userId, role: "owner" });
  await ins("subscriptions", { workspace_id: w.id, plan_id: "pro", provider: "mock", status: "active", interval: "month", accounts_quantity: 1, current_period_start: "2026-11-01T00:00:00Z", current_period_end: "2026-12-01T00:00:00Z" });
  const conn = await ins("connections", { workspace_id: w.id, provider: "meta", external_user_id: `fb-${slug}`, external_user_name: `Facebook de ${name}`, connected_by: userId });
  const access = (await db.query<{ id: string }>(`select vault.create_secret($1, $2) as id`, [`token-secreto-${slug}`, `vyz:${slug}`])).rows[0].id;
  await ins("connection_secrets", { connection_id: conn.id, access_token_secret_id: access });
  const proj = await ins("projects", { workspace_id: w.id, name: "Workspace", created_by: userId });
  const acc = await ins("ad_accounts", { workspace_id: w.id, connection_id: conn.id, project_id: proj.id, platform_id: "meta", external_id: `act_${slug}`, name: "Conta", status: "active", is_enabled: true, enabled_at: "2026-11-01T00:00:00Z" });
  if (!acc.is_enabled) throw new Error("a conta de teste não ficou ativa");
  const camp = await ins("ad_campaigns", { workspace_id: w.id, ad_account_id: acc.id, external_id: `c-${slug}`, name: "Campanha" });
  // base do MMM (schema mmm): o bruto, a mídia tratada, a base pronta, a fila, o resultado e um evento do negócio todo
  await db.query(`insert into mmm.raw_insights (workspace_id, ad_account_id, platform_id, date_from, date_to, request_hash, payload) values ($1, $2, 'meta', '2026-10-01', '2026-10-31', 'hash-${slug}', '{}')`, [w.id, acc.id]);
  await db.query(`insert into mmm.media_daily (workspace_id, ad_account_id, platform_id, campaign_external_id, date, canal, spend, impressions, clicks, conversions, conversion_value, origem) values ($1, $2, 'meta', 'c-${slug}', '2026-10-01', 'Meta Ads', 10, 100, 5, 1, 50, 'backfill')`, [w.id, acc.id]);
  await db.query(`select mmm.rollup_daily($1, '2026-10-01', '2026-10-31')`, [w.id]);
  await db.query(`insert into mmm.backfill_jobs (workspace_id, ad_account_id, platform_id, mes) values ($1, $2, 'meta', '2026-10-01')`, [w.id, acc.id]);
  await db.query(`insert into mmm.outcomes_daily (workspace_id, ad_account_id, fonte, date, receita) values ($1, $2, 'planilha', '2026-10-01', 80)`, [w.id, acc.id]);
  await db.query(`insert into mmm.eventos (workspace_id, inicio, fim, tipo, descricao) values ($1, '2026-11-01', '2026-11-05', 'promocao', 'Promoção de novembro')`, [w.id]);
  await ins("insights_account_daily", { workspace_id: w.id, ad_account_id: acc.id, date: "2026-11-01" });
  const dash = await ins("dashboards", { workspace_id: w.id, template_id: "t1", name: "Dash", created_by: userId });
  await ins("share_links", { workspace_id: w.id, dashboard_id: dash.id, token_hash: Buffer.from(slug.padEnd(32, "0").slice(0, 32)).toString("hex"), token_hint: "abcd" });
  await ins("scheduled_reports", { workspace_id: w.id, dashboard_id: dash.id, created_by: userId, frequency: "weekly", weekday: 1 });
  const grp = await ins("task_groups", { workspace_id: w.id, name: "Grupo", created_by: userId });
  const task = await ins("tasks", { workspace_id: w.id, title: "Tarefa", created_by: userId, group_id: grp.id });
  await ins("optimization_runs", { workspace_id: w.id, campaign_id: camp.id, task_id: task.id, platform: "meta", kind: "pause", action: { kind: "pause" }, mode: "manual", status: "applied", applied_by: userId });
  const lp = await ins("landing_pages", { workspace_id: w.id, template_id: "lp1", slug: `lp-${slug}`, created_by: userId });
  await ins("landing_page_submissions", { workspace_id: w.id, landing_page_id: lp.id, data: { nome: "Lead", telefone: "+5571999999999" } });
  const wa = await ins("whatsapp_subscriptions", { workspace_id: w.id, user_id: userId, phone: "+5571988887777" });
  await ins("whatsapp_messages", { subscription_id: wa.id, direction: "out", kind: "diario", status: "sent", body: "resumo" });
  await db.query(`insert into storage.objects (bucket_id, name) values ('brand-assets', $1)`, [`${w.id}/logo-abc.png`]);
  return { ...w, connectionId: conn.id };
}

export async function count(db: PGlite, from: string, params: unknown[] = []): Promise<number> {
  return (await db.query<{ n: number }>(`select count(*)::int as n from ${from}`, params)).rows[0].n;
}
