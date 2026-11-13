import "server-only";

// Releitura diária das planilhas do lançamento ligadas aos dashboards. Roda no mesmo
// agendador da sincronização (/api/cron/sync), uma planilha por vez e dentro de um tempo
// máximo. Só workspaces com acesso; quem foi lido (ou tentado) há menos de 20 horas espera
// a próxima rodada. Falha fica em last_error (a tela mostra) e os números antigos ficam.

import { DEFAULT_TIME_ZONE, localDate } from "@/features/sync/dates";
import type { Json } from "@/lib/supabase/database.types";
import { createAdminSupabase } from "@/server/supabase/admin";
import { AppError } from "@/server/supabase/errors";
import { readLaunchLink } from "./launch";

const HOUR = 60 * 60 * 1000;

export type LaunchRefreshSummary = { due: number; refreshed: number; failed: number; pending: number };

export async function refreshLaunchSheets(opts: { budgetMs?: number; minIntervalMs?: number; limit?: number } = {}): Promise<LaunchRefreshSummary> {
  const startedAt = Date.now();
  const budget = opts.budgetMs ?? 60_000;
  const cutoff = new Date(startedAt - (opts.minIntervalMs ?? 20 * HOUR)).toISOString();
  const db = createAdminSupabase();

  const { data, error } = await db
    .from("dashboard_launch_sheets")
    .select("dashboard_id, workspace_id, link, last_attempt_at")
    .or(`last_attempt_at.is.null,last_attempt_at.lt.${cutoff}`)
    .order("last_attempt_at", { ascending: true, nullsFirst: true })
    .limit(opts.limit ?? 100);
  // sem a migração aplicada, não há o que reler
  if (error) return { due: 0, refreshed: 0, failed: 0, pending: 0 };

  const ids = [...new Set((data ?? []).map((r) => r.workspace_id))];
  const [access, zones] = ids.length
    ? await Promise.all([db.from("workspace_access").select("workspace_id, has_access").in("workspace_id", ids), db.from("workspaces").select("id, timezone").in("id", ids)])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (access.error) throw access.error;
  const active = new Set((access.data ?? []).filter((w) => w.has_access).map((w) => w.workspace_id));
  const tz = new Map((zones.data ?? []).map((w) => [w.id, w.timezone as string | null]));
  const due = (data ?? []).filter((r) => active.has(r.workspace_id));

  let refreshed = 0;
  let failed = 0;
  let done = 0;
  for (const row of due) {
    if (Date.now() - startedAt > budget) break;
    done++;
    const now = new Date().toISOString();
    try {
      const read = await readLaunchLink(row.link, { workspaceId: row.workspace_id, today: localDate(new Date(), tz.get(row.workspace_id) || DEFAULT_TIME_ZONE) });
      const saved = await db
        .from("dashboard_launch_sheets")
        .update({ rows: read.rows as unknown as Json, summary: read.summary as unknown as Json, via: read.via, read_at: now, last_attempt_at: now, last_error: null, updated_at: now })
        .eq("dashboard_id", row.dashboard_id);
      if (saved.error) throw saved.error;
      refreshed++;
    } catch (err) {
      failed++;
      // mensagem para a pessoa (link fechado, linha inválida) fica na planilha; o resto, só no log
      const message = err instanceof AppError ? err.message.slice(0, 500) : "Não foi possível reler a planilha. Tentamos de novo amanhã.";
      if (!(err instanceof AppError)) console.error("[vyz] planilha do lançamento agendada", row.dashboard_id, err instanceof Error ? err.message : err);
      await db.from("dashboard_launch_sheets").update({ last_attempt_at: now, last_error: message }).eq("dashboard_id", row.dashboard_id);
    }
  }
  return { due: due.length, refreshed, failed, pending: due.length - done };
}
