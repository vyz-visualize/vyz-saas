// GET|POST /api/cron/digest
// Resumo diário por push (agendado de manhã): para cada usuário com o app
// instalado, a análise mais importante do workspace padrão dele. Só com
// "Authorization: Bearer <CRON_SECRET>".

import { cronSecret, isAuthorizedCron } from "@/server/sync/cron";
import { loadWorkspaceInsights } from "@/server/insights/load";
import { pushConfigured, sendPush, type PushTarget } from "@/server/push/send";
import { createAdminSupabase } from "@/server/supabase/admin";

export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

const money = (v: number | null, currency: string) => (v === null ? null : new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(v));

async function handle(request: Request) {
  const authorization = request.headers.get("authorization");
  const secret = cronSecret();
  if (!secret) return Response.json({ ok: false, error: "cron:not_configured" }, { status: 503, headers: NO_STORE });
  if (!isAuthorizedCron(authorization, secret)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401, headers: NO_STORE });
  const cfg = pushConfigured();
  if (!cfg.ios && !cfg.android) return Response.json({ ok: false, error: "push:not_configured" }, { status: 503, headers: NO_STORE });

  const started = Date.now();
  const db = createAdminSupabase();
  const { data: tokens, error } = await db.from("push_tokens").select("user_id, token, platform");
  if (error) return Response.json({ ok: false, error: "unknown" }, { status: 500, headers: NO_STORE });

  const byUser = new Map<string, PushTarget[]>();
  for (const t of tokens ?? []) byUser.set(t.user_id, [...(byUser.get(t.user_id) ?? []), { token: t.token, platform: t.platform as PushTarget["platform"] }]);

  // o mesmo workspace serve vários usuários: calcula uma vez
  const cache = new Map<string, Awaited<ReturnType<typeof loadWorkspaceInsights>> | null>();
  let sent = 0;
  let users = 0;
  for (const [userId, targets] of byUser) {
    if (Date.now() - started > (maxDuration - 40) * 1000) break;
    const [{ data: profile }, { data: members }] = await Promise.all([
      db.from("profiles").select("default_workspace_id").eq("id", userId).maybeSingle(),
      db.from("workspace_members").select("workspace_id, workspace:workspaces!inner(name)").eq("user_id", userId).order("created_at"),
    ]);
    const member = members?.find((m) => m.workspace_id === profile?.default_workspace_id) ?? members?.[0];
    if (!member) continue;
    const { data: access } = await db.from("workspace_access").select("has_access").eq("workspace_id", member.workspace_id).maybeSingle();
    if (!access?.has_access) continue;
    if (!cache.has(member.workspace_id)) cache.set(member.workspace_id, await loadWorkspaceInsights(db, member.workspace_id, "7d", 10).catch(() => null));
    const result = cache.get(member.workspace_id);
    const top = result?.insights[0];
    if (!result || !top) continue;
    const spend = result.pulse.reduce((n, p) => n + (p.spend ?? 0), 0);
    const currency = result.pulse[0]?.currency ?? "BRL";
    const lead = result.pulse.length ? `${money(spend, currency)} investidos em 7 dias. ` : "";
    const r = await sendPush(targets, {
      title: top.title,
      body: `${lead}${top.body}`.slice(0, 220),
      data: { dashboardId: top.dashboardId, ...(top.campaignId ? { campaignId: top.campaignId } : {}), ...(top.metric ? { metric: top.metric } : {}) },
    });
    sent += r.sent;
    users++;
  }
  return Response.json({ ok: true, users, sent }, { headers: NO_STORE });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
