// GET|POST /api/cron/resumo-admin
// Toda segunda de manhã: manda o resumo do painel interno (usuários e receita
// por fonte) para os e-mails da Vyzualize. Só com "Authorization: Bearer <CRON_SECRET>".

import { weeklyEmail } from "@/features/admin/email";
import { REPORT_RECIPIENTS } from "@/server/admin/credentials";
import { sendMail } from "@/server/admin/mail";
import { loadAdminReport } from "@/server/admin/report";
import { cronSecret, isAuthorizedCron } from "@/server/sync/cron";

export const maxDuration = 120;
const NO_STORE = { "Cache-Control": "no-store" };

async function handle(request: Request) {
  const secret = cronSecret();
  if (!secret) return Response.json({ ok: false, error: "cron:not_configured" }, { status: 503, headers: NO_STORE });
  if (!isAuthorizedCron(request.headers.get("authorization"), secret)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const report = await loadAdminReport({ fresh: true });
  const sent = await sendMail(REPORT_RECIPIENTS, weeklyEmail(report));
  if (!sent.ok) console.error("[vyz] resumo admin", sent.error);
  return Response.json({ ok: sent.ok, error: sent.ok ? undefined : "mail:failed" }, { status: sent.ok ? 200 : 502, headers: NO_STORE });
}

export const GET = handle;
export const POST = handle;
