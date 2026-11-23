// GET|POST /api/cron/sync
// Sincronização agendada (Vercel Cron ou outro agendador): traz os últimos 7
// dias das contas ativas que não sincronizam há algumas horas e relê as
// planilhas do Google Sheets ligadas a contas de planilha. A carga do histórico do MMM tem o
// cron próprio (/api/cron/mmm). Só com "Authorization: Bearer <CRON_SECRET>"; sem o segredo
// configurado, 503.

import { refreshSheetAccounts, type SheetRefreshSummary } from "@/server/import/scheduled";
import { refreshLaunchSheets, type LaunchRefreshSummary } from "@/server/import/launch-scheduled";
import { CRON_HEADERS, rejectCron } from "@/server/sync/cron";
import { parseSyncGroup } from "@/features/sync/round";
import { syncDueAccounts } from "@/server/sync/scheduled";

export const maxDuration = 300;

async function handle(request: Request) {
  const denied = rejectCron(request);
  if (denied) return denied;

  try {
    // termina antes do limite da função, com folga para a resposta
    const startedAt = Date.now();
    const total = (maxDuration - 45) * 1000;
    // as planilhas do Google Sheets ficam com o fim da rodada: no mínimo 20 s, no máximo o que sobrar
    // ?grupo=anuncios (Meta, Google, GA4, CRMs) ou ?grupo=organico (Instagram e Página), cada um no
    // cron dele; sem grupo, todas. Conta nova só começa até 60 s antes do fim; a que passar de 20 s
    // antes do fim é encerrada aqui e volta na próxima rodada.
    const group = parseSyncGroup(new URL(request.url).searchParams.get("grupo"));
    const summary = await syncDueAccounts({ budgetMs: total - 60_000, hardStopMs: total - 20_000, ...(group ? { group } : {}) });
    // as planilhas vão com os anúncios (o cron do orgânico só sincroniza o orgânico)
    if (group === "organico") return Response.json({ ...summary, group }, { headers: CRON_HEADERS });
    let sheets: SheetRefreshSummary | { error: string };
    try {
      sheets = await refreshSheetAccounts({ budgetMs: Math.max(20_000, total - (Date.now() - startedAt)) });
    } catch (err) {
      console.error("[vyz] cron das planilhas", err instanceof Error ? err.message : err);
      sheets = { error: "unknown" };
    }
    // planilhas do lançamento ligadas aos dashboards (visuais com capa)
    let launch: LaunchRefreshSummary | { error: string } | null = null;
    if (total - (Date.now() - startedAt) > 15_000) {
      try {
        launch = await refreshLaunchSheets({ budgetMs: Math.max(15_000, total - (Date.now() - startedAt) - 60_000) });
      } catch (err) {
        console.error("[vyz] cron das planilhas do lançamento", err instanceof Error ? err.message : err);
        launch = { error: "unknown" };
      }
    }
    return Response.json({ ...summary, sheets, launch }, { headers: CRON_HEADERS });
  } catch (err) {
    console.error("[vyz] cron de sincronização", err instanceof Error ? err.message : err);
    return Response.json({ ok: false, error: "unknown" }, { status: 500, headers: CRON_HEADERS });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
