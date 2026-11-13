import "server-only";

// Relatórios pelo WhatsApp: quem pode receber, montar cada relatório com o
// motor de análises e registrar o envio. Usa o cliente de serviço (o
// agendador, o webhook e as ações já conferiram a quem pertence).

import type { Insight } from "@/features/insights/insights";
import { alertParams, dailyParams, weeklyParams, welcomeParams } from "@/features/whatsapp/reports";
import { alertKey, pickAlerts, planAllowsWhatsapp } from "@/features/whatsapp/rules";
import type { ReportKind, TemplateId } from "@/features/whatsapp/templates";
import type { Tables } from "@/lib/supabase/database.types";
import { loadWorkspaceInsights, userProjectIds } from "@/server/insights/load";
import type { DB } from "@/server/supabase/server";
import { sendTemplate, type SendResult } from "./client";

export type Subscription = Tables<"whatsapp_subscriptions">;
type Loaded = Awaited<ReturnType<typeof loadWorkspaceInsights>>;
export type MessageKind = TemplateId | "teste" | "texto" | "resposta";

/** Registra uma mensagem enviada (ou simulada, ou que falhou). */
export async function recordOut(db: DB, subscriptionId: string | null, kind: MessageKind, r: SendResult, refKey: string | null = null) {
  const { error } = await db.from("whatsapp_messages").insert({
    subscription_id: subscriptionId,
    direction: "out",
    kind: kind === "codigo" ? "codigo" : kind,
    template: r.template,
    status: r.status,
    provider_message_id: r.providerMessageId,
    ref_key: refKey,
    body: r.body,
    error: r.error,
  });
  if (error) console.error("[vyz] whatsapp registro", error);
}

/** O workspace tem plano com relatórios no WhatsApp (e assinatura ativa)? */
export async function workspaceAllowsWhatsapp(db: DB, workspaceId: string): Promise<boolean> {
  const { data } = await db.from("workspace_access").select("pages_plan_id, has_access").eq("workspace_id", workspaceId).maybeSingle();
  return planAllowsWhatsapp(data);
}

/** Inscrição apta a receber agora (verificada, sem PARAR, sem pausa, com o relatório escolhido). */
export const wants = (s: Subscription, kind: ReportKind) => !!s.verified_at && !s.opted_out_at && !s.paused && s.reports.includes(kind);

export class ReportContext {
  private insights = new Map<string, Promise<Loaded | null>>();
  private names = new Map<string, Promise<string>>();
  constructor(readonly db: DB) {}
  private scopes = new Map<string, Promise<string[] | null>>();
  /** Workspaces (projetos) que a pessoa acessa: ela só recebe o que vê no painel. */
  scope(workspaceId: string, userId: string) {
    const key = `${workspaceId}:${userId}`;
    if (!this.scopes.has(key)) this.scopes.set(key, userProjectIds(this.db, workspaceId, userId).catch(() => []));
    return this.scopes.get(key)!;
  }
  async loadInsights(workspaceId: string, userId: string) {
    const ids = await this.scope(workspaceId, userId);
    const key = `${workspaceId}:${ids ? [...ids].sort().join(",") : "*"}`;
    if (!this.insights.has(key)) this.insights.set(key, loadWorkspaceInsights(this.db, workspaceId, "7d", 10, ids).catch(() => null));
    return this.insights.get(key)!;
  }
  workspaceName(workspaceId: string) {
    if (!this.names.has(workspaceId)) this.names.set(workspaceId, Promise.resolve(this.db.from("workspaces").select("name").eq("id", workspaceId).maybeSingle()).then((r) => r.data?.name ?? "sua organização"));
    return this.names.get(workspaceId)!;
  }
  async firstName(userId: string) {
    const { data } = await this.db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    return data?.full_name ?? "";
  }
  async accounts(workspaceId: string, userId: string): Promise<Record<string, number>> {
    const ids = await this.scope(workspaceId, userId);
    if (ids && !ids.length) return {};
    let q = this.db.from("ad_accounts").select("platform_id").eq("workspace_id", workspaceId).eq("is_enabled", true);
    if (ids) q = q.in("project_id", ids);
    const { data } = await q;
    const out: Record<string, number> = {};
    for (const a of data ?? []) out[a.platform_id] = (out[a.platform_id] ?? 0) + 1;
    return out;
  }
}

/**
 * Envia um relatório (boas-vindas, diário ou semanal) para uma inscrição.
 * "teste" usa o template do diário (ou o de boas-vindas, sem destaque).
 * null = nada a dizer (sem dados), não envia.
 */
export async function sendReport(ctx: ReportContext, sub: Subscription, kind: "boas-vindas" | "diario" | "semanal" | "teste"): Promise<SendResult | null> {
  const [loaded, workspaceName, firstName] = await Promise.all([ctx.loadInsights(sub.workspace_id, sub.user_id), ctx.workspaceName(sub.workspace_id), ctx.firstName(sub.user_id)]);
  const input = { firstName, workspaceName, insights: loaded?.insights ?? [], pulse: loaded?.pulse ?? [] };
  let template: TemplateId;
  let params: string[] | null;
  if (kind === "diario" || kind === "teste") {
    template = "diario";
    params = dailyParams(input);
    if (!params && kind === "teste") {
      template = "boas-vindas";
      params = welcomeParams(input, await ctx.accounts(sub.workspace_id, sub.user_id));
    }
  } else if (kind === "semanal") {
    template = "semanal";
    params = weeklyParams(input);
  } else {
    template = "boas-vindas";
    params = welcomeParams(input, await ctx.accounts(sub.workspace_id, sub.user_id));
  }
  if (!params) return null;
  const r = await sendTemplate(sub.phone, template, params);
  await recordOut(ctx.db, sub.id, kind, r);
  if (kind === "boas-vindas" && r.status !== "failed") await ctx.db.from("whatsapp_subscriptions").update({ welcome_sent_at: new Date().toISOString() }).eq("id", sub.id);
  return r;
}

/** Alertas novos para a inscrição, respeitando o limite (2 por dia, sem repetir a mesma chave em 24 h). */
export async function sendAlerts(ctx: ReportContext, sub: Subscription, now = Date.now()): Promise<number> {
  const loaded = await ctx.loadInsights(sub.workspace_id, sub.user_id);
  const candidates: Insight[] = loaded?.insights ?? [];
  if (!candidates.length) return 0;
  const since = new Date(now - 86_400_000).toISOString();
  const { data: sent } = await ctx.db.from("whatsapp_messages").select("ref_key, created_at").eq("subscription_id", sub.id).eq("kind", "alertas").neq("status", "failed").gte("created_at", since);
  const picked = pickAlerts(candidates, (sent ?? []).map((s) => ({ refKey: s.ref_key, createdAt: s.created_at })), now);
  const workspaceName = await ctx.workspaceName(sub.workspace_id);
  let n = 0;
  for (const i of picked) {
    const r = await sendTemplate(sub.phone, "alertas", alertParams(workspaceName, i));
    await recordOut(ctx.db, sub.id, "alertas", r, alertKey(i));
    if (r.status !== "failed") n++;
  }
  return n;
}
