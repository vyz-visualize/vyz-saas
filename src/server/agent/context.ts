import "server-only";

// Contexto do assistente VYZ montado no servidor, com o RLS de quem pergunta:
// plano e uso da sessão, e um resumo por dashboard. Dashboards com dados reais
// (templates live) somam o armazém (insights_account_daily) das contas ativas
// ligadas a eles: mês até hoje contra o período anterior de mesmo tamanho, no
// fuso do workspace. Os de exemplo usam os mesmos dados de amostra que o
// painel desenha (datasetFor), para a resposta bater com a tela.

import type { AgentContext, ClientData } from "@/features/agent/engine/types";
import { sampleFocus } from "@/features/analytics/creatives/sample";
import { filterSummary, hasFilters, parseFilters, rangeLabel } from "@/features/analytics/filters";
import { kpiMetric } from "@/features/analytics/metrics";
import type { Totals as ViewTotals } from "@/features/analytics/types";
import { monthToDate, periodTotals, type WarehouseDay } from "@/features/agent/engine/warehouse";
import { datasetFor, pageLayout, sampleDefaultKpis } from "@/features/dashboards/data";
import { GOOGLE_CATALOG, META_CATALOG, pageKpiIds, parseMetricPrefs, sampleCatalog, visibleIds } from "@/features/dashboards/metric-prefs";
import type { MetricId } from "@/features/metrics/definitions";
import { periodFromQuery } from "@/features/dashboards/model";
import { currentTotals, previousTotals, totals, type Totals } from "@/features/metrics/compute";
import { ENTITLEMENTS, TIER_LABEL } from "@/features/pricing/entitlements";
import { localDate } from "@/features/sync/dates";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { LIVE_TEMPLATES } from "@/features/templates/live";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { periodDays, type PeriodId } from "@/features/workspace/types";
import { loadLiveDashboard } from "@/server/analytics/queries";
import { authorize } from "@/server/auth/workspace";
import { unwrap } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";
import { landingPagesEnabledFor } from "@/lib/flags";

const PAGE_SIZE = 1000;

/** Pergunta feita num dashboard com filtros ativos: o endereço dele guarda os filtros. */
export type AgentFocus = { dashboardId: string; search: string };

/** Os totais da tela (em reais) no formato do motor (em centavos). */
function engineTotals(t: ViewTotals): Totals {
  return totals(
    [
      {
        ago: 0,
        spend: Math.round((t.spend ?? 0) * 100),
        impressions: t.impressions,
        clicks: t.clicks,
        conversions: t.conversions,
        revenue: Math.round(t.value * 100),
        leads: 0,
        qualified: 0,
        visits: 0,
        calls: 0,
        sessions: 0,
        views: 0,
        byPlatform: {},
        maturing: false,
      },
    ],
    t.frequency ?? 0,
  );
}

export async function loadAgentContext(now = new Date(), focus?: AgentFocus): Promise<AgentContext> {
  const session = await authorize("viewer", { access: false });
  const ws = session.workspace.id;
  const tier = session.access.tier ?? "base";
  const supabase = await createServerSupabase();

  const dashboards =
    unwrap(
      await supabase
        .from("dashboards")
        .select("id, name, client_name, template_id, goal_cents, margin, monthly_budget_cents, period, custom_days, metric_prefs, pages:dashboard_pages!dashboard_pages_workspace_id_dashboard_id_fkey(page_type_id, position)")
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

  // com filtros ativos, a resposta é só sobre o recorte aberto na tela
  let scoped: { client: ClientData; focus: NonNullable<AgentContext["focus"]> } | null = null;
  const open = focus && dashboards.find((d) => d.id === focus.dashboardId);
  const openClient = open && clients.find((c) => c.dashboardId === open.id);
  if (focus && open && openClient) {
    const params = new URLSearchParams(focus.search);
    const filters = parseFilters(params);
    const { period, customDays } = periodFromQuery(Object.fromEntries(params), { period: open.period as PeriodId, customDays: open.custom_days ?? 14 });
    const days = periodDays({ period, customDays });
    if (live.includes(open)) {
      const { view } = await loadLiveDashboard(open.id, { period, customDays, filters });
      const info = view.filterInfo;
      if (info) {
        const when = info.filters.days ? `nos dias ${rangeLabel(info.filters.days)}` : `no período aberto (${days} dias)`;
        scoped = { client: { ...openClient, cur: engineTotals(view.totals), prev: engineTotals(view.previousTotals) }, focus: { label: filterSummary(info.filters, info.labels), period: when } };
      }
    } else if (hasFilters(filters)) {
      const t = dashboardTemplate(open.template_id);
      if (t) {
        const ds = datasetFor({ templateId: open.template_id, name: open.name, client: open.client_name, settings: { goal: open.goal_cents ?? 0, margin: open.margin ?? 0, budget: open.monthly_budget_cents ?? 0 } }, days);
        const cut = sampleFocus(t, ds, { period, customDays }, filters);
        const when = filters.days ? `nos dias ${rangeLabel(filters.days)}` : `no período aberto (${days} dias)`;
        scoped = { client: { ...openClient, cur: currentTotals(cut.ds), prev: previousTotals(cut.ds) }, focus: { label: filterSummary(filters, cut.labels), period: when } };
      }
    }
  }

  return {
    now,
    focus: scoped?.focus,
    tier,
    tierLabel: TIER_LABEL[tier],
    ent: session.access.entitlements ?? ENTITLEMENTS[tier],
    dashboards: scoped ? [scoped.client] : clients,
    landingPages: landingPagesEnabledFor(session.workspace.product),
    counts: {
      dashboards: session.usage.dashboards,
      landingPublished: session.usage.publishedLandingPages,
      accounts: session.usage.billableAccounts,
      projects: session.usage.projects,
      contractedProjects: session.access.accountsQuantity,
    },
  };
}

/** Cards que aparecem na primeira página de um dashboard de exemplo (alvos do "Mostrar no painel"). */
function visibleSampleKpis(t: DashboardTemplate, pages: PageId[], first: PageId, raw: unknown): MetricId[] {
  const catalog = sampleCatalog(t.profile, sampleDefaultKpis(t, pages), t.sources);
  return pageKpiIds(catalog, pageLayout(t, first).kpis.map((k) => k.metric), parseMetricPrefs(raw).sample?.kpis) as MetricId[];
}
