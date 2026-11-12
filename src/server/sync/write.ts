import "server-only";

// Grava um conjunto de dados no armazém sem pesar no banco:
//   1. entidades por upsert (ad_account_id, external_id), que devolvem os uuids;
//   2. fatos em lotes de até 1000 linhas, no máximo 3 requisições ao mesmo tempo;
//   3. no período sincronizado, apaga o que a fonte não devolveu mais (linhas
//      com synced_at anterior ao início desta sincronização): o período fica
//      igual ao que a fonte diz, sem sobras de uma importação anterior.
// Upsert e delete são idempotentes: erro passageiro (rede, tempo esgotado)
// tenta de novo.

import { chunk, runLimited, withRetry } from "@/features/sync/batch";
import type { AccountDataset } from "@/features/sync/dataset";
import { organicDayRow, organicPostRow, type OrganicDataset } from "@/features/sync/organic";
import { closeDataset } from "@/features/sync/close-dataset";
import { analyticsDayRow, type AnalyticsDataset } from "@/features/sync/analytics";
import { crmDayRow, type CrmDataset } from "@/features/sync/crm";
import { accountReachRows, adRows, campaignRows, FACT_KEYS, FACT_TABLES, factRows, idLookup, productRows, type FactTable } from "@/features/sync/rows";
import { AppError } from "@/server/supabase/errors";
import type { DB } from "@/server/supabase/server";
import type { SyncAccount } from "./source";

const BATCH_SIZE = 1000;
const CONCURRENCY = 3;
const REQUEST_TIMEOUT_MS = 30_000;

type EntityTable = "ad_campaigns" | "ads" | "ad_products";
type EntityRef = { id: string; external_id: string };

// Postgres: serialização, deadlock, tempo esgotado, conexões; PostgREST: sem conexão com o banco.
const TRANSIENT_CODES = new Set(["40001", "40P01", "57014", "57P01", "53300", "08000", "08003", "08006", "PGRST000", "PGRST001", "PGRST002", "PGRST003"]);

export function isTransient(error: unknown): boolean {
  if (error instanceof AppError || !error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown; name?: unknown };
  if (e.name === "AbortError" || e.name === "TimeoutError") return true;
  if (typeof e.code === "string" && TRANSIENT_CODES.has(e.code)) return true;
  return typeof e.message === "string" && /fetch failed|network|socket|ECONNRESET|ETIMEDOUT|EAI_AGAIN|timed? ?out/i.test(e.message);
}

/** Executa uma consulta do Supabase com tempo máximo e nova tentativa; lança o erro do banco. */
async function request<T>(run: (signal: AbortSignal) => PromiseLike<{ data: T; error: unknown }>): Promise<T> {
  return withRetry(
    async () => {
      const { data, error } = await run(AbortSignal.timeout(REQUEST_TIMEOUT_MS));
      if (error) throw error;
      return data;
    },
    { retryable: isTransient },
  );
}

async function upsertEntities(db: DB, table: EntityTable, rows: object[]): Promise<EntityRef[]> {
  const out: EntityRef[] = [];
  for (const part of chunk(rows, BATCH_SIZE)) {
    const data = await request((signal) =>
      db
        .from(table)
        // as linhas já vêm tipadas de rows.ts (TablesInsert de cada tabela)
        .upsert(part as never[], { onConflict: "ad_account_id,external_id" })
        .select("id, external_id")
        .abortSignal(signal),
    );
    out.push(...((data ?? []) as EntityRef[]));
  }
  return out;
}

async function upsertFacts(db: DB, table: FactTable, rows: object[]): Promise<number> {
  await request((signal) =>
    db
      .from(table)
      .upsert(rows as never[], { onConflict: FACT_KEYS[table].join(",") })
      .abortSignal(signal),
  );
  return rows.length;
}

type Range = { from: string; to: string };

/** Apaga, no período, as linhas que esta sincronização não regravou. */
async function pruneStale(db: DB, table: FactTable | "insights_account_daily", adAccountId: string, range: Range, syncedAt: string) {
  await request((signal) => db.from(table).delete().eq("ad_account_id", adAccountId).gte("date", range.from).lte("date", range.to).lt("synced_at", syncedAt).abortSignal(signal));
}

/**
 * Recalcula no banco o total por conta e dia (insights_account_daily) a partir
 * das campanhas, grava o alcance da conta e tira os dias que ficaram sem
 * campanha. Devolve quantos dias foram gravados.
 *
 * O alcance não se soma entre campanhas (a mesma pessoa vê várias): o rollup
 * só estima (maior alcance do dia). Quando a fonte traz o número da conta
 * (Meta, insights level=account), ele substitui a estimativa; sem ele a
 * frequência da conta sairia maior que a real.
 */
export async function rollupAccount(db: DB, account: SyncAccount, dataset: AccountDataset, range: Range, syncedAt: string): Promise<number> {
  const days = await request((signal) => db.rpc("rollup_account_insights", { p_ad_account_id: account.id, p_from: range.from, p_to: range.to }).abortSignal(signal));
  const reach = accountReachRows(dataset, { workspaceId: account.workspaceId, adAccountId: account.id, syncedAt }).filter((r) => r.date >= range.from && r.date <= range.to);
  // só dias que o rollup acabou de gravar: o upsert atualiza alcance e synced_at da linha
  await runLimited(
    chunk(reach, BATCH_SIZE).map((rows) => () => request((signal) => db.from("insights_account_daily").upsert(rows, { onConflict: "ad_account_id,date" }).abortSignal(signal))),
    CONCURRENCY,
  );
  await pruneStale(db, "insights_account_daily", account.id, range, syncedAt);
  return days ?? 0;
}

export type WriteStats = {
  entities: number;
  facts: number;
  byTable: Partial<Record<EntityTable | FactTable, number>>;
};

/**
 * Grava entidades e fatos de uma conta. `syncedAt` é o início da sincronização
 * no relógio do banco (sync_runs.created_at): vai em todas as linhas e separa o
 * que é desta importação do que sobrou de outra.
 */
export async function writeDataset(db: DB, account: SyncAccount, raw: AccountDataset, syncedAt: string): Promise<WriteStats> {
  // campanhas, anúncios e produtos apagados depois ainda aparecem nas métricas do período
  const dataset = closeDataset(raw);
  const scope = { workspaceId: account.workspaceId, adAccountId: account.id };

  // os anúncios e os termos de pesquisa precisam dos uuids das campanhas
  const campaigns = await upsertEntities(db, "ad_campaigns", campaignRows(dataset, scope));
  const campaignId = idLookup("Campanha", campaigns);
  const [ads, products] = await Promise.all([upsertEntities(db, "ads", adRows(dataset, scope, campaignId)), upsertEntities(db, "ad_products", productRows(dataset, scope))]);

  const facts = factRows(dataset, { ...scope, syncedAt }, { campaign: campaignId, ad: idLookup("Anúncio", ads), product: idLookup("Produto", products) });
  const tasks = FACT_TABLES.flatMap((table) => chunk<object>(facts[table], BATCH_SIZE).map((rows) => () => upsertFacts(db, table, rows)));
  await runLimited(tasks, CONCURRENCY);
  await runLimited(
    FACT_TABLES.map((table) => () => pruneStale(db, table, account.id, dataset.range, syncedAt)),
    CONCURRENCY,
  );

  const byTable: WriteStats["byTable"] = { ad_campaigns: campaigns.length, ads: ads.length, ad_products: products.length };
  for (const table of FACT_TABLES) byTable[table] = facts[table].length;
  const factCount = FACT_TABLES.reduce((total, table) => total + facts[table].length, 0);
  return { entities: campaigns.length + ads.length + products.length, facts: factCount, byTable };
}

/**
 * Orgânico (Instagram e Página): grava o total por dia em organic_daily e os posts
 * (números de vida inteira) em organic_posts. No período, apaga os dias que a
 * fonte não devolveu mais. Os posts ficam: um post fora da janela relida mantém
 * os últimos números lidos.
 */
export async function writeOrganic(db: DB, account: SyncAccount, dataset: OrganicDataset, syncedAt: string): Promise<{ days: number; posts: number }> {
  const scope = { workspace_id: account.workspaceId, ad_account_id: account.id, synced_at: syncedAt };
  // Seguidores sem histórico (null: a API do Instagram só dá o número de agora) não
  // apagam o que já estava no banco. O PostgREST grava as colunas da união das linhas
  // de um lote, então os dias com e sem seguidores vão em lotes separados.
  const all = dataset.daily.map((d) => ({ ...scope, ...organicDayRow(d) }));
  const withFollowers = all.filter((r) => r.followers !== null);
  const withoutFollowers = all.filter((r) => r.followers === null).map(({ followers: _omit, ...rest }) => rest);
  const days = [...withFollowers, ...withoutFollowers];
  const posts = dataset.posts.map((p) => ({ ...scope, ...organicPostRow(p) }));
  const dayBatches = [...chunk<object>(withFollowers, BATCH_SIZE), ...chunk<object>(withoutFollowers, BATCH_SIZE)];
  await runLimited(
    [
      ...dayBatches.map((rows) => () => request((signal) => db.from("organic_daily").upsert(rows as never[], { onConflict: "ad_account_id,date" }).abortSignal(signal))),
      ...chunk(posts, BATCH_SIZE).map((rows) => () => request((signal) => db.from("organic_posts").upsert(rows as never[], { onConflict: "ad_account_id,external_id" }).abortSignal(signal))),
    ],
    CONCURRENCY,
  );
  await request((signal) => db.from("organic_daily").delete().eq("ad_account_id", account.id).gte("date", dataset.range.from).lte("date", dataset.range.to).lt("synced_at", syncedAt).abortSignal(signal));
  return { days: days.length, posts: posts.length };
}

/** GA4: troca os dias do intervalo pelos novos (linhas de outra importação no intervalo saem). */
export async function writeAnalytics(db: DB, account: SyncAccount, dataset: AnalyticsDataset, syncedAt: string): Promise<number> {
  const scope = { workspace_id: account.workspaceId, ad_account_id: account.id, synced_at: syncedAt };
  const rows = dataset.daily.map((d) => ({ ...scope, ...analyticsDayRow(d) }));
  await runLimited(
    chunk<object>(rows, BATCH_SIZE).map((part) => () => request((signal) => db.from("analytics_daily").upsert(part as never[], { onConflict: "ad_account_id,date,channel" }).abortSignal(signal))),
    CONCURRENCY,
  );
  await request((signal) => db.from("analytics_daily").delete().eq("ad_account_id", account.id).gte("date", dataset.range.from).lte("date", dataset.range.to).lt("synced_at", syncedAt).abortSignal(signal));
  return rows.length;
}

/** CRM: troca os dias do intervalo pelos novos (etapas que sumiram no intervalo saem). */
export async function writeCrm(db: DB, account: SyncAccount, dataset: CrmDataset, syncedAt: string): Promise<number> {
  const scope = { workspace_id: account.workspaceId, ad_account_id: account.id, synced_at: syncedAt };
  // a chave do banco é (conta, dia, etapa): nomes que viram o mesmo depois de cortados somam
  const merged = new Map<string, ReturnType<typeof crmDayRow>>();
  for (const d of dataset.daily) {
    const row = crmDayRow(d);
    const key = `${row.date}|${row.stage}`;
    const cur = merged.get(key);
    if (!cur) merged.set(key, row);
    else for (const k of ["deals", "value", "won", "won_value", "lost", "leads"] as const) cur[k] = Math.round((cur[k] + row[k]) * 100) / 100;
  }
  const rows = [...merged.values()].map((r) => ({ ...scope, ...r }));
  await runLimited(
    chunk<object>(rows, BATCH_SIZE).map((part) => () => request((signal) => db.from("crm_daily").upsert(part as never[], { onConflict: "ad_account_id,date,stage" }).abortSignal(signal))),
    CONCURRENCY,
  );
  await request((signal) => db.from("crm_daily").delete().eq("ad_account_id", account.id).gte("date", dataset.range.from).lte("date", dataset.range.to).lt("synced_at", syncedAt).abortSignal(signal));
  return rows.length;
}
