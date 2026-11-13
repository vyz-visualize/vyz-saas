import "server-only";

// Estado do primeiro acesso do workspace aberto, lido do banco com o RLS de
// quem está logado: passo atual, segmento, plano, o primeiro projeto e, nos
// passos de conectar e de contas e modelo, as conexões e as contas.

import { activeStepOf, isNamedProject } from "@/features/onboarding/steps";
import type { OnboardingState } from "@/features/onboarding/types";
import { hasRole, type WorkspaceSession } from "@/features/workspace/session";
import { canSeeTestBadges } from "@/server/env";
import { getConnectState } from "@/server/integrations/queries";
import { unwrap } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

export type { OnboardingState };

/** Para a página /comecar (já passou por requireWorkspace e o primeiro acesso não terminou). */
export async function getOnboardingState(session: WorkspaceSession): Promise<OnboardingState> {
  const step = activeStepOf(session.workspace.onboardingStep);
  const supabase = await createServerSupabase();
  const late = step === "connect" || step === "setup";
  const [projects, connect] = await Promise.all([
    supabase.from("projects").select("id, name").eq("workspace_id", session.workspace.id).is("archived_at", null).order("created_at").limit(1),
    late ? getConnectState() : Promise.resolve(null),
  ]);
  const first = unwrap(projects)?.[0] ?? null;
  const project = first ? { ...first, named: isNamedProject(first.name, [session.workspace.name, session.user.fullName]) } : null;
  return {
    step,
    firstName: session.user.fullName.split(" ")[0] ?? "",
    workspaceName: session.workspace.name,
    businessTypeId: session.workspace.businessTypeId,
    tier: session.access.tier,
    canManage: hasRole(session.role, "admin"),
    project,
    connect,
    showTestBadges: canSeeTestBadges(session.user.email),
  };
}
