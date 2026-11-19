import "server-only";

// Central de compartilhamento (/painel/compartilhar): links, relatórios
// agendados, exportações e envios do workspace aberto, com o RLS de quem está
// logado (membros leem). Do link sai só a dica do token, nunca o hash.

import { cache } from "react";
import type { DeliveryItem, ShareCenter } from "@/features/share/types";
import { getWorkspaceSession } from "@/server/auth/workspace";
import { appError, unwrap } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

const LIMIT = 100;

/** Tudo o que saiu dos dashboards do workspace. Uma consulta por tipo, em paralelo. */
export const getShareCenter = cache(async (): Promise<ShareCenter> => {
  const session = await getWorkspaceSession();
  if (!session) throw appError("auth:required");
  const ws = session.workspace.id;
  const isAdmin = session.role === "admin" || session.role === "owner";
  const supabase = await createServerSupabase();

  const [links, reports, exportsRows, deliveries] = await Promise.all([
    supabase
      .from("share_links")
      .select("id, dashboard_id, token_hint, recipient_name, hide_spend, expires_at, revoked_at, view_count, last_viewed_at, created_by, created_at, dashboard:dashboards!share_links_workspace_id_dashboard_id_fkey(name)")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("scheduled_reports")
      .select(
        "id, dashboard_id, frequency, weekday, month_day, send_hour, timezone, format, is_active, next_run_at, last_run_at, created_at, dashboard:dashboards!scheduled_reports_workspace_id_dashboard_id_fkey(name), recipients:scheduled_report_recipients!scheduled_report_recipients_workspace_id_report_id_fkey(address)",
      )
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("dashboard_exports")
      .select("id, dashboard_id, dashboard_name, kind, created_at")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase
      .from("report_deliveries")
      .select("id, status, channel, recipients_count, period_start, period_end, error, created_at, dashboard:dashboards!report_deliveries_workspace_id_dashboard_id_fkey(name)")
      .eq("workspace_id", ws)
      .order("created_at", { ascending: false })
      .limit(LIMIT),
  ]);

  return {
    links: (unwrap(links) ?? []).map((l) => ({
      id: l.id,
      dashboardId: l.dashboard_id,
      dashboardName: l.dashboard?.name ?? "Dashboard",
      tokenHint: l.token_hint,
      recipientName: l.recipient_name,
      hideSpend: l.hide_spend,
      expiresAt: l.expires_at,
      revokedAt: l.revoked_at,
      viewCount: l.view_count,
      lastViewedAt: l.last_viewed_at,
      createdAt: l.created_at,
      canRevoke: isAdmin || l.created_by === session.user.id,
    })),
    reports: (unwrap(reports) ?? []).map((r) => ({
      id: r.id,
      dashboardId: r.dashboard_id,
      dashboardName: r.dashboard?.name ?? "Dashboard",
      frequency: r.frequency,
      weekday: r.weekday,
      monthDay: r.month_day,
      sendHour: r.send_hour,
      timezone: r.timezone,
      format: r.format,
      isActive: r.is_active,
      nextRunAt: r.next_run_at,
      lastRunAt: r.last_run_at,
      recipients: r.recipients.map((x) => x.address),
      createdAt: r.created_at,
    })),
    exports: (unwrap(exportsRows) ?? []).map((x) => ({ id: x.id, dashboardId: x.dashboard_id, dashboardName: x.dashboard_name, kind: "pdf", createdAt: x.created_at })),
    deliveries: (unwrap(deliveries) ?? []).map((d) => ({
      id: d.id,
      dashboardName: d.dashboard?.name ?? null,
      status: d.status as DeliveryItem["status"],
      channel: d.channel as DeliveryItem["channel"],
      recipientsCount: d.recipients_count,
      periodStart: d.period_start,
      periodEnd: d.period_end,
      error: d.error,
      createdAt: d.created_at,
    })),
  };
});
