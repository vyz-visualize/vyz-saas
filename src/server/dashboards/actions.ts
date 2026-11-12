"use server";

// Ações de dashboard (Server Actions): criar, editar, duplicar, apagar e
// registrar a exportação. O plano e o papel são conferidos aqui para a mensagem
// sair cedo e de novo no banco (RLS e gatilhos: limit:dashboards, plan:page,
// plan:template, plan:white_label, dashboard:source_disabled). Tudo com a
// sessão de quem pede; nada aqui precisa da chave de serviço.

import { showsSampleData } from "@/features/dashboards/sample-gate";
import { refresh, updateTag } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { catalogForTemplate } from "@/features/dashboards/data";
import { pageRules } from "@/features/dashboards/layout/page-rules";
import { canArrangeLayout, kindOf, normalizeGrid, withMetricCards, type DashboardLayout } from "@/features/dashboards/layout/model";
import type { PageId } from "@/features/templates/types";
import { normalizeScope, withScope, type MetricScope, type ScopePrefs } from "@/features/dashboards/metric-prefs";
import { allowedPages, copyName, defaultPages, settingsToDb, type DashboardDetail } from "@/features/dashboards/model";
import { createDashboardSchema, dashboardFieldsSchema, type CreateDashboardInput, type DashboardFields } from "@/features/dashboards/schema";
import { canUse } from "@/features/pricing/entitlements";
import type { Json } from "@/lib/supabase/database.types";
import { isImportPlatform } from "@/features/accounts/connection-modes";
import { isCrmSyncPlatform } from "@/features/sync/crm";
import { anyDashboardTemplate, REAL_DATA_PLATFORMS, usesAccounts } from "@/features/templates/live";
import type { DashboardTemplate } from "@/features/templates/types";
import type { WorkspaceSession } from "@/features/workspace/session";
import { dashboardTag } from "@/server/analytics/queries";
import { authorize } from "@/server/auth/workspace";
import { logActivity } from "@/server/history/log";
import { appError, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase, type DB } from "@/server/supabase/server";
import { parseMetricGoals } from "@/features/dashboards/goals";
import { getDashboard } from "./queries";

const Id = z.uuid();

function fieldErrors(issues: z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    out[key] ??= i.message;
  }
  return out;
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) throw appError("validation", undefined, fieldErrors(r.error.issues));
  return r.data;
}

function templateFor(id: string, session: WorkspaceSession): DashboardTemplate {
  const t = anyDashboardTemplate(id);
  if (!t) throw appError("dashboard:template_unavailable");
  if (!canUse(session.access.tier ?? "base", t.tier)) throw appError("plan:template");
  return t;
}

/** Páginas pedidas que o plano libera; se nenhuma vale, explica o porquê. */
function pagesFor(t: DashboardTemplate, session: WorkspaceSession, asked: readonly string[]) {
  const pages = allowedPages(t, session.access.entitlements?.pages ?? "base", asked);
  if (pages.length === 0) throw appError("dashboard:no_pages", "Escolha pelo menos uma página liberada no seu plano.");
  if (pages.length < new Set(asked).size) throw appError("plan:page");
  return pages;
}

/**
 * Contas de um dashboard com dados reais, conferidas no banco: do workspace, da
 * plataforma do template e ativas. As que já estavam ligadas (keep) podem ficar
 * mesmo desativadas: o histórico continua visível.
 */
async function sourcesFor(db: DB, session: WorkspaceSession, t: DashboardTemplate, ids: readonly string[], keep: readonly string[] = []): Promise<string[]> {
  if (!usesAccounts(t)) return [];
  const unique = [...new Set(ids)];
  // as contas são opcionais: sem conta, o dashboard mostra a amostra
  if (unique.length === 0) return [];
  const rows = unwrap(await db.from("ad_accounts").select("id, name, platform_id, is_enabled").eq("workspace_id", session.workspace.id).in("id", unique)) ?? [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of unique) {
    const a = byId.get(id);
    if (!a || !(t.sources.includes(a.platform_id as never) || isImportPlatform(a.platform_id) || isCrmSyncPlatform(a.platform_id))) throw appError("dashboard:source_platform");
    if (!(REAL_DATA_PLATFORMS as readonly string[]).includes(a.platform_id)) throw appError("dashboard:source_platform");
    if (!a.is_enabled && !keep.includes(id)) throw appError("dashboard:source_disabled", `Ative a conta “${a.name}” em Contas antes de usá-la num dashboard.`);
  }
  return unique;
}

/** Marca própria só no Personalizado; tirar a marca nunca exige plano. */
function brandFor(session: WorkspaceSession, f: Pick<DashboardFields, "brandColor" | "hideVyz">) {
  const wants = !!f.brandColor || f.hideVyz;
  if (wants && !session.access.entitlements?.whiteLabel) throw appError("plan:white_label");
  return { brand_color: f.brandColor, hide_vyz_brand: f.hideVyz };
}

async function insertDashboard(db: DB, session: WorkspaceSession, input: { templateId: string; name: string; client: string; pages: string[]; accountIds: string[]; settings: ReturnType<typeof settingsToDb> }): Promise<string> {
  const id = unwrap(
    await db.rpc("create_dashboard", {
      p_workspace_id: session.workspace.id,
      p_template_id: input.templateId,
      p_name: input.name,
      p_client_name: input.client,
      p_settings: input.settings,
      p_page_type_ids: input.pages,
      p_ad_account_ids: input.accountIds,
    }),
  );
  if (!id) throw appError("unknown");
  return id;
}

/** Cria o dashboard (member) e abre. Erros de plano e limite voltam com a mensagem do banco. */
export async function createDashboard(input: CreateDashboardInput): Promise<ActionResult<{ id: string }>> {
  let id: string;
  try {
    const data = parse(createDashboardSchema, input);
    const session = await authorize("member");
    const t = templateFor(data.templateId, session);
    const pages = pagesFor(t, session, data.pages);
    const db = await createServerSupabase();
    const accountIds = await sourcesFor(db, session, t, data.accountIds);
    const brand = brandFor(session, data);

    id = await insertDashboard(db, session, { templateId: t.id, name: data.name, client: data.client, pages, accountIds, settings: settingsToDb(data, data.margin) });
    // create_dashboard não recebe a marca: só grava quando há (Personalizado)
    if (brand.brand_color || brand.hide_vyz_brand) unwrap(await db.from("dashboards").update(brand).eq("id", id));

    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "dashboard.created", entityType: "dashboard", entityId: id, metadata: { template: t.id, pages, accounts: accountIds.length } });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(`/painel/dashboards/${id}?novo=1`);
}

/** Edita nome, cliente, metas, período, páginas e contas (member). */
export async function updateDashboard(dashboardId: string, input: DashboardFields): Promise<ActionResult> {
  try {
    if (!Id.safeParse(dashboardId).success) throw appError("dashboard:not_found");
    const data = parse(dashboardFieldsSchema, input);
    const session = await authorize("member");
    const current = await getDashboard(dashboardId);
    if (!current) throw appError("dashboard:not_found");
    const t = anyDashboardTemplate(current.templateId);
    if (!t) throw appError("dashboard:template_unavailable");
    // páginas iguais ficam como estão (mesmo as de um plano anterior); trocar passa pelas regras
    const samePages = data.pages.join() === current.pages.join();
    const pages = samePages ? current.pages : pagesFor(t, session, data.pages);
    const db = await createServerSupabase();
    const accountIds = await sourcesFor(
      db,
      session,
      t,
      data.accountIds,
      current.sources.map((s) => s.id),
    );

    // Marca: só muda o que mudou (o gatilho do plano olha a marca nova)
    const brandChanged = (data.brandColor ?? null) !== (current.brand?.color || null) || data.hideVyz !== !!current.brand?.hideVyz;
    const brand = brandChanged ? brandFor(session, data) : {};
    // metas por métrica: só quando o editor manda (uma por métrica)
    const goals = data.metricGoals ? { metric_goals: parseMetricGoals(data.metricGoals) as Json } : {};
    unwrap(
      await db
        .from("dashboards")
        .update({ name: data.name, client_name: data.client, ...settingsToDb(data, data.margin), ...brand, ...goals })
        .eq("id", dashboardId),
    );
    // Páginas e contas são trocas atômicas em funções próprias (cada uma numa transação)
    if (!samePages) unwrap(await db.rpc("set_dashboard_pages", { p_dashboard_id: dashboardId, p_page_type_ids: pages }));
    const before = current.sources.map((s) => s.id).sort();
    if (usesAccounts(t) && [...accountIds].sort().join() !== before.join()) {
      unwrap(await db.rpc("set_dashboard_sources", { p_dashboard_id: dashboardId, p_ad_account_ids: accountIds }));
    }
    // margem e contas mudam o que o dashboard lê: o próximo acesso já vem novo
    updateTag(dashboardTag(dashboardId));
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "dashboard.updated", entityType: "dashboard", entityId: dashboardId, metadata: { pages_changed: !samePages, brand_changed: brandChanged, accounts: accountIds.length, goals: data.metricGoals?.length ?? null } });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(`/painel/dashboards/${dashboardId}`);
}

/** Salva as métricas escolhidas de uma plataforma do dashboard (member). Vale em todos os planos. */
export async function saveDashboardMetricPrefs(dashboardId: string, scope: MetricScope, value: ScopePrefs): Promise<ActionResult> {
  try {
    if (!Id.safeParse(dashboardId).success) throw appError("dashboard:not_found");
    const session = await authorize("member", { access: false });
    const current = await getDashboard(dashboardId);
    if (!current) throw appError("dashboard:not_found");
    const t = anyDashboardTemplate(current.templateId);
    if (!t) throw appError("dashboard:template_unavailable");
    const catalog = catalogForTemplate(t, current.pages);
    if (scope !== catalog.scope) throw appError("validation");
    const clean = normalizeScope(catalog.metrics, value, catalog.pageKpis);
    const db = await createServerSupabase();
    const next = withScope(current.metricPrefs, scope, clean);
    unwrap(await db.from("dashboards").update({ metric_prefs: next as Json }).eq("id", dashboardId));
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "dashboard.metrics_changed", entityType: "dashboard", entityId: dashboardId, metadata: { scope } });
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Disposição de uma aba (member+). null = volta para a do template. Só dashboards de exemplo. */
export async function saveDashboardLayout(dashboardId: string, page: string, items: unknown): Promise<ActionResult> {
  try {
    if (!Id.safeParse(dashboardId).success) throw appError("dashboard:not_found");
    const session = await authorize("member", { access: false });
    const arrange = canArrangeLayout(session.access.tier);
    const current = await getDashboard(dashboardId);
    if (!current) throw appError("dashboard:not_found");
    const t = anyDashboardTemplate(current.templateId);
    if (!t) throw appError("dashboard:template_unavailable");
    if (current.live || !current.pages.includes(page as PageId)) throw appError("validation");
    const pageId = page as PageId;
    const next: DashboardLayout = { ...current.layout };
    if (items == null) delete next[pageId];
    else {
      const rules = pageRules(t, pageId);
      const valid = normalizeGrid(items, rules.accept, 1);
      // fora do Avançado não se mexe na disposição: o modelo do template e os cards de plataforma no próximo espaço livre
      const clean = arrange ? valid : withMetricCards(rules.base(), valid.filter((i) => kindOf(i.id) === "metric").map((i) => i.id));
      if (clean.length === 0) throw appError("validation", "A aba precisa de pelo menos um bloco.");
      next[pageId] = clean;
    }
    const db = await createServerSupabase();
    unwrap(await db.from("dashboards").update({ layout: next as Json }).eq("id", dashboardId));
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: items == null ? "dashboard.layout_reset" : "dashboard.layout_changed", entityType: "dashboard", entityId: dashboardId, metadata: { page: pageId, blocks: next[pageId]?.length ?? 0 } });
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Duplica com as páginas e contas que ainda valem (member). Conta no limite do plano. */
export async function duplicateDashboard(dashboardId: string): Promise<ActionResult> {
  let id: string;
  try {
    if (!Id.safeParse(dashboardId).success) throw appError("dashboard:not_found");
    const session = await authorize("member");
    const d: DashboardDetail | null = await getDashboard(dashboardId);
    if (!d) throw appError("dashboard:not_found");
    const t = templateFor(d.templateId, session);
    const pagesTier = session.access.entitlements?.pages ?? "base";
    const kept = allowedPages(t, pagesTier, d.pages);
    const pages = kept.length ? kept : defaultPages(t, pagesTier);
    if (pages.length === 0) throw appError("dashboard:no_pages");
    const accountIds = d.sources.filter((s) => s.isEnabled).map((s) => s.id);

    const db = await createServerSupabase();
    id = await insertDashboard(db, session, { templateId: t.id, name: copyName(d.name), client: d.client, pages, accountIds, settings: settingsToDb(d.settings, d.margin) });
    // a cópia mantém as métricas escolhidas
    if (Object.keys(d.metricPrefs).length) unwrap(await db.from("dashboards").update({ metric_prefs: d.metricPrefs as Json }).eq("id", id));
    // e a disposição de cada aba
    if (Object.keys(d.layout).length) unwrap(await db.from("dashboards").update({ layout: d.layout as Json }).eq("id", id));
    if (d.brand && session.access.entitlements?.whiteLabel) {
      unwrap(await db.from("dashboards").update({ brand_color: d.brand.color || null, hide_vyz_brand: d.brand.hideVyz }).eq("id", id));
    }
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "dashboard.duplicated", entityType: "dashboard", entityId: id, metadata: { from: d.id } });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(`/painel/dashboards/${id}`);
}

/**
 * Apaga o dashboard (member). Links, agendamentos e páginas vão junto (cascata);
 * o histórico de exportações e envios fica, com o nome.
 */
export async function deleteDashboard(dashboardId: string): Promise<ActionResult> {
  try {
    if (!Id.safeParse(dashboardId).success) throw appError("dashboard:not_found");
    const session = await authorize("member", { access: false });
    const db = await createServerSupabase();
    const gone = unwrap(await db.from("dashboards").delete().eq("id", dashboardId).eq("workspace_id", session.workspace.id).select("id, name")) ?? [];
    if (gone.length === 0) throw appError("dashboard:not_found");
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "dashboard.deleted", entityType: "dashboard", entityId: dashboardId, metadata: { name: gone[0].name } });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

const ExportInput = z.object({
  dashboardId: Id,
  period: z.string().max(10),
  pages: z.number().int().min(1).max(20),
});

/** Registra a exportação em PDF (o PDF sai da impressão do navegador). */
export async function recordExport(input: { dashboardId: string; period: string; pages: number }): Promise<ActionResult> {
  try {
    const data = parse(ExportInput, input);
    const session = await authorize("member");
    const d = await getDashboard(data.dashboardId);
    if (!d) throw appError("dashboard:not_found");
    // PDF com dados de exemplo não sai: primeiro uma conta ligada
    if (showsSampleData(d)) throw appError("dashboard:sample_only");
    const db = await createServerSupabase();
    unwrap(
      await db.from("dashboard_exports").insert({ workspace_id: session.workspace.id, dashboard_id: d.id, dashboard_name: d.name, kind: "pdf", created_by: session.user.id }),
    );
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "dashboard.exported", entityType: "dashboard", entityId: d.id, metadata: { format: "pdf", period: data.period, pages: data.pages } });
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

const TemplateSearchInput = z.object({
  query: z.string().trim().min(1).max(300),
  via: z.enum(["text", "voice", "example"]),
  suggested: z.array(z.string().max(60)).max(5),
});

/** Registra o pedido feito ao assistente ao criar um dashboard (o que a pessoa procurou e o que foi sugerido). */
export async function recordTemplateSearch(input: { query: string; via: "text" | "voice" | "example"; suggested: string[] }): Promise<ActionResult> {
  try {
    const data = parse(TemplateSearchInput, input);
    const session = await authorize("member", { access: false });
    await logActivity({
      workspaceId: session.workspace.id,
      actorId: session.user.id,
      event: "dashboard.template_search",
      metadata: { query: data.query, via: data.via, suggested: data.suggested.filter((id) => !!anyDashboardTemplate(id)) },
    });
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}
