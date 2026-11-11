import "server-only";

// Análises de todos os dashboards live de um workspace (o feed do app e o
// resumo diário por push). Lê com o cliente recebido: o do usuário (RLS) na
// API, o de serviço no agendador (que já conferiu a quem pertence).

import { dashboardInsights, type Insight } from "@/features/insights/insights";
import { isLiveTemplate } from "@/features/templates/live";
import type { PeriodId } from "@/features/workspace/types";
import { loadLiveDashboard } from "@/server/analytics/queries";
import type { DB } from "@/server/supabase/server";

export type DashboardPulse = { id: string; name: string; platform: "meta" | "google" | "import"; currency: string; spend: number | null; value: number; conversions: number; roas: number | null; previousSpend: number | null; previousConversions: number };

export async function loadWorkspaceInsights(db: DB, workspaceId: string, period: PeriodId = "7d", max = 12): Promise<{ insights: Insight[]; pulse: DashboardPulse[] }> {
  const { data, error } = await db.from("dashboards").select("id, template_id").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(50);
  if (error) throw error;
  const live = (data ?? []).filter((d) => isLiveTemplate(d.template_id)).slice(0, max);
  const loaded = await Promise.all(live.map((d) => loadLiveDashboard(d.id, { period, db }).catch(() => null)));
  const insights: Insight[] = [];
  const pulse: DashboardPulse[] = [];
  for (const d of loaded) {
    if (!d || d.status !== "ok") continue;
    insights.push(...dashboardInsights(d, 4));
    const t = d.view.totals;
    const p = d.view.previousTotals;
    pulse.push({ id: d.dashboard.id, name: d.dashboard.name, platform: d.platform, currency: d.currency, spend: t.spend, value: t.value, conversions: t.conversions, roas: t.roas, previousSpend: p.spend, previousConversions: p.conversions });
  }
  // o mais importante de cada dashboard primeiro, sem um só tomar a lista
  insights.sort((a, b) => b.weight - a.weight);
  return { insights: insights.slice(0, 30), pulse };
}
