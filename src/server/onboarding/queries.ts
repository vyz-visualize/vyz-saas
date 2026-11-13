import "server-only";

// Estado do primeiro acesso do workspace aberto, lido do banco com o RLS de
// quem está logado: passo atual, segmento, plano, o primeiro projeto e, nos
// passos de conectar e de contas e modelo, as conexões e as contas.

import { suggestObjective, type CampaignSignal } from "@/features/onboarding/objective";
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
  const [projects, connect, signals] = await Promise.all([
    supabase.from("projects").select("id, name").eq("workspace_id", session.workspace.id).is("archived_at", null).order("created_at").limit(1),
    late ? getConnectState() : Promise.resolve(null),
    step === "setup" ? campaignSignals(session.workspace.id) : Promise.resolve([]),
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
    suggestion: step === "setup" ? suggestObjective(signals, session.workspace.businessTypeId) : null,
  };
}

const DAY_MS = 86_400_000;

/**
 * Objetivo e números dos últimos 30 dias de cada campanha das contas ativas da Meta e do
 * Google (o que já foi importado). Sem importação ainda, volta vazio e vale o segmento.
 */
async function campaignSignals(workspaceId: string): Promise<CampaignSignal[]> {
  const supabase = await createServerSupabase();
  const accounts = unwrap(await supabase.from("ad_accounts").select("id, platform_id").eq("workspace_id", workspaceId).eq("is_enabled", true).in("platform_id", ["meta", "google"])) ?? [];
  if (!accounts.length) return [];
  const ids = accounts.map((a) => a.id);
  const platformOf = new Map(accounts.map((a) => [a.id, a.platform_id as string]));
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10);
  const [campaigns, rows] = await Promise.all([
    supabase.from("ad_campaigns").select("id, ad_account_id, objective, channel").eq("workspace_id", workspaceId).in("ad_account_id", ids).limit(2000),
    supabase.from("insights_campaign_daily").select("campaign_id, spend, conversions, conversion_value").eq("workspace_id", workspaceId).in("ad_account_id", ids).gte("date", since).limit(20000),
  ]);
  if (campaigns.error || rows.error) {
    console.error("[vyz] sugestão do modelo", campaigns.error?.message ?? rows.error?.message);
    return [];
  }
  const sums = new Map<string, { spend: number; conversions: number; value: number }>();
  for (const r of rows.data ?? []) {
    const s = sums.get(r.campaign_id) ?? { spend: 0, conversions: 0, value: 0 };
    s.spend += Number(r.spend) || 0;
    s.conversions += Number(r.conversions) || 0;
    s.value += Number(r.conversion_value) || 0;
    sums.set(r.campaign_id, s);
  }
  return (campaigns.data ?? []).map((c) => {
    const s = sums.get(c.id) ?? { spend: 0, conversions: 0, value: 0 };
    return { platform: platformOf.get(c.ad_account_id) ?? "", objective: c.objective, channel: c.channel, spend: s.spend, conversions: s.conversions, conversionValue: s.value };
  });
}
