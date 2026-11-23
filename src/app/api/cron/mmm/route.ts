// GET|POST /api/cron/mmm
// Carga do histórico do MMM (docs/MMM.md), no cron próprio: vários horários por dia, longe da
// sincronização e do digest, cada rodada com os 300 s da função. Desligada
// (scripts/mmm/backfill.ts --pause) ou sem a migration, uma consulta e sai.
// Só com "Authorization: Bearer <CRON_SECRET>"; sem o segredo configurado, 503.

import { runBackfillRound } from "@/server/mmm/backfill";
import { CRON_HEADERS, rejectCron } from "@/server/sync/cron";

export const maxDuration = 300;

async function handle(request: Request) {
  const denied = rejectCron(request);
  if (denied) return denied;
  try {
    // termina antes do limite da função, com folga para a resposta
    const mmm = await runBackfillRound({ budgetMs: (maxDuration - 30) * 1000 });
    return Response.json({ ok: true, mmm }, { headers: CRON_HEADERS });
  } catch (err) {
    console.error("[vyz] cron do MMM", err instanceof Error ? err.message : err);
    return Response.json({ ok: false, error: "unknown" }, { status: 500, headers: CRON_HEADERS });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
