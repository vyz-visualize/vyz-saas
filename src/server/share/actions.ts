"use server";

// Ações de compartilhamento (Server Actions): links públicos e relatórios
// agendados. Tudo com a sessão de quem pede (RLS): membros criam; o link só é
// revogado por quem criou ou por um admin, e revogado não volta. O token sai
// daqui uma única vez; o banco guarda só o hash.

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { EXPIRY_VALUES, expiresAtFrom, type ExpiryOption } from "@/features/share/links";
import { nextRunAt, parseRecipients, type ReportFormat, type ReportFrequency } from "@/features/share/schedule";
import { authorize } from "@/server/auth/workspace";
import { getDashboard } from "@/server/dashboards/queries";
import { logActivity } from "@/server/history/log";
import { appOrigin } from "@/server/http/request";
import { appError, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";
import { newShareToken } from "./token";

const Id = z.uuid();

export type CreatedShareLink = { id: string; url: string; expiresAt: string | null; hideSpend: boolean };

const ShareInput = z.object({ dashboardId: Id, expires: z.enum(EXPIRY_VALUES), hideSpend: z.boolean() });

/** Gera um link só de leitura (member). O link completo só aparece nesta resposta. */
export async function createShareLink(input: { dashboardId: string; expires: ExpiryOption; hideSpend: boolean }): Promise<ActionResult<CreatedShareLink>> {
  try {
    const parsed = ShareInput.safeParse(input);
    if (!parsed.success) throw appError("validation");
    const session = await authorize("member");
    const d = await getDashboard(parsed.data.dashboardId);
    if (!d) throw appError("dashboard:not_found");

    const { token, hash, hint } = newShareToken();
    const expiresAt = expiresAtFrom(parsed.data.expires, new Date());
    const supabase = await createServerSupabase();
    const row = unwrap(
      await supabase
        .from("share_links")
        .insert({ workspace_id: session.workspace.id, dashboard_id: d.id, token_hash: hash, token_hint: hint, hide_spend: parsed.data.hideSpend, expires_at: expiresAt, created_by: session.user.id })
        .select("id")
        .single(),
    );
    if (!row) throw appError("unknown");
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "share_link.created", entityType: "share_link", entityId: row.id, metadata: { dashboard_id: d.id, hide_spend: parsed.data.hideSpend, expires: parsed.data.expires } });
    return { ok: true, data: { id: row.id, url: `${await appOrigin()}/r/${token}`, expiresAt, hideSpend: parsed.data.hideSpend } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Revoga o link (quem criou ou admin; o RLS decide). Não precisa de plano ativo. */
export async function revokeShareLink(linkId: string): Promise<ActionResult> {
  try {
    if (!Id.safeParse(linkId).success) throw appError("not_found");
    const session = await authorize("member", { access: false });
    const supabase = await createServerSupabase();
    const rows = unwrap(await supabase.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", linkId).eq("workspace_id", session.workspace.id).is("revoked_at", null).select("id")) ?? [];
    if (rows.length === 0) throw appError("forbidden", "Só quem criou o link ou um admin pode revogar. Links já revogados ficam assim.");
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "share_link.revoked", entityType: "share_link", entityId: linkId });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

const ReportInput = z
  .object({
    dashboardId: Id,
    frequency: z.enum(["weekly", "monthly"]),
    day: z.number().int().min(0).max(28),
    sendHour: z.number().int().min(0).max(23),
    format: z.enum(["pdf", "whatsapp"]),
    recipients: z.string().max(2000),
  })
  .refine((r) => (r.frequency === "weekly" ? r.day <= 6 : r.day >= 1), { message: "Dia inválido.", path: ["day"] });

/**
 * Agenda o envio do dashboard (member). Grava o agendamento e os destinatários;
 * o envio automático ainda não existe (fica pendente na interface).
 */
export async function createScheduledReport(input: {
  dashboardId: string;
  frequency: ReportFrequency;
  day: number;
  sendHour: number;
  format: ReportFormat;
  recipients: string;
}): Promise<ActionResult<{ id: string; nextRunAt: string }>> {
  try {
    const parsed = ReportInput.safeParse(input);
    if (!parsed.success) throw appError("validation");
    const r = parsed.data;
    const recipients = parseRecipients(r.recipients, r.format);
    if (!recipients.ok) throw appError("validation", recipients.error, { recipients: recipients.error });
    const session = await authorize("member");
    const d = await getDashboard(r.dashboardId);
    if (!d) throw appError("dashboard:not_found");

    const timezone = session.workspace.timezone || "America/Sao_Paulo";
    const weekday = r.frequency === "weekly" ? r.day : null;
    const monthDay = r.frequency === "monthly" ? r.day : null;
    const next = nextRunAt({ frequency: r.frequency, weekday, monthDay, sendHour: r.sendHour, timeZone: timezone }, new Date()).toISOString();
    const supabase = await createServerSupabase();
    const report = unwrap(
      await supabase
        .from("scheduled_reports")
        .insert({ workspace_id: session.workspace.id, dashboard_id: d.id, frequency: r.frequency, weekday, month_day: monthDay, format: r.format, send_hour: r.sendHour, timezone, next_run_at: next, created_by: session.user.id })
        .select("id")
        .single(),
    );
    if (!report) throw appError("unknown");
    const { error } = await supabase.from("scheduled_report_recipients").insert(recipients.recipients.map((x) => ({ workspace_id: session.workspace.id, report_id: report.id, channel: x.channel, address: x.address })));
    if (error) {
      // sem destinatários o agendamento não serve: desfaz
      await supabase.from("scheduled_reports").delete().eq("id", report.id);
      throw appError("validation", "Confira os destinatários.", { recipients: "Confira os destinatários." });
    }
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "report.scheduled", entityType: "scheduled_report", entityId: report.id, metadata: { dashboard_id: d.id, frequency: r.frequency, format: r.format, recipients: recipients.recipients.length } });
    return { ok: true, data: { id: report.id, nextRunAt: next } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Pausa ou retoma um agendamento (member). */
export async function setReportActive(reportId: string, active: boolean): Promise<ActionResult> {
  try {
    if (!Id.safeParse(reportId).success || typeof active !== "boolean") throw appError("validation");
    // pausar nunca exige plano; retomar sim
    const session = await authorize("member", { access: active });
    const supabase = await createServerSupabase();
    const report = unwrap(await supabase.from("scheduled_reports").select("frequency, weekday, month_day, send_hour, timezone").eq("id", reportId).eq("workspace_id", session.workspace.id).maybeSingle());
    if (!report) throw appError("not_found");
    // ao retomar, o próximo envio é recalculado a partir de agora
    const next = active ? nextRunAt({ frequency: report.frequency, weekday: report.weekday, monthDay: report.month_day, sendHour: report.send_hour, timeZone: report.timezone }, new Date()).toISOString() : null;
    unwrap(await supabase.from("scheduled_reports").update({ is_active: active, next_run_at: next }).eq("id", reportId));
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: active ? "report.resumed" : "report.paused", entityType: "scheduled_report", entityId: reportId });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Apaga um agendamento e seus destinatários (member). O histórico de envios fica. */
export async function deleteScheduledReport(reportId: string): Promise<ActionResult> {
  try {
    if (!Id.safeParse(reportId).success) throw appError("not_found");
    const session = await authorize("member", { access: false });
    const supabase = await createServerSupabase();
    const rows = unwrap(await supabase.from("scheduled_reports").delete().eq("id", reportId).eq("workspace_id", session.workspace.id).select("id")) ?? [];
    if (rows.length === 0) throw appError("not_found");
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "report.deleted", entityType: "scheduled_report", entityId: reportId });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}
