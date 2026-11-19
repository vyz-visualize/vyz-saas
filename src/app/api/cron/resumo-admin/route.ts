// GET|POST /api/cron/resumo-admin
// Toda segunda de manhã: manda o resumo do painel interno (usuários e receita
// por fonte) para os e-mails da Vyzualize. Só com "Authorization: Bearer <CRON_SECRET>".

import { weeklyEmail } from "@/features/admin/email";
import { REPORT_RECIPIENTS } from "@/server/admin/credentials";
import { sendMail } from "@/server/admin/mail";
import { loadAdminReport } from "@/server/admin/report";
import { CRON_HEADERS, rejectCron } from "@/server/sync/cron";

export const maxDuration = 120;
async function handle(request: Request) {
  const denied = rejectCron(request);
  if (denied) return denied;
  const report = await loadAdminReport({ fresh: true });
  const sent = await sendMail(REPORT_RECIPIENTS, weeklyEmail(report));
  if (!sent.ok) console.error("[vyz] resumo admin", sent.error);
  return Response.json({ ok: sent.ok, error: sent.ok ? undefined : "mail:failed" }, { status: sent.ok ? 200 : 502, headers: CRON_HEADERS });
}

export const GET = handle;
export const POST = handle;
