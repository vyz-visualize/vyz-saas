import "server-only";

// Leitura dos dashboards com dados reais (Meta Ads · E-commerce e Google Ads ·
// E-commerce). Duas etapas:
//   1. com o cliente de quem pede (RLS): o dashboard precisa ser visível e as
//      contas ligadas a ele, ativas (ad_accounts.is_enabled), da plataforma do
//      template. Daí sai o período (termina ontem no fuso da conta);
//   2. uma função em cache ("use cache", sem cookies) lê do armazém com a chave
//      de serviço SÓ essas contas e agrega. Tags: dashboard:<id> e
//      insights:<conta> (a sincronização invalida esta ao terminar).
// Ocultar investimento acontece depois do cache, antes de ir para o navegador.

import { cacheLife, cacheTag } from "next/cache";
import { isImportPlatform } from "@/features/accounts/connection-modes";
import { z } from "zod";
import { aggregateDashboard, redactSpend } from "@/features/analytics/aggregate";
import { aggregateOrganic, type OrganicDayRow, type OrganicPostRow, type OrganicProfile, type OrganicView } from "@/features/analytics/organic";
import { isOrganicPlatform } from "@/features/accounts/platforms";
import { cutCreatives, type CreativesAccess } from "@/features/analytics/creatives/access";
import { aggregateFiltered } from "@/features/analytics/filtered";
import { NO_FILTERS, type DashFilters } from "@/features/analytics/filters";
import { anyDashboardTemplate } from "@/features/templates/live";
import { dashboardRanges, isPeriodId, maturingStart } from "@/features/analytics/ranges";
import type {
  AccountDayRow,
  AdDayRow,
  BreakdownDayRow,
  CampaignDayRow,
  DashboardView,
  DateRange,
  LiveAccount,
  LiveDashboardData,
  LivePlatform,
  ProductDayRow,
  SearchTermDayRow,
  WarehouseRows,
  SiteSummary,
} from "@/features/analytics/types";
import { DEFAULT_TIME_ZONE, localDate } from "@/features/sync/dates";
import type { AnalyticsRow } from "@/features/metrics/warehouse-dataset";
import { insightsTag } from "@/features/sync/tags";
import type { PeriodId } from "@/features/workspace/types";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, fromPostgrest } from "@/server/supabase/errors";
import { createServerSupabase, type DB } from "@/server/supabase/server";

export type LoadLiveDashboardOptions = {
  period: PeriodId;
  /** Dias do período personalizado (3 a 60). */
  customDays?: number;
  /** Tira os valores de investimento antes de mandar para o navegador. */
  hideSpend?: boolean;
  /** Página de Criativos: o que o plano cobre. Sem isso, só a lista (nunca manda o que não foi pedido). */
  creatives?: CreativesAccess;
  /** Dashboard interativo: o recorte da URL. Só compara com as linhas destas contas. */
  filters?: DashFilters;
  /**
   * Cliente que confere o acesso. Padrão: o da sessão (RLS). O link público
   * passa o admin DEPOIS de validar o token; scripts de teste também.
   */
  db?: DB;
};

/** Tag de cache de um dashboard (editar fontes ou margem pode invalidar com ela). */
export const dashboardTag = (dashboardId: string) => `dashboard:${dashboardId}`;

const Uuid = z.uuid();

export async function loadLiveDashboard(dashboardId: string, opts: LoadLiveDashboardOptions): Promise<LiveDashboardData> {
  if (!Uuid.safeParse(dashboardId).success) throw appError("dashboard:not_found");
  const db = opts.db ?? (await createServerSupabase());

  const { data: dashboard, error } = await db.from("dashboards").select("id, name, client_name, template_id, margin").eq("id", dashboardId).maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!dashboard) throw appError("dashboard:not_found");
  // modelos novos e os de exemplo (app): a plataforma principal é a das contas ligadas (Meta, senão Google)
  if (!anyDashboardTemplate(dashboard.template_id)) throw appError("dashboard:not_live", "Este dashboard não lê dados das contas conectadas.");
  // a plataforma principal é a das contas ligadas (Meta, senão Google)
  let platform: LivePlatform | undefined;
  const composed = true;

  const { data: sources, error: sErr } = await db
    .from("dashboard_sources")
    .select("account:ad_accounts!dashboard_sources_workspace_id_ad_account_id_fkey(id, name, platform_id, currency, timezone, is_enabled, last_synced_at)")
    .eq("dashboard_id", dashboardId);
  if (sErr) throw fromPostgrest(sErr);
  // orgânico (Instagram e Página): lido à parte, em organic_daily e organic_posts
  const organicProfiles: OrganicProfile[] = (sources ?? [])
    .map((s) => s.account)
    .filter((a): a is NonNullable<typeof a> => !!a && a.is_enabled && isOrganicPlatform(a.platform_id))
    .map((a) => ({ id: a.id, name: a.name, platform: a.platform_id as OrganicProfile["platform"] }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const enabledIds = (sources ?? []).filter((s) => s.account?.is_enabled).map((s) => s.account!.platform_id);
  if (!platform) platform = enabledIds.includes("meta") ? "meta" : enabledIds.includes("google") || !enabledIds.some(isImportPlatform) ? "google" : "import";
  const livePlatform: LivePlatform = platform;
  const accounts: (LiveAccount & { platformId: string })[] = (sources ?? [])
    .map((s) => s.account)
    // planilha: qualquer plataforma que entra por importação; modelo novo: Meta e Google juntos; os outros, só a do template
    .filter((a): a is NonNullable<typeof a> => !!a && a.is_enabled && (livePlatform === "import" ? isImportPlatform(a.platform_id) : composed ? a.platform_id === "meta" || a.platform_id === "google" || isImportPlatform(a.platform_id) : a.platform_id === livePlatform))
    .map((a) => ({ id: a.id, name: a.name, currency: a.currency, timeZone: a.timezone || DEFAULT_TIME_ZONE, lastSyncedAt: a.last_synced_at, platformId: a.platform_id }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const organicTz = (sources ?? []).map((s) => s.account).find((a) => a && organicProfiles.some((p) => p.id === a.id))?.timezone;
  const timeZone = accounts[0]?.timeZone ?? organicTz ?? DEFAULT_TIME_ZONE;
  const period: PeriodId = isPeriodId(opts.period) ? opts.period : "30d";
  const { current, previous } = dashboardRanges(period, opts.customDays ?? 14, localDate(new Date(), timeZone));
  const margin = dashboard.margin == null ? null : Number(dashboard.margin);
  const breakEvenRoas = margin && margin > 0 ? Math.round((1 / margin) * 100) / 100 : null;

  // app: "Tudo · Meta · Google". Com ?plataforma=meta (ou google), só as contas dela
  const adPlatforms = composed ? (["meta", "google"] as const).filter((p) => accounts.some((a) => a.platformId === p)) : [];
  const only = composed ? (opts.filters?.platforms ?? []).find((p): p is "meta" | "google" => (adPlatforms as readonly string[]).includes(p)) : undefined;
  if (only) {
    platform = only;
    accounts.splice(0, accounts.length, ...accounts.filter((a) => a.platformId === only));
  }
  const shown: LivePlatform = platform!;
  // a plataforma já foi aplicada nas contas: o filtro dela não vale para as linhas somadas
  const filters = composed ? { ...(opts.filters ?? NO_FILTERS), platforms: [] } : (opts.filters ?? NO_FILTERS);
  const otherAds = composed && !only ? accounts.filter((a) => a.platformId !== shown) : [];
  let view = !accounts.length
    ? aggregateDashboard(emptyRows(shown, current, previous), { breakEvenRoas })
    : otherAds.length
      ? // Meta e Google no mesmo dashboard: as linhas das duas somadas (a principal dá o vocabulário)
        aggregateFiltered(
          mergeRows(
            await Promise.all(
              (["meta", "google", "import"] as const)
                .map((p) => [p, accounts.filter((a) => (p === "import" ? isImportPlatform(a.platformId) : a.platformId === p)).map((a) => a.id)] as const)
                // planilha entra somada (as plataformas importadas têm as mesmas colunas de anúncio)
                .map(([p, ids]) => (ids.length ? readRows({ dashboardId, platform: p, accountIds: ids, current, previous, breakEvenRoas }) : null)),
            ).then((sets) => sets.filter((x): x is WarehouseRows => !!x)),
            shown,
          ),
          filters,
          { breakEvenRoas },
        )
      : await readWarehouse({ dashboardId, platform: shown, accountIds: accounts.map((a) => a.id), current, previous, breakEvenRoas }, filters);
  if (opts.hideSpend) view = redactSpend(view);
  const organic = organicProfiles.length ? await readOrganic({ dashboardId, profiles: organicProfiles, current, previous }) : undefined;
  // site (GA4) das propriedades ligadas: o app mostra sessões, conversões, receita e os canais
  const ga4Ids = (sources ?? []).filter((s) => s.account?.is_enabled && s.account.platform_id === "ga4").map((s) => s.account!.id);
  const site = ga4Ids.length ? siteSummary(await readAnalytics({ dashboardId, accountIds: ga4Ids, from: previous.from < current.from ? previous.from : current.from, to: current.to }), current, previous) : undefined;
  const currency = accounts[0]?.currency ?? "BRL";
  const cut = cutCreatives(view, opts.creatives ?? {}, { hideSpend: !!opts.hideSpend, currency });

  return {
    dashboard: { id: dashboard.id, name: dashboard.name, clientName: dashboard.client_name, templateId: dashboard.template_id },
    platform: shown,
    ...(adPlatforms.length > 1 ? { platforms: [...adPlatforms] } : {}),
    status: !accounts.length && !organicProfiles.length ? "no_accounts" : view.hasData || organic?.hasData ? "ok" : "no_data",
    accounts: accounts.map(({ platformId: _p, ...a }) => a),
    // contas de moedas diferentes não se somam com conversão: vale a primeira
    currency,
    timeZone,
    current,
    previous,
    maturingFrom: maturingStart(current),
    hideSpend: !!opts.hideSpend,
    sample: false,
    view: cut.view,
    creatives: cut.creatives,
    ...(organic ? { organic } : {}),
    ...(site ? { site } : {}),
  };
}

// ---- qualquer modelo com as contas ligadas ---------------------------------------------------

export type TemplateWarehouse = {
  /** Uma entrada por plataforma (Meta, Google) com conta ativa ligada ao dashboard. */
  sets: WarehouseRows[];
  /** GA4 (analytics_daily) das propriedades ligadas, nos dois períodos. */
  analytics: AnalyticsRow[];
  /** Orgânico das contas ligadas: por plataforma e todos juntos (Conteúdo). */
  organic: { instagram?: OrganicView; facebook?: OrganicView; all?: OrganicView };
  current: DateRange;
  previous: DateRange;
  accounts: { id: string; name: string; platform: string; lastSyncedAt: string | null }[];
  today: string;
};

/**
 * Linhas do armazém das contas ligadas a um dashboard de modelo comum (não os "ao vivo"),
 * por plataforma, para o modelo desenhar com dados reais. null = nenhuma conta ativa ligada.
 */
export async function loadTemplateWarehouse(dashboardId: string, opts: { platforms: readonly string[]; period: PeriodId; customDays?: number; db?: DB }): Promise<TemplateWarehouse | null> {
  if (!Uuid.safeParse(dashboardId).success) return null;
  const db = opts.db ?? (await createServerSupabase());
  const { data: sources, error } = await db
    .from("dashboard_sources")
    .select("account:ad_accounts!dashboard_sources_workspace_id_ad_account_id_fkey(id, name, platform_id, timezone, is_enabled, last_synced_at)")
    .eq("dashboard_id", dashboardId);
  if (error) throw fromPostgrest(error);
  const linked = (sources ?? [])
    .map((s) => s.account)
    .filter((a): a is NonNullable<typeof a> => !!a && a.is_enabled && (["meta", "google", "ga4", "instagram", "facebook"].includes(a.platform_id) || isImportPlatform(a.platform_id)) && opts.platforms.includes(a.platform_id))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!linked.length) return null;
  const timeZone = linked[0].timezone || DEFAULT_TIME_ZONE;
  const today = localDate(new Date(), timeZone);
  const period: PeriodId = isPeriodId(opts.period) ? opts.period : "30d";
  const { current, previous } = dashboardRanges(period, opts.customDays ?? 14, today);
  const byPlatform = new Map<LivePlatform, string[]>();
  for (const a of linked) if (a.platform_id === "meta" || a.platform_id === "google") byPlatform.set(a.platform_id as LivePlatform, [...(byPlatform.get(a.platform_id as LivePlatform) ?? []), a.id]);
  const ga4 = linked.filter((a) => a.platform_id === "ga4").map((a) => a.id);
  const profilesOf = (platform?: string) =>
    linked
      .filter((a) => (platform ? a.platform_id === platform : isOrganicPlatform(a.platform_id)))
      .map((a) => ({ id: a.id, name: a.name, platform: a.platform_id as OrganicProfile["platform"] }));
  const organicFor = (profiles: OrganicProfile[]) => (profiles.length ? readOrganic({ dashboardId, profiles, current, previous }) : Promise.resolve(undefined));
  const [sets, analytics, instagram, facebook, all] = await Promise.all([
    Promise.all([
      ...[...byPlatform].map(([platform, accountIds]) => readRows({ dashboardId, platform, accountIds, current, previous, breakEvenRoas: null })),
      // planilha: as linhas de cada plataforma importada, com o nome dela (TikTok, LinkedIn...) para somar por plataforma
      ...[...new Set(linked.filter((a) => isImportPlatform(a.platform_id)).map((a) => a.platform_id))].map((pid) =>
        readRows({ dashboardId, platform: "import", accountIds: linked.filter((a) => a.platform_id === pid).map((a) => a.id), current, previous, breakEvenRoas: null }).then((r) => ({ ...r, platform: pid as LivePlatform })),
      ),
    ]),
    ga4.length ? readAnalytics({ dashboardId, accountIds: ga4, from: previous.from < current.from ? previous.from : current.from, to: current.to }) : Promise.resolve([] as AnalyticsRow[]),
    organicFor(profilesOf("instagram")),
    organicFor(profilesOf("facebook")),
    organicFor(profilesOf()),
  ]);
  return { sets, analytics, organic: { instagram, facebook, all }, current, previous, accounts: linked.map((a) => ({ id: a.id, name: a.name, platform: a.platform_id, lastSyncedAt: a.last_synced_at })), today };
}

/** GA4 do intervalo, em cache como o armazém (a sincronização invalida pela propriedade). */
async function readAnalytics(q: { dashboardId: string; accountIds: string[]; from: string; to: string }): Promise<AnalyticsRow[]> {
  "use cache";
  if (process.env.NEXT_RUNTIME) {
    cacheTag(dashboardTag(q.dashboardId), ...q.accountIds.map(insightsTag));
    cacheLife("hours");
  }
  const db = createAdminSupabase();
  const rows = await fetchAll((a, b) =>
    db
      .from("analytics_daily")
      .select("date, channel, sessions, users, engaged_sessions, key_events, transactions, revenue")
      .in("ad_account_id", q.accountIds)
      .gte("date", q.from)
      .lte("date", q.to)
      .order("ad_account_id")
      .order("date")
      .order("channel")
      .range(a, b),
  );
  return rows.map((r) => ({ date: r.date, channel: r.channel, sessions: num(r.sessions), users: num(r.users), engagedSessions: num(r.engaged_sessions), keyEvents: num(r.key_events), transactions: num(r.transactions), revenue: num(r.revenue) }));
}


/** Linhas de mais de uma plataforma num conjunto só (a principal dá o vocabulário dos números). */
function mergeRows(sets: WarehouseRows[], platform: LivePlatform): WarehouseRows {
  const [first] = sets;
  const cat = <K extends keyof WarehouseRows>(k: K) => sets.flatMap((s) => s[k] as unknown[]) as WarehouseRows[K];
  return {
    platform,
    current: first.current,
    previous: first.previous,
    accountDaily: cat("accountDaily"),
    campaigns: cat("campaigns"),
    campaignDaily: cat("campaignDaily"),
    ads: cat("ads"),
    adDaily: cat("adDaily"),
    breakdownDaily: cat("breakdownDaily"),
    searchTermDaily: cat("searchTermDaily"),
    products: cat("products"),
    productDaily: cat("productDaily"),
  };
}

/** Totais do GA4 nos dois períodos e os canais do período atual (para o app). */
function siteSummary(rows: AnalyticsRow[], current: DateRange, previous: DateRange): SiteSummary {
  const sum = (r: DateRange) => {
    const list = rows.filter((x) => x.date >= r.from && x.date <= r.to);
    return { sessions: list.reduce((a, x) => a + x.sessions, 0), conversions: list.reduce((a, x) => a + x.keyEvents, 0), revenue: list.reduce((a, x) => a + x.revenue, 0), list };
  };
  const cur = sum(current);
  const prev = sum(previous);
  const byChannel = new Map<string, { channel: string; sessions: number; conversions: number }>();
  for (const x of cur.list) {
    const c = byChannel.get(x.channel) ?? { channel: x.channel, sessions: 0, conversions: 0 };
    c.sessions += x.sessions;
    c.conversions += x.keyEvents;
    byChannel.set(x.channel, c);
  }
  return {
    sessions: cur.sessions,
    previousSessions: prev.sessions,
    conversions: Math.round(cur.conversions),
    previousConversions: Math.round(prev.conversions),
    revenue: Math.round(cur.revenue * 100) / 100,
    channels: [...byChannel.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 6).map((c) => ({ ...c, conversions: Math.round(c.conversions) })),
  };
}

// ---- orgânico ---------------------------------------------------------------------------

type OrganicQuery = { dashboardId: string; profiles: OrganicProfile[]; current: DateRange; previous: DateRange };

/** Orgânico do período e do anterior, em cache como o armazém (a sincronização invalida pela conta). */
async function readOrganic(q: OrganicQuery): Promise<OrganicView> {
  "use cache";
  if (process.env.NEXT_RUNTIME) {
    cacheTag(dashboardTag(q.dashboardId), ...q.profiles.map((p) => insightsTag(p.id)));
    cacheLife("hours");
  }
  const db = createAdminSupabase();
  const ids = q.profiles.map((p) => p.id);
  // os seguidores do início do período anterior pedem um dia antes
  const from = q.previous.from < q.current.from ? q.previous.from : q.current.from;
  const [days, posts] = await Promise.all([
    fetchAll<OrganicDayRow>((a, b) =>
      db
        .from("organic_daily")
        .select("ad_account_id, date, followers, follows, unfollows, views, reach, profile_views, accounts_engaged, interactions, link_clicks, posts")
        .in("ad_account_id", ids)
        .gte("date", from)
        .lte("date", q.current.to)
        .order("ad_account_id")
        .order("date")
        .range(a, b),
    ),
    fetchAll<OrganicPostRow>((a, b) =>
      db
        .from("organic_posts")
        .select("ad_account_id, external_id, kind, caption, permalink, thumbnail_url, published_at, views, reach, likes, comments, shares, saves, interactions")
        .in("ad_account_id", ids)
        .gte("published_at", `${q.current.from}T00:00:00Z`)
        .lte("published_at", `${q.current.to}T23:59:59Z`)
        .order("published_at", { ascending: false })
        .range(a, b),
    ),
  ]);
  const toNum = (r: OrganicDayRow): OrganicDayRow => ({ ...r, followers: opt(r.followers), views: num(r.views), reach: opt(r.reach) });
  return aggregateOrganic(q.profiles, days.map(toNum), posts.map((p) => ({ ...p, views: opt(p.views), reach: opt(p.reach) })), q.current, q.previous);
}

// ---- leitura em cache ---------------------------------------------------------------------

type WarehouseQuery = {
  dashboardId: string;
  platform: LivePlatform;
  /** Ordenadas (a ordem entra na chave do cache). */
  accountIds: string[];
  current: DateRange;
  previous: DateRange;
  breakEvenRoas: number | null;
};

/** Uma entrada por combinação de filtros; as linhas têm entrada própria, então filtrar não relê o armazém. */
async function readWarehouse(q: WarehouseQuery, filters: DashFilters): Promise<DashboardView> {
  "use cache";
  // fora do Next (scripts de teste) não há cache: as marcações só valem lá dentro
  if (process.env.NEXT_RUNTIME) {
    cacheTag(dashboardTag(q.dashboardId), ...q.accountIds.map(insightsTag));
    cacheLife("hours");
  }
  return aggregateFiltered(await readRows(q), filters, { breakEvenRoas: q.breakEvenRoas });
}

async function readRows(q: WarehouseQuery): Promise<WarehouseRows> {
  "use cache";
  if (process.env.NEXT_RUNTIME) {
    cacheTag(dashboardTag(q.dashboardId), ...q.accountIds.map(insightsTag));
    cacheLife("hours");
  }
  return fetchRows(createAdminSupabase(), q);
}

function emptyRows(platform: LivePlatform, current: DateRange, previous: DateRange): WarehouseRows {
  return { platform, current, previous, accountDaily: [], campaigns: [], campaignDaily: [], ads: [], adDaily: [], breakdownDaily: [], searchTermDaily: [], products: [], productDaily: [] };
}

/** O PostgREST devolve no máximo 1000 linhas por pedido: busca em páginas (ordem estável). */
const PAGE = 1000;

type Paged<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: Parameters<typeof fromPostgrest>[0] | null }>;

async function fetchAll<T>(page: Paged<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw fromPostgrest(error);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

const num = (v: number | string | null | undefined) => (v == null ? 0 : Number(v));
const opt = (v: number | string | null | undefined) => (v == null ? null : Number(v));

const METRIC_COLUMNS =
  "spend, impressions, reach, clicks, link_clicks, landing_page_views, add_to_cart, initiate_checkout, conversions, conversion_value, video_views, video_thruplays, search_impression_share, search_lost_is_budget, search_lost_is_rank";

type MetricColumns = {
  spend: number;
  impressions: number;
  reach: number | null;
  clicks: number;
  link_clicks: number | null;
  landing_page_views: number | null;
  add_to_cart: number | null;
  initiate_checkout: number | null;
  conversions: number;
  conversion_value: number;
  video_views: number | null;
  video_thruplays: number | null;
  search_impression_share: number | null;
  search_lost_is_budget: number | null;
  search_lost_is_rank: number | null;
};

const metricRow = (r: MetricColumns) => ({
  spend: num(r.spend),
  impressions: num(r.impressions),
  reach: opt(r.reach),
  clicks: num(r.clicks),
  linkClicks: opt(r.link_clicks),
  landingPageViews: opt(r.landing_page_views),
  addToCart: opt(r.add_to_cart),
  initiateCheckout: opt(r.initiate_checkout),
  conversions: num(r.conversions),
  conversionValue: num(r.conversion_value),
  videoViews: opt(r.video_views),
  videoThruplays: opt(r.video_thruplays),
  searchImpressionShare: opt(r.search_impression_share),
  searchLostIsBudget: opt(r.search_lost_is_budget),
  searchLostIsRank: opt(r.search_lost_is_rank),
});

type BasicColumns = { spend: number; impressions: number; clicks: number; conversions: number; conversion_value: number };
const basicRow = (r: BasicColumns) => ({ spend: num(r.spend), impressions: num(r.impressions), clicks: num(r.clicks), conversions: num(r.conversions), conversionValue: num(r.conversion_value) });

const BASIC_COLUMNS = "spend, impressions, clicks, conversions, conversion_value";

const BREAKDOWNS: Record<LivePlatform, string[]> = { meta: ["age_gender", "placement", "device", "region"], google: ["device", "hour"], import: [] };

async function fetchRows(db: DB, q: WarehouseQuery): Promise<WarehouseRows> {
  const ids = q.accountIds;
  const { current: cur, previous: prev } = q;
  const meta = q.platform === "meta";

  const [accountDaily, campaigns, campaignDaily, ads, adDaily, breakdownDaily, searchTermDaily, products, productDaily] = await Promise.all([
    // contas somadas por dia (mais de uma conta no mesmo dashboard)
    fetchAll((a, b) =>
      db.from("insights_account_daily").select(`ad_account_id, date, ${METRIC_COLUMNS}`).in("ad_account_id", ids).gte("date", prev.from).lte("date", cur.to).order("ad_account_id").order("date").range(a, b),
    ).then((rows): AccountDayRow[] => rows.map((r) => ({ date: r.date, ...metricRow(r) }))),
    fetchAll((a, b) => db.from("ad_campaigns").select("id, name, objective, status, channel, funnel_stage, daily_budget").in("ad_account_id", ids).order("id").range(a, b)).then((rows) =>
      rows.map((r) => ({ id: r.id, name: r.name, objective: r.objective, status: r.status, channel: r.channel, funnelStage: r.funnel_stage, dailyBudget: opt(r.daily_budget) })),
    ),
    fetchAll((a, b) =>
      db.from("insights_campaign_daily").select(`campaign_id, date, ${METRIC_COLUMNS}, all_conversions, interactions, top_impression_pct, absolute_top_impression_pct`).in("ad_account_id", ids).gte("date", prev.from).lte("date", cur.to).order("campaign_id").order("date").range(a, b),
    ).then((rows): CampaignDayRow[] => rows.map((r) => ({
        campaignId: r.campaign_id,
        date: r.date,
        ...metricRow(r),
        allConversions: opt(r.all_conversions),
        interactions: opt(r.interactions),
        topImpressionPct: opt(r.top_impression_pct),
        absoluteTopImpressionPct: opt(r.absolute_top_impression_pct),
      }))),
    meta
      ? fetchAll((a, b) => db.from("ads").select("id, campaign_id, name, format, status, headline, thumbnail_url, post_url").in("ad_account_id", ids).order("id").range(a, b)).then((rows) =>
          rows.map((r) => ({ id: r.id, campaignId: r.campaign_id, postUrl: r.post_url, name: r.name, format: r.format, status: r.status, headline: r.headline, thumbnailUrl: r.thumbnail_url })),
        )
      : [],
    meta
      ? fetchAll((a, b) =>
          db
            .from("insights_ad_daily")
            .select("ad_id, date, spend, impressions, reach, clicks, link_clicks, conversions, conversion_value, video_views, video_thruplays, leads, registrations, post_engagement, post_reactions, post_comments, post_shares, post_saves, profile_visits, video_p25, video_p50, video_p75, video_p95, video_p100, video_watch_seconds")
            .in("ad_account_id", ids)
            // os dois períodos: os cards que vêm dos anúncios comparam com o anterior
            .gte("date", prev.from)
            .lte("date", cur.to)
            .order("ad_id")
            .order("date")
            .range(a, b),
        ).then((rows): AdDayRow[] =>
          rows.map((r) => ({
            adId: r.ad_id,
            date: r.date,
            spend: num(r.spend),
            impressions: num(r.impressions),
            reach: opt(r.reach),
            clicks: num(r.clicks),
            linkClicks: opt(r.link_clicks),
            conversions: num(r.conversions),
            conversionValue: num(r.conversion_value),
            videoViews: opt(r.video_views),
            videoThruplays: opt(r.video_thruplays),
            leads: opt(r.leads),
            registrations: opt(r.registrations),
            postEngagement: opt(r.post_engagement),
            postReactions: opt(r.post_reactions),
            postComments: opt(r.post_comments),
            postShares: opt(r.post_shares),
            postSaves: opt(r.post_saves),
            profileVisits: opt(r.profile_visits),
            videoP25: opt(r.video_p25),
            videoP50: opt(r.video_p50),
            videoP75: opt(r.video_p75),
            videoP95: opt(r.video_p95),
            videoP100: opt(r.video_p100),
            videoWatchSeconds: opt(r.video_watch_seconds),
          })),
        )
      : [],
    fetchAll((a, b) =>
      db
        .from("insights_breakdown_daily")
        .select(`date, dimension, value, ${BASIC_COLUMNS}`)
        .in("ad_account_id", ids)
        .in("dimension", BREAKDOWNS[q.platform])
        .gte("date", cur.from)
        .lte("date", cur.to)
        .order("ad_account_id")
        .order("date")
        .order("dimension")
        .order("value")
        .range(a, b),
    ).then((rows): BreakdownDayRow[] => rows.map((r) => ({ date: r.date, dimension: r.dimension, value: r.value, ...basicRow(r) }))),
    meta
      ? []
      : fetchAll((a, b) =>
          db
            .from("insights_search_term_daily")
            .select(`campaign_id, date, search_term, match_type, ${BASIC_COLUMNS}`)
            .in("ad_account_id", ids)
            .gte("date", cur.from)
            .lte("date", cur.to)
            .order("campaign_id")
            .order("date")
            .order("search_term")
            .order("match_type")
            .range(a, b),
        ).then((rows): SearchTermDayRow[] => rows.map((r) => ({ campaignId: r.campaign_id, date: r.date, searchTerm: r.search_term, matchType: r.match_type, ...basicRow(r) }))),
    meta
      ? []
      : fetchAll((a, b) => db.from("ad_products").select("id, title, category, image_url, price").in("ad_account_id", ids).order("id").range(a, b)).then((rows) =>
          rows.map((r) => ({ id: r.id, title: r.title, category: r.category, imageUrl: r.image_url, price: opt(r.price) })),
        ),
    meta
      ? []
      : fetchAll((a, b) =>
          db.from("insights_product_daily").select(`product_id, date, ${BASIC_COLUMNS}`).in("ad_account_id", ids).gte("date", cur.from).lte("date", cur.to).order("product_id").order("date").range(a, b),
        ).then((rows): ProductDayRow[] => rows.map((r) => ({ productId: r.product_id, date: r.date, ...basicRow(r) }))),
  ]);

  return { platform: q.platform, current: cur, previous: prev, accountDaily, campaigns, campaignDaily, ads, adDaily, breakdownDaily, searchTermDaily, products, productDaily };
}
