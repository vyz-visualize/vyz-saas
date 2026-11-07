// GET|POST /api/cron/whatsapp?mode=daily|weekly
// Relatórios pelo WhatsApp da VYZ. daily (toda manhã, junto do resumo por
// push): resumo diário + alertas. weekly (segunda de manhã): resumo semanal.
// Só com "Authorization: Bearer <CRON_SECRET>". Workspace que perdeu o plano
// (ou a assinatura) para de receber; nada é apagado.

import { isAuthorizedCron, cronSecret } from "@/server/sync/cron";
import { createAdminSupabase } from "@/server/supabase/admin";
import { ReportContext, sendAlerts, sendReport, wants, workspaceAllowsWhatsapp } from "@/server/whatsapp/service";

export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

async function handle(request: Request) {
  const secret = cronSecret();
  if (!secret) return Response.json({ ok: false, error: "cron:not_configured" }, { status: 503, headers: NO_STORE });
  if (!isAuthorizedCron(request.headers.get("authorization"), secret)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const mode = new URL(request.url).searchParams.get("mode") === "weekly" ? "weekly" : "daily";

  const started = Date.now();
  const db = createAdminSupabase();
  const { data: subs, error } = await db.from("whatsapp_subscriptions").select("*").not("verified_at", "is", null).is("opted_out_at", null).eq("paused", false);
  if (error) return Response.json({ ok: false, error: "unknown" }, { status: 500, headers: NO_STORE });

  const ctx = new ReportContext(db);
  const allowed = new Map<string, boolean>();
  let reports = 0;
  let alerts = 0;
  let skippedPlan = 0;
  for (const sub of subs ?? []) {
    if (Date.now() - started > (maxDuration - 40) * 1000) break;
    if (!allowed.has(sub.workspace_id)) allowed.set(sub.workspace_id, await workspaceAllowsWhatsapp(db, sub.workspace_id));
    if (!allowed.get(sub.workspace_id)) {
      skippedPlan++;
      continue;
    }
    try {
      if (mode === "weekly") {
        if (wants(sub, "semanal") && (await sendReport(ctx, sub, "semanal"))) reports++;
      } else {
        if (wants(sub, "diario") && (await sendReport(ctx, sub, "diario"))) reports++;
        if (wants(sub, "alertas")) alerts += await sendAlerts(ctx, sub);
      }
    } catch (err) {
      console.error("[vyz] whatsapp cron", sub.id, err);
    }
  }
  return Response.json({ ok: true, mode, reports, alerts, skippedPlan }, { headers: NO_STORE });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
