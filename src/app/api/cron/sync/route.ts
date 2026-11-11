// GET|POST /api/cron/sync
// Sincronização agendada (Vercel Cron ou outro agendador): traz os últimos 7
// dias das contas ativas que não sincronizam há algumas horas e relê as
// planilhas do Google Sheets ligadas a contas de planilha. Só com
// "Authorization: Bearer <CRON_SECRET>"; sem o segredo configurado, 503.

import { refreshSheetAccounts, type SheetRefreshSummary } from "@/server/import/scheduled";
import { cronSecret, isAuthorizedCron } from "@/server/sync/cron";
import { syncDueAccounts } from "@/server/sync/scheduled";

export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

async function handle(request: Request) {
  // ler o cabeçalho primeiro também deixa a rota fora da pré-renderização
  const authorization = request.headers.get("authorization");
  const secret = cronSecret();
  if (!secret) return Response.json({ ok: false, error: "cron:not_configured", message: "Defina CRON_SECRET para liberar a sincronização agendada." }, { status: 503, headers: NO_STORE });
  if (!isAuthorizedCron(authorization, secret)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });

  try {
    // termina antes do limite da função, com folga para a resposta
    const startedAt = Date.now();
    const total = (maxDuration - 45) * 1000;
    // as planilhas do Google Sheets ficam com o fim da rodada: no mínimo 20 s, no máximo o que sobrar
    const summary = await syncDueAccounts({ budgetMs: total - 20_000 });
    let sheets: SheetRefreshSummary | { error: string };
    try {
      sheets = await refreshSheetAccounts({ budgetMs: Math.max(20_000, total - (Date.now() - startedAt)) });
    } catch (err) {
      console.error("[vyz] cron das planilhas", err instanceof Error ? err.message : err);
      sheets = { error: "unknown" };
    }
    return Response.json({ ...summary, sheets }, { headers: NO_STORE });
  } catch (err) {
    console.error("[vyz] cron de sincronização", err instanceof Error ? err.message : err);
    return Response.json({ ok: false, error: "unknown" }, { status: 500, headers: NO_STORE });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
