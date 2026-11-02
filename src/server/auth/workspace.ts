import "server-only";

// Camada de acesso (DAL) do workspace: quem é o usuário, em qual workspace
// está, com qual papel, qual plano vale e quanto já usa. Páginas chamam
// requireWorkspace() (redireciona); Server Actions chamam authorize() (lança
// AppError). O RLS do banco repete as mesmas regras: isto aqui é para a
// experiência e para falhar cedo, não a única barreira.

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { parsePlanDbId } from "@/features/pricing/pricing";
import { TIERS, type Entitlements, type Tier } from "@/features/pricing/entitlements";
import { hasRole, type MemberRole, type OnboardingStep, type SubscriptionStatus, type WorkspaceSession } from "@/features/workspace/session";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/supabase/cookies";
import type { Tables } from "@/lib/supabase/database.types";
import { publicAssetUrl } from "@/lib/supabase/storage";
import { appError } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";
import { getSessionUser, type SessionUser } from "./session";

const isTier = (v: unknown): v is Tier => typeof v === "string" && (TIERS as string[]).includes(v);
/** "pro" e "lp_pro" → "pro": o tier é o mesmo nos dois produtos. */
const tierOf = (planId: string | null | undefined): Tier | null => parsePlanDbId(planId)?.tier ?? null;

type WorkspaceRow = Pick<
  Tables<"workspaces">,
  "id" | "name" | "slug" | "business_type_id" | "brand_color" | "brand_logo_path" | "hide_vyz_brand" | "onboarding_step" | "onboarding_completed_at" | "timezone" | "currency" | "product"
>;

export type Viewer = {
  user: SessionUser;
  profile: Pick<Tables<"profiles">, "id" | "email" | "full_name" | "avatar_url" | "default_workspace_id"> | null;
  memberships: { role: MemberRole; workspace: WorkspaceRow }[];
};

/** Usuário logado, perfil e workspaces (sem escolher um). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createServerSupabase();
  const [profile, members] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, avatar_url, default_workspace_id").eq("id", user.id).maybeSingle(),
    supabase
      .from("workspace_members")
      .select("role, workspace:workspaces!inner(id, name, slug, business_type_id, brand_color, brand_logo_path, hide_vyz_brand, onboarding_step, onboarding_completed_at, timezone, currency, product)")
      .eq("user_id", user.id)
      .order("created_at"),
  ]);
  if (profile.error) console.error("[vyz] perfil", profile.error);
  if (members.error) console.error("[vyz] workspaces", members.error);
  return {
    user,
    profile: profile.data ?? null,
    memberships: (members.data ?? []).map((m) => ({ role: m.role, workspace: m.workspace as WorkspaceRow })),
  };
});

function toEntitlements(row: Tables<"workspace_access"> | null): Entitlements | null {
  if (!row?.plan_id || row.max_dashboards == null || row.max_landing_pages == null) return null;
  return {
    dashboardTemplates: row.dashboard_templates ?? 0,
    landingTemplates: row.landing_templates ?? 0,
    platforms: row.platforms === "all" ? "all" : "core",
    pages: isTier(row.pages_plan_id) ? row.pages_plan_id : "base",
    whiteLabel: !!row.white_label,
    audio: row.audio === "soon" ? "soon" : "none",
    customDashboards: !!row.custom_dashboards,
    agentChat: !!row.agent_chat,
    agentVoice: !!row.agent_voice,
    maxDashboards: row.max_dashboards,
    maxLandingPages: row.max_landing_pages,
    maxMembers: row.max_members ?? 1,
  };
}

/** Workspace aberto, com plano e uso. null = sem sessão ou sem workspace. */
export const getWorkspaceSession = cache(async (): Promise<WorkspaceSession | null> => {
  const viewer = await getViewer();
  if (!viewer || viewer.memberships.length === 0) return null;

  const preferred = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const current =
    viewer.memberships.find((m) => m.workspace.id === preferred) ??
    viewer.memberships.find((m) => m.workspace.id === viewer.profile?.default_workspace_id) ??
    viewer.memberships[0];

  const supabase = await createServerSupabase();
  const [access, usage] = await Promise.all([
    supabase.from("workspace_access").select("*").eq("workspace_id", current.workspace.id).maybeSingle(),
    supabase.from("workspace_usage").select("*").eq("workspace_id", current.workspace.id).maybeSingle(),
  ]);
  if (access.error) console.error("[vyz] acesso do workspace", access.error);
  if (usage.error) console.error("[vyz] uso do workspace", usage.error);
  const a = access.data;
  const u = usage.data;
  const w = current.workspace;

  return {
    user: {
      id: viewer.user.id,
      email: viewer.profile?.email || viewer.user.email || "",
      fullName: viewer.profile?.full_name ?? "",
      avatarUrl: viewer.profile?.avatar_url ?? null,
    },
    workspace: {
      id: w.id,
      name: w.name,
      slug: w.slug,
      businessTypeId: w.business_type_id,
      brandColor: w.brand_color,
      brandLogoUrl: publicAssetUrl(w.brand_logo_path),
      hideVyzBrand: w.hide_vyz_brand,
      onboardingStep: w.onboarding_step as OnboardingStep,
      onboardingCompletedAt: w.onboarding_completed_at,
      timezone: w.timezone,
      currency: w.currency,
      product: w.product,
    },
    role: current.role,
    access: {
      hasAccess: !!a?.has_access,
      tier: tierOf(a?.plan_id),
      status: (a?.subscription_status as SubscriptionStatus | null) ?? null,
      interval: a?.interval ?? null,
      accountsQuantity: a?.accounts_quantity ?? 0,
      currentPeriodEnd: a?.current_period_end ?? null,
      cancelAtPeriodEnd: !!a?.cancel_at_period_end,
      entitlements: toEntitlements(a ?? null),
    },
    usage: {
      dashboards: u?.dashboards ?? 0,
      landingPages: u?.landing_pages ?? 0,
      publishedLandingPages: u?.published_landing_pages ?? 0,
      enabledAdAccounts: u?.enabled_ad_accounts ?? 0,
      billableAccounts: u?.billable_accounts ?? 0,
      activeConnections: u?.active_connections ?? 0,
    },
    memberships: viewer.memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name, role: m.role })),
  };
});

export type WorkspaceRequirement = {
  /** Papel mínimo (padrão: viewer). */
  minRole?: MemberRole;
  /** Exige assinatura ativa (padrão: true). */
  access?: boolean;
  /** Exige onboarding concluído (padrão: true). */
  onboarding?: boolean;
  /** Caminho para voltar depois do login. */
  next?: string;
};

/** Para páginas. Redireciona: /entrar, /assinar, /painel/plano ou /comecar. */
export async function requireWorkspace(req: WorkspaceRequirement = {}): Promise<WorkspaceSession> {
  const user = await getSessionUser();
  if (!user) redirect(req.next ? `/entrar?next=${encodeURIComponent(req.next)}` : "/entrar");
  const session = await getWorkspaceSession();
  if (!session) redirect("/assinar");
  if (req.minRole && !hasRole(session.role, req.minRole)) notFound();
  if ((req.access ?? true) && !session.access.hasAccess) redirect("/painel/plano?status=inativo");
  if ((req.onboarding ?? true) && session.workspace.onboardingStep !== "done") redirect("/comecar");
  return session;
}

/** Para Server Actions e Route Handlers. Lança AppError em vez de redirecionar. */
export async function authorize(minRole: MemberRole = "member", opts: { access?: boolean } = {}): Promise<WorkspaceSession> {
  const session = await getWorkspaceSession();
  if (!session) throw appError("auth:required");
  if (!hasRole(session.role, minRole)) throw appError("forbidden");
  if ((opts.access ?? true) && !session.access.hasAccess) throw appError("plan:inactive");
  return session;
}
