import "server-only";

// Grava uma planilha já validada no armazém, pelo mesmo caminho da sincronização
// (writeDataset + rollupAccount): no período da planilha, a conta fica igual ao
// arquivo (o que não veio de novo sai). Cada importação é uma linha em sync_runs,
// e o índice de "uma por conta" impede duas ao mesmo tempo.

import { revalidateTag } from "next/cache";
import type { PlatformId } from "@/features/accounts/platforms";
import { toDataset, type ImportRow } from "@/features/import/spreadsheet";
import type { AccountDataset } from "@/features/sync/dataset";
import { insightsTag } from "@/features/sync/tags";
import { appError } from "@/server/supabase/errors";
import type { DB } from "@/server/supabase/server";
import type { SyncAccount } from "@/server/sync/source";
import { rollupAccount, writeDataset } from "@/server/sync/write";

export type ImportAccount = { id: string; workspaceId: string; platformId: PlatformId; externalId: string; currency: string };
export type ImportTrigger = "manual" | "scheduled";

const STALE_RUN_MS = 15 * 60 * 1000;

/** Registra uma tentativa que nem chegou a gravar (link fechado, linha inválida): a tela mostra o motivo. */
export async function recordImportFailure(db: DB, account: ImportAccount, trigger: ImportTrigger, message: string) {
  const now = new Date().toISOString();
  const { error } = await db
    .from("sync_runs")
    .insert({ workspace_id: account.workspaceId, connection_id: null, ad_account_id: account.id, trigger, status: "failed", error: message.slice(0, 500), started_at: now, finished_at: now });
  if (error && error.code !== "23505") console.error("[vyz] importação: registrar falha", error.code, error.message);
}

/** Grava as linhas na conta. Devolve quantas linhas entraram no banco e o período coberto. */
export async function writeImport(db: DB, account: ImportAccount, rows: ImportRow[], trigger: ImportTrigger): Promise<{ rowsWritten: number; range: { from: string; to: string } }> {
  const data = toDataset(rows, { platform: account.platformId, externalId: account.externalId, currency: account.currency });
  // o gravador só lê entidades e fatos: a plataforma e os campos da conexão não entram
  const dataset = { ...data, ads: [], products: [], adDaily: [], breakdownDaily: [], searchTermDaily: [], productDaily: [] } as unknown as AccountDataset;
  const target = { id: account.id, workspaceId: account.workspaceId } as SyncAccount;
  const now = new Date();

  const stale = await db
    .from("sync_runs")
    .update({ status: "failed", error: "Tempo esgotado", finished_at: now.toISOString() })
    .eq("ad_account_id", account.id)
    .in("status", ["queued", "running"])
    .lt("created_at", new Date(now.getTime() - STALE_RUN_MS).toISOString());
  if (stale.error) console.error("[vyz] importação: liberar execução presa", stale.error.code, stale.error.message);

  const { data: run, error } = await db
    .from("sync_runs")
    .insert({ workspace_id: account.workspaceId, connection_id: null, ad_account_id: account.id, trigger, status: "running", range_start: data.range.from, range_end: data.range.to, started_at: now.toISOString() })
    .select("id, created_at")
    .single();
  if (error?.code === "23505") throw appError("sync:running", "Já existe uma importação desta conta em andamento. Aguarde terminar.");
  if (error) throw error;

  const finish = async (patch: { status: "succeeded" | "failed"; rows: number; error?: string }) => {
    const finishedAt = new Date(Date.now() + (Date.parse(run.created_at) - now.getTime())).toISOString();
    const done = await db.from("sync_runs").update({ status: patch.status, rows_written: patch.rows, error: patch.error ?? null, started_at: run.created_at, finished_at: finishedAt }).eq("id", run.id);
    if (done.error) console.error("[vyz] importação: fechar execução", run.id, done.error.code, done.error.message);
    return finishedAt;
  };

  try {
    const written = await writeDataset(db, target, dataset, run.created_at);
    const days = await rollupAccount(db, target, dataset, data.range, run.created_at);
    const rowsWritten = written.entities + written.facts + days;
    const finishedAt = await finish({ status: "succeeded", rows: rowsWritten });
    const mark = await db.from("ad_accounts").update({ last_synced_at: finishedAt }).eq("id", account.id);
    if (mark.error) console.error("[vyz] importação: marcar última importação", mark.error.code, mark.error.message);
    try {
      revalidateTag(insightsTag(account.id), trigger === "scheduled" ? "max" : { expire: 0 });
    } catch {
      // fora de uma requisição (script) não há cache do Next: ele expira sozinho
    }
    return { rowsWritten, range: data.range };
  } catch (err) {
    await finish({ status: "failed", rows: 0, error: "Não foi possível gravar a planilha. Tente de novo em instantes." });
    throw err;
  }
}
