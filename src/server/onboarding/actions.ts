"use server";

// Primeiro acesso (/comecar). Cada passo grava no banco com a sessão de quem
// está logado (RLS: só admin edita o workspace) e volta para /comecar, que lê o
// passo do banco: recarregar (ou voltar do login da Meta e do Google) continua
// no mesmo passo. "Pular por agora" conclui o primeiro acesso de qualquer passo,
// sem criar nada: o que faltou fica pendente na Início.

import { updateTag } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { businessType } from "@/features/catalog/business-types";
import { allowedPages, canBuildDashboard, canGoBackTo, isActiveStep, layoutProviders, STEP_TO_DB, activeStepOf, stepIndex, type ActiveStep } from "@/features/onboarding/steps";
import { canUse, TIER_LABEL } from "@/features/pricing/entitlements";
import { composePages } from "@/features/templates/dashboards/composed";
import { CORE_PROVIDER_IDS } from "@/features/integrations/providers";
import { anyDashboardTemplate, REAL_DATA_PLATFORMS } from "@/features/templates/live";
import type { OnboardingStep, WorkspaceSession } from "@/features/workspace/session";
import { authorize } from "@/server/auth/workspace";
import { dashboardTag } from "@/server/analytics/queries";
import { logActivity } from "@/server/history/log";
import { appError, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

const HOME = "/comecar";

/** Admin com plano ativo e primeiro acesso em andamento, já no passo `from` (ou depois). */
async function onboardingSession(from: ActiveStep = "welcome"): Promise<WorkspaceSession> {
  const session = await authorize("admin");
  if (session.workspace.onboardingStep === "done") redirect("/painel");
  if (stepIndex(activeStepOf(session.workspace.onboardingStep)) < stepIndex(from)) throw appError("onboarding:step");
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

/** Passo 1 → 2: das boas-vindas para o projeto. */
export async function startOnboarding(): Promise<ActionResult> {
  try {
    const session = await onboardingSession("welcome");
    await saveStep(session.workspace.id, STEP_TO_DB.project);
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "onboarding.started" });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(HOME);
}

const ProjectInput = z.object({
  name: z.string().trim().min(1, "Dê um nome ao workspace.").max(80, "Até 80 caracteres."),
  businessTypeId: z.string().max(40),
});

/**
 * Passo 2: o primeiro projeto (nome do cliente) e o segmento. Se o workspace já
 * tem um projeto (refazer o primeiro acesso), ele é reaproveitado e só muda de
 * nome: nunca cria um segundo projeto aqui.
 */
export async function saveFirstProject(name: string, businessTypeId: string): Promise<ActionResult> {
  try {
    const parsed = ProjectInput.safeParse({ name, businessTypeId });
    if (!parsed.success) throw appError("validation", parsed.error.issues[0]?.message);
    const type = businessType(parsed.data.businessTypeId);
    if (!type?.available) throw appError("onboarding:business_unavailable");
    const session = await onboardingSession("project");
    const workspaceId = session.workspace.id;
    const supabase = await createServerSupabase();
    const [existing] = unwrap(await supabase.from("projects").select("id, name").eq("workspace_id", workspaceId).is("archived_at", null).order("created_at").limit(1)) ?? [];
    const clean = parsed.data.name;
    if (existing) {
      if (existing.name !== clean) {
        const res = await supabase.from("projects").update({ name: clean }).eq("id", existing.id).eq("workspace_id", workspaceId);
        if (res.error?.code === "23505") throw appError("conflict", "Já existe um workspace com esse nome.");
        unwrap(res);
        await logActivity({ workspaceId, actorId: session.user.id, event: "project.renamed", entityType: "project", entityId: existing.id, metadata: { name: clean, source: "onboarding" } });
      }
    } else {
      const res = await supabase.from("projects").insert({ workspace_id: workspaceId, name: clean, created_by: session.user.id }).select("id").single();
      if (res.error?.code === "23505") throw appError("conflict", "Já existe um workspace com esse nome.");
      const row = unwrap(res);
      await logActivity({ workspaceId, actorId: session.user.id, event: "project.created", entityType: "project", entityId: row?.id ?? null, metadata: { source: "onboarding" } });
    }
    await saveStep(workspaceId, STEP_TO_DB.connect, { business_type_id: type.id });
    await logActivity({ workspaceId, actorId: session.user.id, event: "onboarding.business_chosen", metadata: { business_type_id: type.id } });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(HOME);
}

/** Passo 3 → 4: só com alguma plataforma conectada (sem nenhuma, a saída é pular). */
export async function continueToSetup(): Promise<ActionResult> {
  try {
    const session = await onboardingSession("connect");
    // só a conexão ativa da Meta ou do Google (leve: as contas e o resto vêm na página do passo)
    const supabase = await createServerSupabase();
    const active = unwrap(await supabase.from("connections").select("id").eq("workspace_id", session.workspace.id).eq("status", "active").in("provider", [...CORE_PROVIDER_IDS]).limit(1)) ?? [];
    if (!active.length) throw appError("onboarding:no_connection");
    await saveStep(session.workspace.id, STEP_TO_DB.setup);
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "onboarding.connected" });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(HOME);
}

/**
 * O dashboard de um primeiro acesso anterior do mesmo projeto, com o mesmo modelo (refazer o primeiro
 * acesso, ou sair no meio da tela "Montando"): é reaproveitado em vez de criar outro. O modelo de um
 * dashboard não muda depois de criado; com outro modelo escolhido, sai um dashboard novo.
 */
async function priorOnboardingDashboard(supabase: Awaited<ReturnType<typeof createServerSupabase>>, workspaceId: string, projectId: string | null, templateId: string): Promise<string | null> {
  if (!projectId) return null;
  const events =
    unwrap(await supabase.from("activity_events").select("entity_id").eq("workspace_id", workspaceId).eq("event", "dashboard.created").eq("metadata->>source", "onboarding").order("created_at", { ascending: false }).limit(20)) ?? [];
  const ids = [...new Set(events.map((e) => e.entity_id).filter((v): v is string => !!v))];
  if (!ids.length) return null;
  const [d] =
    unwrap(await supabase.from("dashboards").select("id").eq("workspace_id", workspaceId).in("id", ids).eq("project_id", projectId).eq("template_id", templateId).order("created_at", { ascending: false }).limit(1)) ?? [];
  return d?.id ?? null;
}

/**
 * Passo 4 → "Montando seu dashboard…" (fase 1): cria o dashboard do modelo
 * escolhido já com as contas ativas (do projeto da primeira conta). Não conclui
 * o primeiro acesso: assim a página não é redesenhada no meio da montagem (uma
 * ação que renova o cookie da sessão redesenha a página atual). Sem conta
 * ativa, não cria nada. Devolve o id; finishFirstAccess conclui e abre.
 */
export async function buildFirstDashboard(templateId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = z.string().max(60).safeParse(templateId);
    const template = parsed.success ? anyDashboardTemplate(parsed.data) : undefined;
    if (!template) throw appError("dashboard:template_unavailable");
    const session = await onboardingSession("setup");
    if (!canUse(session.access.tier ?? "base", template.tier)) throw appError("plan:template", `Este modelo é do ${TIER_LABEL[template.tier]}. Faça upgrade para usar.`);
    const workspaceId = session.workspace.id;
    const supabase = await createServerSupabase();
    const platforms = (template.sources as readonly string[]).filter((p) => REAL_DATA_PLATFORMS.includes(p));
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
    if (!canBuildDashboard(sources.length)) throw appError("onboarding:no_accounts");

    const used = [...new Set(sources.map((a) => a.platform_id as string))];
    const open = allowedPages(template, session.access.entitlements?.pages ?? null);
    const pages = (template.composed ? composePages(used) : open).filter((p) => open.includes(p));
    if (pages.length === 0) throw appError("dashboard:no_pages");
    const [projectRow] = project ? (unwrap(await supabase.from("projects").select("name").eq("id", project).limit(1)) ?? []) : [];

    // primeiro acesso refeito (ou interrompido): o mesmo dashboard, com as contas e as páginas de agora
    const prior = await priorOnboardingDashboard(supabase, workspaceId, project, template.id);
    if (prior) {
      unwrap(await supabase.rpc("set_dashboard_sources", { p_dashboard_id: prior, p_ad_account_ids: sources.map((a) => a.id) }));
      unwrap(await supabase.rpc("set_dashboard_pages", { p_dashboard_id: prior, p_page_type_ids: pages }));
      unwrap(await supabase.from("dashboards").update({ client_name: projectRow?.name ?? session.workspace.name }).eq("id", prior));
      // contas trocadas: a próxima leitura do dashboard já vem com elas
      updateTag(dashboardTag(prior));
      await logActivity({ workspaceId, actorId: session.user.id, event: "dashboard.updated", entityType: "dashboard", entityId: prior, metadata: { template_id: template.id, pages, accounts: sources.length, source: "onboarding_reused" } });
      return { ok: true, data: { id: prior } };
    }

    const id = unwrap(
      await supabase.rpc("create_dashboard", {
        p_workspace_id: workspaceId,
        p_template_id: template.id,
        p_name: template.name,
        p_client_name: projectRow?.name ?? session.workspace.name,
        p_settings: {},
        p_page_type_ids: pages,
        p_ad_account_ids: sources.map((a) => a.id),
      }),
    );
    if (!id) throw appError("unknown");
    // as plataformas do modelo (a Início e as telas de conectar leem daqui)
    const chosen = layoutProviders(template);
    unwrap(await supabase.from("workspace_platforms").delete().eq("workspace_id", workspaceId));
    if (chosen.length) unwrap(await supabase.from("workspace_platforms").insert(chosen.map((platform_id) => ({ workspace_id: workspaceId, platform_id }))));

    await logActivity({ workspaceId, actorId: session.user.id, event: "dashboard.created", entityType: "dashboard", entityId: id, metadata: { template_id: template.id, pages, accounts: sources.length, source: "onboarding" } });
    return { ok: true, data: { id } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Fase 2, depois da tela "Montando": conclui o primeiro acesso e abre o dashboard com o tour. */
export async function finishFirstAccess(dashboardId: string): Promise<ActionResult> {
  let target = "/painel";
  try {
    if (!z.uuid().safeParse(dashboardId).success) throw appError("dashboard:not_found");
    const session = await onboardingSession("setup");
    const supabase = await createServerSupabase();
    const [d] = unwrap(await supabase.from("dashboards").select("id, sources:dashboard_sources(ad_account_id)").eq("id", dashboardId).eq("workspace_id", session.workspace.id).limit(1)) ?? [];
    if (!d) throw appError("dashboard:not_found");
    await saveStep(session.workspace.id, "done");
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "onboarding.completed", metadata: { dashboards: 1, accounts: (d.sources ?? []).length } });
    target = `/painel/dashboards/${d.id}?tour=1`;
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(target);
}

/** "Pular por agora": conclui o primeiro acesso sem criar nada. O que faltou fica pendente na Início. */
export async function skipOnboarding(from: string): Promise<ActionResult> {
  try {
    const step = isActiveStep(from) ? from : "welcome";
    const session = await onboardingSession();
    await saveStep(session.workspace.id, "done");
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "onboarding.skipped", metadata: { step } });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect("/painel");
}

/** Volta a um passo anterior (o que já foi gravado continua lá). */
export async function goToStep(step: string): Promise<ActionResult> {
  try {
    const session = await onboardingSession();
    const current = activeStepOf(session.workspace.onboardingStep);
    if (!canGoBackTo(current, step)) throw appError("validation");
    await saveStep(session.workspace.id, STEP_TO_DB[step]);
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "onboarding.step_back", metadata: { step } });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(HOME);
}
