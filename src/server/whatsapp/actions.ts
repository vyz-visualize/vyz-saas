"use server";

// Ações da seção WhatsApp do painel: cadastrar e verificar o número (código
// de 6 dígitos por template de autenticação), escolher os relatórios, pausar,
// mandar um relatório de teste e sair. Só no plano com whatsappReports.

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { normalizePhone } from "@/features/checkout/phone";
import { isReportKind, type ReportKind } from "@/features/whatsapp/templates";
import { authorize } from "@/server/auth/workspace";
import { serverEnv } from "@/server/env";
import { hitRateLimit } from "@/server/security/rate-limit";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, fromPostgrest, toActionError, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";
import { sendTemplate } from "./client";
import { recordOut, ReportContext, sendReport } from "./service";
import { logActivity } from "@/server/history/log";

const CODE_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;

const hashCode = (subscriptionId: string, code: string) => createHmac("sha256", serverEnv().SUPABASE_SERVICE_ROLE_KEY).update(`${subscriptionId}:${code}`).digest("hex");

async function session() {
  const s = await authorize("viewer");
  if (!s.access.entitlements?.whatsappReports) throw appError("plan:whatsapp", "Relatórios no WhatsApp são do plano Avançado.");
  return s;
}

async function ownSubscription(workspaceId: string, userId: string) {
  const { data } = await createAdminSupabase().from("whatsapp_subscriptions").select("*").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
  return data;
}

/** Passo 1: guarda o número e manda o código. */
export async function startWhatsappVerification(input: { phone: string; consent: boolean }): Promise<ActionResult<{ phone: string; simulated: boolean }>> {
  try {
    const s = await session();
    const phone = normalizePhone(input.phone ?? "");
    if (!phone) throw appError("validation", undefined, { phone: "Informe um WhatsApp válido com DDD." });
    if (!input.consent) throw appError("validation", undefined, { consent: "Confirme que aceita receber os relatórios." });
    if (!(await hitRateLimit("whatsapp_code_user", s.user.id)) || !(await hitRateLimit("whatsapp_code_phone", phone))) throw appError("rate_limited");

    const db = createAdminSupabase();
    const current = await ownSubscription(s.workspace.id, s.user.id);
    const changed = current?.phone !== phone;
    const { data: sub, error } = await db
      .from("whatsapp_subscriptions")
      .upsert({ workspace_id: s.workspace.id, user_id: s.user.id, phone, ...(changed ? { verified_at: null, welcome_sent_at: null } : {}) }, { onConflict: "workspace_id,user_id" })
      .select("*")
      .single();
    if (error || !sub) throw error ? fromPostgrest(error) : appError("unknown");

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await db.from("whatsapp_verification_codes").update({ consumed_at: new Date().toISOString() }).eq("subscription_id", sub.id).is("consumed_at", null);
    await db.from("whatsapp_verification_codes").insert({ subscription_id: sub.id, phone, code_hash: hashCode(sub.id, code), expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString() });
    const r = await sendTemplate(phone, "codigo", [code]);
    // o código nunca vai para o registro, nem simulado
    await recordOut(db, sub.id, "codigo", { ...r, body: r.body.replace(code, "******") });
    if (r.status === "failed") throw appError("whatsapp:send", r.error ?? "Não conseguimos enviar o código.");
    if (r.status === "simulado") console.info(`[vyz] whatsapp simulado: código de verificação ${code}`);
    await logActivity({ workspaceId: s.workspace.id, actorId: s.user.id, event: "whatsapp.verification_started", entityType: "whatsapp_subscription", entityId: sub.id, metadata: { number_changed: changed } });
    refresh();
    return { ok: true, data: { phone, simulated: r.status === "simulado" } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Passo 2: confere o código, registra o consentimento e manda as boas-vindas. */
export async function confirmWhatsappCode(input: { code: string }): Promise<ActionResult> {
  try {
    const s = await session();
    const code = (input.code ?? "").replace(/\D/g, "");
    if (code.length !== 6) throw appError("validation", undefined, { code: "O código tem 6 dígitos." });
    const db = createAdminSupabase();
    const sub = await ownSubscription(s.workspace.id, s.user.id);
    if (!sub) throw appError("not_found");
    const { data: row } = await db
      .from("whatsapp_verification_codes")
      .select("*")
      .eq("subscription_id", sub.id)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row || row.phone !== sub.phone || Date.parse(row.expires_at) < Date.now() || row.attempts >= MAX_ATTEMPTS) {
      throw appError("validation", undefined, { code: "Código expirado. Peça um novo." });
    }
    const ok = timingSafeEqual(Buffer.from(hashCode(sub.id, code)), Buffer.from(row.code_hash));
    if (!ok) {
      await db.from("whatsapp_verification_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      throw appError("validation", undefined, { code: row.attempts + 1 >= MAX_ATTEMPTS ? "Muitas tentativas. Peça um novo código." : "Código incorreto." });
    }
    const now = new Date().toISOString();
    await db.from("whatsapp_verification_codes").update({ consumed_at: now }).eq("id", row.id);
    const { data: verified } = await db
      .from("whatsapp_subscriptions")
      .update({ verified_at: now, opted_in_at: now, opt_in_source: "painel", opted_out_at: null })
      .eq("id", sub.id)
      .select("*")
      .single();
    if (verified && verified.reports.includes("boas-vindas") && !verified.welcome_sent_at) {
      await sendReport(new ReportContext(db), verified, "boas-vindas").catch((e) => console.error("[vyz] whatsapp boas-vindas", e));
    }
    await logActivity({ workspaceId: s.workspace.id, actorId: s.user.id, event: "whatsapp.verified", entityType: "whatsapp_subscription", entityId: sub.id });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

const Prefs = z.object({ reports: z.array(z.string()).max(4).optional(), paused: z.boolean().optional() }).strict();

/** Relatórios escolhidos e pausa (pelo cliente do usuário: o RLS só deixa mexer na própria inscrição). */
export async function updateWhatsappPreferences(input: z.input<typeof Prefs>): Promise<ActionResult> {
  try {
    const s = await session();
    const p = Prefs.safeParse(input);
    if (!p.success) throw appError("validation");
    const patch: { reports?: ReportKind[]; paused?: boolean } = {};
    if (p.data.reports) patch.reports = [...new Set(p.data.reports.filter(isReportKind))];
    if (p.data.paused !== undefined) patch.paused = p.data.paused;
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("whatsapp_subscriptions").update(patch).eq("workspace_id", s.workspace.id).eq("user_id", s.user.id);
    if (error) throw fromPostgrest(error);
    await logActivity({ workspaceId: s.workspace.id, actorId: s.user.id, event: "whatsapp.preferences_changed", entityType: "whatsapp_subscription", metadata: { ...(patch.reports ? { reports: patch.reports } : {}), ...(patch.paused !== undefined ? { paused: patch.paused } : {}) } });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Relatório de teste agora (com limite por hora). */
export async function sendWhatsappTest(): Promise<ActionResult<{ status: string }>> {
  try {
    const s = await session();
    const sub = await ownSubscription(s.workspace.id, s.user.id);
    if (!sub?.verified_at) throw appError("validation", "Verifique o número antes.");
    if (sub.opted_out_at) throw appError("validation", "Você respondeu PARAR. Responda VOLTAR no WhatsApp para receber de novo.");
    if (!(await hitRateLimit("whatsapp_test_user", s.user.id))) throw appError("rate_limited");
    const r = await sendReport(new ReportContext(createAdminSupabase()), sub, "teste");
    if (r?.status === "failed") throw appError("whatsapp:send", r.error ?? "Falha no envio.");
    await logActivity({ workspaceId: s.workspace.id, actorId: s.user.id, event: "whatsapp.test_sent", entityType: "whatsapp_subscription", entityId: sub.id, metadata: { status: r?.status ?? "sem dados" } });
    refresh();
    return { ok: true, data: { status: r?.status ?? "sem dados" } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Tira o número (apaga a inscrição; o registro de mensagens vai junto). */
export async function removeWhatsapp(): Promise<ActionResult> {
  try {
    const s = await authorize("viewer", { access: false });
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("whatsapp_subscriptions").delete().eq("workspace_id", s.workspace.id).eq("user_id", s.user.id);
    if (error) throw fromPostgrest(error);
    await logActivity({ workspaceId: s.workspace.id, actorId: s.user.id, event: "whatsapp.removed", entityType: "whatsapp_subscription" });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}
