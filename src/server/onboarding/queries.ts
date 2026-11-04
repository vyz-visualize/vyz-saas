import "server-only";

// Estado do onboarding do workspace aberto, lido do banco com o RLS de quem
// está logado: passo atual, negócio, plataformas escolhidas, plano e (nos
// passo de conectar) as contas conectadas e o layout escolhido.

import type { ProviderId } from "@/features/integrations/providers";
import { activeStepOf, CONNECTABLE } from "@/features/onboarding/steps";
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
export async function getOnboardingState(session: WorkspaceSession): Promise<OnboardingState> {
  const step = activeStepOf(session.workspace.onboardingStep);
  const supabase = await createServerSupabase();
  const [platforms, connect, layout] = await Promise.all([
    loadChosenPlatforms(session.workspace.id),
    step === "connect" ? getConnectState() : Promise.resolve(null),
    step === "connect"
      ? supabase
          .from("dashboards")
          .select("name")
          .eq("workspace_id", session.workspace.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .then((r) => unwrap(r)?.[0]?.name ?? null)
      : Promise.resolve(null),
  ]);
  return {
    step,
    workspaceName: session.workspace.name,
    businessTypeId: session.workspace.businessTypeId,
    platforms,
    layoutName: layout,
    tier: session.access.tier,
    canManage: hasRole(session.role, "admin"),
    connect,
  };
}
