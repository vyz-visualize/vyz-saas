import "server-only";

// Contexto do assistente VYZ montado no servidor, com o RLS de quem pergunta:
// plano e uso da sessão, e um resumo por dashboard. Dashboards com dados reais
// (templates live) somam o armazém (insights_account_daily) das contas ativas
// ligadas a eles: mês até hoje contra o período anterior de mesmo tamanho, no
// fuso do workspace. Os de exemplo usam os mesmos dados de amostra que o
// painel desenha (datasetFor), para a resposta bater com a tela.

import type { AgentContext, ClientData } from "@/features/agent/engine/types";
import { kpiMetric } from "@/features/analytics/metrics";
import { monthToDate, periodTotals, type WarehouseDay } from "@/features/agent/engine/warehouse";
import { datasetFor, pageLayout, sampleDefaultKpis } from "@/features/dashboards/data";
import { GOOGLE_CATALOG, META_CATALOG, parseMetricPrefs, sampleCatalog, visibleIds } from "@/features/dashboards/metric-prefs";
import type { MetricId } from "@/features/metrics/definitions";
import { currentTotals, previousTotals } from "@/features/metrics/compute";
import { ENTITLEMENTS, TIER_LABEL } from "@/features/pricing/entitlements";
import { localDate } from "@/features/sync/dates";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { LIVE_TEMPLATES } from "@/features/templates/live";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { authorize } from "@/server/auth/workspace";
import { unwrap } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";
import { landingPagesEnabledFor } from "@/lib/flags";

const PAGE_SIZE = 1000;

export async function loadAgentContext(now = new Date()): Promise<AgentContext> {
  const session = await authorize("viewer", { access: false });
  const ws = session.workspace.id;
  const tier = session.access.tier ?? "base";
  const supabase = await createServerSupabase();

  const dashboards =
    unwrap(
      await supabase
        .from("dashboards")
        .select("id, name, client_name, template_id, goal_cents, margin, monthly_budget_cents, metric_prefs, pages:dashboard_pages!dashboard_pages_workspace_id_dashboard_id_fkey(page_type_id, position)")
        .eq("workspace_id", ws)
        .order("updated_at", { ascending: false })
        .limit(50),
    ) ?? [];

  const live = dashboards.filter((d) => LIVE_TEMPLATES.some((t) => t.id === d.template_id));
  const today = localDate(now, session.workspace.timezone);
  const ranges = monthToDate(today);

  // contas ativas de cada dashboard live, e as linhas diárias delas nos dois períodos
  const sources = live.length
    ? (unwrap(
        await supabase
          .from("dashboard_sources")
          .select("dashboard_id, account:ad_accounts!dashboard_sources_workspace_id_ad_account_id_fkey(id, is_enabled)")
          .in(
            "dashboard_id",
            live.map((d) => d.id),
          ),
      ) ?? [])
    : [];
  const accountsOf = new Map<string, string[]>();
  for (const s of sources) if (s.account?.is_enabled) accountsOf.set(s.dashboard_id, [...(accountsOf.get(s.dashboard_id) ?? []), s.account.id]);
  const accountIds = [...new Set([...accountsOf.values()].flat())];
  const rows = new Map<string, WarehouseDay[]>();
  for (let page = 0; accountIds.length > 0; page++) {
    const batch =
      unwrap(
        await supabase
          .from("insights_account_daily")
          .select("ad_account_id, date, spend, impressions, clicks, conversions, conversion_value, reach")
          .eq("workspace_id", ws)
          .in("ad_account_id", accountIds)
          .gte("date", ranges.previous.from)
          .lte("date", ranges.current.to)
          .order("ad_account_id")
          .order("date")
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1),
      ) ?? [];
    for (const r of batch) rows.set(r.ad_account_id, [...(rows.get(r.ad_account_id) ?? []), r]);
    if (batch.length < PAGE_SIZE) break;
  }

  // dia do mês no fuso do workspace (não no do servidor)
  const days = Math.max(1, Number(today.slice(8, 10)));
  const clients: ClientData[] = dashboards.flatMap((d): ClientData[] => {
    const client = d.client_name || d.name;
    if (live.includes(d)) {
      const ids = accountsOf.get(d.id) ?? [];
      if (!ids.length) return [];
      const { cur, prev } = periodTotals(
        ids.flatMap((id) => rows.get(id) ?? []),
        ranges,
      );
      const platform = LIVE_TEMPLATES.find((t) => t.id === d.template_id)?.sources.includes("google") ? "google" : "meta";
      // o assistente responde sobre qualquer métrica; só o "Mostrar no painel" precisa do card visível
      const shown = visibleIds(platform === "google" ? GOOGLE_CATALOG : META_CATALOG, "kpis", parseMetricPrefs(d.metric_prefs)[platform]?.kpis);
      const kpis = shown.map((id) => kpiMetric(platform, id)).filter((m): m is MetricId => !!m);
      return [{ dashboardId: d.id, dashboardName: d.name, client, profile: "ecommerce", cur, prev, kpis }];
    }
    const t = dashboardTemplate(d.template_id);
    if (!t) return [];
    const pages = [...d.pages].sort((a, b) => a.position - b.position);
    const first = (pages[0]?.page_type_id ?? "visao-geral") as PageId;
    const ds = datasetFor({ templateId: d.template_id, name: d.name, client: d.client_name, settings: { goal: d.goal_cents ?? 0, margin: d.margin ?? 0, budget: d.monthly_budget_cents ?? 0 } }, days);
    return [{ dashboardId: d.id, dashboardName: d.name, client, profile: t.profile, cur: currentTotals(ds), prev: previousTotals(ds), kpis: visibleSampleKpis(t, pages.map((p) => p.page_type_id as PageId), first, d.metric_prefs) }];
  });

  return {
    now,
    tier,
    tierLabel: TIER_LABEL[tier],
    ent: session.access.entitlements ?? ENTITLEMENTS[tier],
    dashboards: clients,
    landingPages: landingPagesEnabledFor(session.workspace.product),
    counts: {
      dashboards: session.usage.dashboards,
      landingPublished: session.usage.publishedLandingPages,
      accounts: session.usage.billableAccounts,
      contractedAccounts: session.access.accountsQuantity,
    },
  };
}

/** Cards que aparecem na primeira página de um dashboard de exemplo (alvos do "Mostrar no painel"). */
function visibleSampleKpis(t: DashboardTemplate, pages: PageId[], first: PageId, raw: unknown): MetricId[] {
  const defaults = sampleDefaultKpis(t, pages);
  const visible = visibleIds(sampleCatalog(t.profile, defaults), "kpis", parseMetricPrefs(raw).sample?.kpis);
  const onPage = pageLayout(t, first).kpis.map((k) => k.metric);
  return (visible as MetricId[]).filter((m) => onPage.includes(m) || !defaults.includes(m));
}
