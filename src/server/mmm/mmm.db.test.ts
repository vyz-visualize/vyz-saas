// Base do MMM (supabase/migrations/20261117090000_mmm_schema.sql) num Postgres em memória com as
// migrações reais: isolamento entre workspaces, escrita só pelo servidor, calendário, cascata ao
// excluir a conta, a fila da carga (pausar, pegar, gravar, recalcular) e a retenção.
// A exclusão de conta (modos delete e shell) com dados do MMM está em admin/account-deletion.db.test.ts.

import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { count, createUser, freshDb, fullWorkspace, seedCatalog, seeder, type Ins } from "@/server/admin/testing/pglite";

let db: PGlite;
let ins: Ins;
let ana: string;
let bia: string;
let wsA: { id: string };
let wsB: { id: string };
let accA: string;

async function as<T>(userId: string, fn: (q: (sql: string, params?: unknown[]) => Promise<T[]>) => Promise<void>) {
  await db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)`, [userId]);
    await tx.exec("set local role authenticated");
    await fn(async (sql, params = []) => (await tx.query<T>(sql, params)).rows);
    await tx.rollback();
  });
}

const n = (from: string, params: unknown[] = []) => count(db, from, params);

beforeAll(async () => {
  db = await freshDb();
  ins = seeder(db);
  await seedCatalog(db, ins);
  ana = await createUser(db, "ana@exemplo.com");
  bia = await createUser(db, "bia@exemplo.com");
  wsA = await fullWorkspace(db, ins, { userId: ana, name: "Loja da Ana", slug: "loja-ana" });
  wsB = await fullWorkspace(db, ins, { userId: bia, name: "Loja da Bia", slug: "loja-bia" });
  accA = (await db.query<{ id: string }>(`select id from public.ad_accounts where workspace_id = $1`, [wsA.id])).rows[0].id;
}, 120_000);

describe("isolamento e escrita", () => {
  it("cada membro lê só o MMM do próprio workspace", async () => {
    await as<{ workspace_id: string }>(ana, async (q) => {
      for (const t of ["mmm.raw_insights", "mmm.media_daily", "mmm.daily", "mmm.outcomes_daily", "mmm.eventos", "mmm.backfill_jobs"]) {
        const rows = await q(`select workspace_id from ${t}`);
        expect(rows.length, t).toBeGreaterThan(0);
        expect(rows.every((r) => r.workspace_id === wsA.id), t).toBe(true);
      }
    });
  });

  it("quem está logado não escreve nem chama as funções da carga (só o servidor)", async () => {
    await as(ana, async (q) => {
      await expect(q(`insert into mmm.media_daily (workspace_id, ad_account_id, platform_id, campaign_external_id, date, canal, origem) values ($1, $2, 'meta', 'x', '2026-01-01', 'Meta Ads', 'sync')`, [wsA.id, accA])).rejects.toThrow(/permission denied/);
    });
    await as(ana, async (q) => {
      await expect(q(`delete from mmm.daily`)).rejects.toThrow(/permission denied/);
    });
    await as(ana, async (q) => {
      await expect(q(`select public.mmm_backfill_control(true)`)).rejects.toThrow(/permission denied/);
    });
    await as(ana, async (q) => {
      await expect(q(`select * from mmm.backfill_control`)).rejects.toThrow(/permission denied/);
    });
  });
});

describe("calendário 2023–2027", () => {
  it("todos leem; feriados e datas sazonais nas datas certas", async () => {
    await as<{ n: number }>(ana, async (q) => {
      expect((await q(`select count(*)::int n from mmm.calendario`))[0].n).toBeGreaterThan(80);
    });
    const at = async (evento: string, ano: number) => (await db.query<{ d: string }>(`select data::text d from mmm.calendario where evento = $1 and extract(year from data) = $2`, [evento, ano])).rows.map((r) => r.d);
    expect(await at("Black Friday", 2026)).toEqual(["2026-11-27"]);
    expect(await at("Black Friday", 2025)).toEqual(["2025-11-28"]);
    expect(await at("Dia das Mães", 2026)).toEqual(["2026-05-10"]);
    expect(await at("Dia dos Pais", 2026)).toEqual(["2026-08-09"]);
    expect(await at("Carnaval (terça)", 2026)).toEqual(["2026-02-17"]);
    expect(await at("Sexta-feira Santa", 2026)).toEqual(["2026-04-03"]);
    expect(await at("Dia do Consumidor", 2023)).toEqual(["2023-03-15"]);
    // feriado nacional só desde 2024
    expect(await at("Consciência Negra", 2023)).toEqual([]);
    expect(await at("Consciência Negra", 2024)).toEqual(["2024-11-20"]);
  });
});

describe("fila da carga", () => {
  it("monta a fila sem duplicar, começa pausada e só entrega trabalho ligada", async () => {
    // a conta do workspace cheio tem conexão de verdade (não simulada) e assinatura ativa
    const first = (await db.query<{ n: number }>(`select public.mmm_enqueue_backfill(37) as n`)).rows[0].n;
    expect(first).toBeGreaterThan(0);
    expect((await db.query<{ n: number }>(`select public.mmm_enqueue_backfill(37) as n`)).rows[0].n).toBe(0);
    expect(await n(`mmm.backfill_jobs where ad_account_id = $1`, [accA])).toBe(37);
    expect((await db.query(`select * from public.mmm_claim_backfill(3)`)).rows).toEqual([]);
    const on = (await db.query<{ s: { ativo: boolean } }>(`select public.mmm_backfill_control(true) as s`)).rows[0].s;
    expect(on.ativo).toBe(true);
    const jobs = (await db.query<{ id: number; status: string; tentativas: number; mes: string }>(`select id, status, tentativas, mes::text mes from public.mmm_claim_backfill(3)`)).rows;
    expect(jobs).toHaveLength(3);
    expect(jobs.every((j) => j.status === "rodando" && j.tentativas === 1)).toBe(true);
    // pausar: nada novo sai
    await db.query(`select public.mmm_backfill_control(false)`);
    expect((await db.query(`select * from public.mmm_claim_backfill(3)`)).rows).toEqual([]);
  });

  it("grava o bruto e a mídia do mês, recalcula a base pronta e conclui o trabalho", async () => {
    const job = (await db.query<{ id: number; mes: string }>(`select id, mes::text mes from mmm.backfill_jobs where ad_account_id = $1 and status = 'rodando' order by mes desc limit 1`, [accA])).rows[0];
    const day = job.mes.slice(0, 8) + "15";
    const fora = "2001-01-01";
    const rows = [
      { campaign_external_id: "c1", campaign_name: "Vendas", date: day, canal: "Meta Ads", spend: 100, impressions: 1000, clicks: 30, conversions: 3, conversion_value: 450 },
      { campaign_external_id: "c2", campaign_name: "Remarketing", date: day, canal: "Meta Ads", spend: 50, impressions: 500, clicks: 10, conversions: 1, conversion_value: 150 },
      // fora do mês do trabalho: não entra
      { campaign_external_id: "c1", date: fora, canal: "Meta Ads", spend: 999 },
    ];
    const saved = (await db.query<{ n: number }>(`select public.mmm_save_backfill($1, $2, $3) as n`, [job.id, JSON.stringify([{ date_from: job.mes, date_to: day, request_hash: "abcdef123456", payload: { data: [] } }]), JSON.stringify(rows)])).rows[0].n;
    expect(saved).toBe(2);
    const daily = (await db.query<{ investimento: string; conversoes: string; receita: string; canal: string }>(`select investimento, conversoes, receita, canal from mmm.daily where ad_account_id = $1 and data = $2`, [accA, day])).rows;
    expect(daily).toEqual([{ investimento: "150.00", conversoes: "4.00", receita: "600.00", canal: "Meta Ads" }]);
    expect(await n(`mmm.media_daily where date = $1`, [fora])).toBe(0);
    expect(await n(`mmm.raw_insights where request_hash = 'abcdef123456'`)).toBe(1);
    const done = (await db.query<{ status: string; linhas: number }>(`select status, linhas from mmm.backfill_jobs where id = $1`, [job.id])).rows[0];
    expect(done).toEqual({ status: "concluido", linhas: 2 });
  });

  it("a base pronta marca feriado e data sazonal", async () => {
    await db.query(`insert into mmm.media_daily (workspace_id, ad_account_id, platform_id, campaign_external_id, date, canal, spend, origem) values ($1, $2, 'meta', 'bf', '2025-11-28', 'Meta Ads', 70, 'backfill')`, [wsA.id, accA]);
    await db.query(`select mmm.rollup_daily($1, '2025-11-01', '2025-11-30')`, [wsA.id]);
    const r = (await db.query<{ feriado: boolean; sazonal: string | null }>(`select feriado, sazonal from mmm.daily where ad_account_id = $1 and data = '2025-11-28'`, [accA])).rows[0];
    expect(r).toEqual({ feriado: false, sazonal: "Black Friday" });
  });

  it("aguardando (relatório da Meta) volta na próxima rodada; o limite da plataforma não gasta tentativa", async () => {
    await db.query(`select public.mmm_backfill_control(true)`);
    const job = (await db.query<{ id: number; tentativas: number }>(`select id, tentativas from public.mmm_claim_backfill(1)`)).rows[0];
    await db.query(`select public.mmm_update_backfill($1, 'aguardando', null, '1234567890', true)`, [job.id]);
    const again = (await db.query<{ id: number; report_run_id: string; tentativas: number }>(`select id, report_run_id, tentativas from public.mmm_claim_backfill(1)`)).rows[0];
    expect(again).toEqual({ id: job.id, report_run_id: "1234567890", tentativas: job.tentativas });
    await db.query(`select public.mmm_backfill_control(false)`);
  });
});

describe("cascata e retenção", () => {
  it("excluir a conta de anúncio leva o MMM dela junto (o evento do negócio todo fica com o workspace)", async () => {
    const acc = (await db.query<{ id: string }>(`select id from public.ad_accounts where workspace_id = $1`, [wsB.id])).rows[0].id;
    await db.query(`delete from public.ad_accounts where id = $1`, [acc]);
    for (const t of ["mmm.raw_insights", "mmm.media_daily", "mmm.daily", "mmm.outcomes_daily", "mmm.backfill_jobs"]) expect(await n(`${t} where ad_account_id = $1`, [acc]), t).toBe(0);
    expect(await n(`mmm.eventos where workspace_id = $1`, [wsB.id])).toBe(1);
  });

  it("bruto: a partição de 15 meses atrás cai inteira; a do mês passado fica", async () => {
    const months = async (back: number) => (await db.query<{ from: string; to: string; name: string }>(
      `select (date_trunc('month', now()) - make_interval(months => $1))::date::text as "from",
              (date_trunc('month', now()) - make_interval(months => $1) + interval '1 month')::date::text as "to",
              'raw_insights_' || to_char(date_trunc('month', now()) - make_interval(months => $1), 'YYYY_MM') as name`,
      [back],
    )).rows[0];
    const old = await months(15);
    await db.exec(`create table private.${old.name} partition of mmm.raw_insights for values from ('${old.from}') to ('${old.to}')`);
    await db.query(`insert into mmm.raw_insights (workspace_id, ad_account_id, platform_id, date_from, date_to, request_hash, payload, created_at) values ($1, $2, 'meta', '2025-01-01', '2025-01-31', 'velho12345', '{}', $3::date + 1)`, [wsA.id, accA, old.from]);
    expect(await n(`mmm.raw_insights where request_hash = 'velho12345'`)).toBe(1);
    const out = (await db.query<{ r: Record<string, { mode: string; rows?: number }> }>(`select private.apply_retention() r`)).rows[0].r;
    expect(out["mmm.raw_insights"]).toEqual({ mode: "exclusao", rows: 1 });
    expect(await n(`mmm.raw_insights where request_hash = 'velho12345'`)).toBe(0);
    expect(await n(`pg_class where relname = $1`, [old.name])).toBe(0);
    // o bruto recente fica
    expect(await n(`mmm.raw_insights where workspace_id = $1`, [wsA.id])).toBeGreaterThan(0);
  });

  it("bruto: partições do mês criadas e derrubadas depois de 13 meses; tratado: sai 90 dias depois do fim do contrato", async () => {
    // contrato da Bia acabou há 100 dias; o da Ana segue ativo
    await db.query(`update public.subscriptions set status = 'canceled', canceled_at = now() - interval '100 days', ended_at = now() - interval '100 days', current_period_start = now() - interval '130 days', current_period_end = now() - interval '100 days' where workspace_id = $1`, [wsB.id]);
    // começa em simulação: conta o que sairia e não apaga nada
    const policy = (await db.query<{ table_name: string; apply: boolean }>(`select table_name, apply from private.retention_policy where table_name like 'mmm.%' order by 1`)).rows;
    expect(policy.filter((p) => p.apply).map((p) => p.table_name)).toEqual(["mmm.raw_insights"]);
    const sim = (await db.query<{ r: Record<string, { mode: string; rows?: number; error?: string }> }>(`select private.apply_retention() r`)).rows[0].r;
    expect(sim["mmm.eventos"]).toEqual({ mode: "simulacao", rows: 1 });
    expect(sim["mmm.media_daily"]).toEqual({ mode: "simulacao", rows: 0 });
    expect(await n(`mmm.eventos where workspace_id = $1`, [wsB.id])).toBe(1);
    // liberada: apaga só o do contrato encerrado há mais de 90 dias
    await db.exec(`update private.retention_policy set apply = true where regra = 'contrato'`);
    const out = (await db.query<{ r: Record<string, { mode: string; rows?: number; error?: string }> }>(`select private.apply_retention() r`)).rows[0].r;
    expect(out["mmm.eventos"]).toEqual({ mode: "exclusao", rows: 1 });
    expect(out["mmm.media_daily"]?.error).toBeUndefined();
    expect(out["mmm.raw_insights"]?.error).toBeUndefined();
    expect(await n(`mmm.eventos where workspace_id = $1`, [wsB.id])).toBe(0);
    // o da Ana fica
    expect(await n(`mmm.media_daily where workspace_id = $1`, [wsA.id])).toBeGreaterThan(0);
    expect(await n(`mmm.eventos where workspace_id = $1`, [wsA.id])).toBe(1);
    const parts = (await db.query<{ relname: string }>(`select c.relname from pg_inherits i join pg_class c on c.oid = i.inhrelid where i.inhparent = 'mmm.raw_insights'::regclass order by 1`)).rows.map((r) => r.relname);
    expect(parts).toContain("raw_insights_default");
    expect(parts.some((p) => /^raw_insights_\d{4}_\d{2}$/.test(p))).toBe(true);
  });
});
