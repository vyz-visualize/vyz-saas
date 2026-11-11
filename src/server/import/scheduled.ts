import "server-only";

// Atualização diária das contas de planilha ligadas a um link do Google Sheets:
// relê o link salvo e regrava o período da planilha. Roda no mesmo agendador da
// sincronização (rota /api/cron/sync), uma conta por vez e dentro de um tempo
// máximo. Só contas ativas de workspaces com acesso; quem leu (ou tentou) há
// menos de 20 horas espera a próxima rodada. Falha fica em sync_runs, com o
// motivo que a tela mostra (link fechado, linha inválida).

import { isImportPlatform } from "@/features/accounts/connection-modes";
import type { PlatformId } from "@/features/accounts/platforms";
import { readSpreadsheet } from "@/features/import/spreadsheet";
import { DEFAULT_TIME_ZONE, localDate } from "@/features/sync/dates";
import { createAdminSupabase } from "@/server/supabase/admin";
import { AppError } from "@/server/supabase/errors";
import { recordImportFailure, writeImport, type ImportAccount } from "./run";
import { fetchSheetCsv } from "./sheets";

const HOUR = 60 * 60 * 1000;

export type SheetRefreshSummary = { due: number; refreshed: number; failed: number; pending: number };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export async function refreshSheetAccounts(opts: { budgetMs?: number; minIntervalMs?: number; limit?: number } = {}): Promise<SheetRefreshSummary> {
  const startedAt = Date.now();
  const budget = opts.budgetMs ?? 60 * 1000;
  const cutoff = new Date(startedAt - (opts.minIntervalMs ?? 20 * HOUR)).toISOString();
  const db = createAdminSupabase();

  const { data, error } = await db
    .from("ad_accounts")
    .select("id, workspace_id, platform_id, external_id, currency, timezone, metadata, recent:sync_runs!sync_runs_workspace_id_ad_account_id_fkey(id)")
    .eq("is_enabled", true)
    .is("connection_id", null)
    .eq("metadata->>source", "import")
    .not("metadata->sheet", "is", null)
    // nenhuma tentativa (certa ou com erro) depois do corte
    .gte("recent.created_at", cutoff)
    .is("recent", null)
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(opts.limit ?? 100);
  if (error) throw error;

  const workspaceIds = [...new Set((data ?? []).map((a) => a.workspace_id))];
  const access = workspaceIds.length ? await db.from("workspace_access").select("workspace_id, has_access").in("workspace_id", workspaceIds) : { data: [], error: null };
  if (access.error) throw access.error;
  const active = new Set((access.data ?? []).filter((w) => w.has_access).map((w) => w.workspace_id));
  const due = (data ?? []).filter((a) => active.has(a.workspace_id) && isImportPlatform(a.platform_id));

  let refreshed = 0;
  let failed = 0;
  let done = 0;
  for (const row of due) {
    if (Date.now() - startedAt > budget) break;
    done++;
    const account: ImportAccount = { id: row.id, workspaceId: row.workspace_id, platformId: row.platform_id as PlatformId, externalId: row.external_id, currency: row.currency };
    const sheet = isRecord(row.metadata) && isRecord(row.metadata.sheet) ? row.metadata.sheet : null;
    const link = typeof sheet?.link === "string" ? sheet.link : "";
    try {
      const { text } = await fetchSheetCsv(link);
      const read = readSpreadsheet(text, { today: localDate(new Date(), row.timezone || DEFAULT_TIME_ZONE) });
      if (!read.ok) {
        const first = read.errors[0];
        await recordImportFailure(db, account, "scheduled", first ? `${first.line > 0 ? `Linha ${first.line}: ` : ""}${first.message}` : "Planilha inválida.");
        failed++;
        continue;
      }
      await writeImport(db, account, read.rows, "scheduled");
      refreshed++;
    } catch (err) {
      failed++;
      // erro com mensagem para a pessoa (link fechado, grande demais): fica no histórico da conta
      if (err instanceof AppError && err.code !== "sync:running") await recordImportFailure(db, account, "scheduled", err.message);
      else if (!(err instanceof AppError)) console.error("[vyz] planilha agendada", row.id, err instanceof Error ? err.message : err);
    }
  }
  return { due: due.length, refreshed, failed, pending: due.length - done };
}
