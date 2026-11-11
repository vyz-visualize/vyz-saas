"use server";

// Passos do onboarding (/comecar). Cada passo grava no banco com a sessão de
// quem está logado (RLS: só admin edita o workspace e as plataformas) e volta
// para /comecar, que lê o passo do banco: recarregar continua de onde parou.

import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { businessType } from "@/features/catalog/business-types";
import { allowedPages, canGoBackTo, layoutProviders, stepIndex, type ActiveStep } from "@/features/onboarding/steps";
import { canUse, TIER_LABEL } from "@/features/pricing/entitlements";
import { anyDashboardTemplate } from "@/features/templates/live";
import type { OnboardingStep, WorkspaceSession } from "@/features/workspace/session";
import { authorize } from "@/server/auth/workspace";
import { logActivity } from "@/server/history/log";
import { appError, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

const HOME = "/comecar";

/** Admin com plano ativo e onboarding em andamento, já no passo `from` (ou depois). */
async function onboardingSession(from: ActiveStep = "business"): Promise<WorkspaceSession> {
  const session = await authorize("admin");
  if (session.workspace.onboardingStep === "done") redirect("/painel");
  if (stepIndex(session.workspace.onboardingStep) < stepIndex(from)) throw appError("onboarding:step", "Este passo ainda não chegou. Recarregue a página.");
  return session;
}

async function saveStep(workspaceId: string, step: OnboardingStep, extra: { business_type_id?: string } = {}) {
  const supabase = await createServerSupabase();
  unwrap(
    await supabase
      .from("workspaces")
      .update({ ...extra, onboarding_step: step, onboarding_completed_at: step === "done" ? new Date().toISOString() : null })
      .eq("id", workspaceId),
  );
}

/** Passo 1: o nicho. */
export async function chooseBusiness(businessTypeId: string): Promise<ActionResult> {
  try {
    const parsed = z.string().max(40).safeParse(businessTypeId);
    const type = parsed.success ? businessType(parsed.data) : undefined;
    if (!type) throw appError("validation");
    const session = await onboardingSession();
    await saveStep(session.workspace.id, "platforms", { business_type_id: type.id });
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "onboarding.business_chosen", metadata: { business_type_id: type.id } });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(HOME);
}

/**
 * Passo 2: o layout. Cria o dashboard (sem contas ainda) com as páginas que o
 * plano libera e grava as plataformas que ele usa para o passo de conectar.
 * Trocar de layout apaga o dashboard escolhido antes (ainda sem contas).
 */
export async function chooseLayout(templateId: string): Promise<ActionResult> {
  try {
    const parsed = z.string().max(60).safeParse(templateId);
    const template = parsed.success ? anyDashboardTemplate(parsed.data) : undefined;
    if (!template) throw appError("dashboard:template_unavailable");
    const session = await onboardingSession("platforms");
    if (!canUse(session.access.tier ?? "base", template.tier)) throw appError("plan:template", `Este layout é do ${TIER_LABEL[template.tier]}. Faça upgrade para usar.`);
    const pages = allowedPages(template, session.access.entitlements?.pages ?? null);
    if (pages.length === 0) throw appError("dashboard:no_pages");

    const supabase = await createServerSupabase();
    const workspaceId = session.workspace.id;
    await dropDraftDashboards(workspaceId, session.user.id);
    const id = unwrap(
      await supabase.rpc("create_dashboard", {
        p_workspace_id: workspaceId,
        p_template_id: template.id,
        p_name: template.name,
        p_client_name: session.workspace.name,
        p_settings: {},
        p_page_type_ids: pages,
        p_ad_account_ids: [],
      }),
    );
    if (!id) throw appError("unknown");

    const chosen = layoutProviders(template);
    unwrap(await supabase.from("workspace_platforms").delete().eq("workspace_id", workspaceId));
    if (chosen.length) unwrap(await supabase.from("workspace_platforms").insert(chosen.map((platform_id) => ({ workspace_id: workspaceId, platform_id }))));
    await logActivity({ workspaceId, actorId: session.user.id, event: "dashboard.created", entityType: "dashboard", entityId: id, metadata: { template_id: template.id, pages, source: "onboarding" } });
    await saveStep(workspaceId, "connect");
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(HOME);
}

/** Dashboards do onboarding ainda sem contas (o layout escolhido antes de trocar). */
async function dropDraftDashboards(workspaceId: string, userId: string) {
  const supabase = await createServerSupabase();
  const rows = unwrap(await supabase.from("dashboards").select("id, sources:dashboard_sources(ad_account_id)").eq("workspace_id", workspaceId).eq("created_by", userId)) ?? [];
  const drafts = rows.filter((r) => (r.sources ?? []).length === 0).map((r) => r.id);
  if (drafts.length) unwrap(await supabase.from("dashboards").delete().in("id", drafts));
}

/** Volta a um passo anterior (o que já foi gravado continua lá). */
export async function goToStep(step: string): Promise<ActionResult> {
  try {
    const parsed = z.enum(["business", "platforms"]).safeParse(step);
    if (!parsed.success) throw appError("validation");
    const session = await onboardingSession();
    if (!canGoBackTo(session.workspace.onboardingStep, parsed.data)) throw appError("validation");
    await saveStep(session.workspace.id, parsed.data);
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "onboarding.step_back", metadata: { step: parsed.data } });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(HOME);
}

/**
 * Passo 3 → fim: liga ao dashboard do layout as contas ativas das plataformas
 * dele (pode não haver nenhuma: conectar fica para depois), conclui o
 * onboarding e abre o dashboard.
 */
export async function finishOnboarding(): Promise<ActionResult> {
  let target = "/painel";
  try {
    const session = await onboardingSession("connect");
    const workspaceId = session.workspace.id;
    const supabase = await createServerSupabase();
    const [dashboard] =
      unwrap(await supabase.from("dashboards").select("id, template_id").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(1)) ?? [];
    let linked = 0;
    if (dashboard) {
      const template = anyDashboardTemplate(dashboard.template_id);
      const platforms = (template?.sources ?? []) as string[];
      const accounts =
        unwrap(
          await supabase
            .from("ad_accounts")
            .select("id, platform_id, project_id")
            .eq("workspace_id", workspaceId)
            .eq("is_enabled", true)
            .not("connection_id", "is", null)
            .in("platform_id", platforms.length ? platforms : ["_"])
            .order("created_at"),
        ) ?? [];
      // o dashboard é de um projeto só: o da primeira conta
      const project = accounts[0]?.project_id ?? null;
      const sources = accounts.filter((a) => a.project_id === project);
      const existing = unwrap(await supabase.from("dashboard_sources").select("ad_account_id").eq("dashboard_id", dashboard.id)) ?? [];
      const add = sources.filter((a) => !existing.some((e) => e.ad_account_id === a.id));
      for (const a of add) unwrap(await supabase.from("dashboard_sources").insert({ workspace_id: workspaceId, dashboard_id: dashboard.id, ad_account_id: a.id }));
      linked = add.length + existing.length;
      target = `/painel/dashboards/${dashboard.id}?novo=1`;
    }
    await saveStep(workspaceId, "done");
    await logActivity({ workspaceId, actorId: session.user.id, event: "onboarding.completed", metadata: { dashboards: dashboard ? 1 : 0, accounts: linked } });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(target);
}
