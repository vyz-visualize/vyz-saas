import "server-only";

// Estado do onboarding do workspace aberto, lido do banco com o RLS de quem
// está logado: passo atual, negócio, plataformas escolhidas, plano e (nos
// passo de conectar) as contas conectadas e o layout escolhido.

import type { ProviderId } from "@/features/integrations/providers";
import { CONNECTABLE, featureOptions, screenStep } from "@/features/onboarding/steps";
import { anyDashboardTemplate } from "@/features/templates/live";
import type { OnboardingState } from "@/features/onboarding/types";
import { hasRole, type WorkspaceSession } from "@/features/workspace/session";
import { getConnectState } from "@/server/integrations/queries";
import { unwrap } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

export type { OnboardingState };

/** Plataformas conectáveis gravadas em workspace_platforms. */
export async function loadChosenPlatforms(workspaceId: string): Promise<ProviderId[]> {
  const supabase = await createServerSupabase();
  const rows = unwrap(await supabase.from("workspace_platforms").select("platform_id").eq("workspace_id", workspaceId)) ?? [];
  const ids = new Set(rows.map((r) => r.platform_id));
  return CONNECTABLE.filter((p) => ids.has(p));
}

/** Para a página /comecar (já passou por requireWorkspace e o onboarding não terminou). */
export async function getOnboardingState(session: WorkspaceSession, etapa?: unknown): Promise<OnboardingState> {
  const step = screenStep(session.workspace.onboardingStep, etapa);
  const supabase = await createServerSupabase();
  const late = step === "connect" || step === "finish";
  const [platforms, connect, dashboard] = await Promise.all([
    loadChosenPlatforms(session.workspace.id),
    step === "connect" ? getConnectState() : Promise.resolve(null),
    late
      ? supabase
          .from("dashboards")
          .select("name, template_id")
          .eq("workspace_id", session.workspace.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .then((r) => unwrap(r)?.[0] ?? null)
      : Promise.resolve(null),
  ]);
  const features = step === "finish" ? featureOptions(await connectedPlatforms(session.workspace.id, dashboard?.template_id ?? null), session.access.tier) : null;
  return {
    step,
    workspaceName: session.workspace.name,
    businessTypeId: session.workspace.businessTypeId,
    platforms,
    layoutName: dashboard?.name ?? null,
    tier: session.access.tier,
    canManage: hasRole(session.role, "admin"),
    connect,
    features,
    brand: { color: session.workspace.brandColor, logoUrl: session.workspace.brandLogoUrl ?? null },
  };
}

/** Plataformas do layout com conta ativa (sem nenhuma: as que o layout usa, como no novo dashboard). */
async function connectedPlatforms(workspaceId: string, templateId: string | null): Promise<string[]> {
  const sources = ((templateId ? anyDashboardTemplate(templateId)?.sources : null) ?? []) as string[];
  if (!sources.length) return [];
  const supabase = await createServerSupabase();
  const rows =
    unwrap(await supabase.from("ad_accounts").select("platform_id").eq("workspace_id", workspaceId).eq("is_enabled", true).not("connection_id", "is", null).in("platform_id", sources)) ?? [];
  const used = [...new Set(rows.map((r) => r.platform_id as string))];
  return used.length ? used : sources;
}
