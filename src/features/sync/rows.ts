// Do conjunto de dados para as linhas do armazém (as colunas do banco). A
// gravação (src/server/sync) troca os ids externos pelos uuids do banco; uma
// prévia pode usar os próprios ids externos como ids.

import type { TablesInsert } from "@/lib/supabase/database.types";
import type { AccountDataset, BasicMetrics, DailyMetrics } from "./dataset";

export type RowScope = { workspaceId: string; adAccountId: string; syncedAt: string };

/** id externo → id no banco. Lança se não encontrar (conjunto incoerente). */
export type IdLookup = (externalId: string) => string;

export type EntityIds = { campaign: IdLookup; ad: IdLookup; product: IdLookup };

export function campaignRows(ds: AccountDataset, scope: Omit<RowScope, "syncedAt">): TablesInsert<"ad_campaigns">[] {
  return ds.campaigns.map((c) => ({
    workspace_id: scope.workspaceId,
    ad_account_id: scope.adAccountId,
    external_id: c.externalId,
    name: c.name,
    status: c.status,
    objective: c.objective,
    channel: c.channel,
    funnel_stage: c.funnelStage,
    daily_budget: c.dailyBudget,
    started_on: c.startedOn,
  }));
}

export function adRows(ds: AccountDataset, scope: Omit<RowScope, "syncedAt">, campaignId: IdLookup): TablesInsert<"ads">[] {
  return ds.ads.map((a) => ({
    workspace_id: scope.workspaceId,
    ad_account_id: scope.adAccountId,
    campaign_id: campaignId(a.campaignExternalId),
    external_id: a.externalId,
    name: a.name,
    format: a.format,
    status: a.status,
    headline: a.headline,
    body: a.body,
    call_to_action: a.callToAction,
    thumbnail_url: a.thumbnailUrl,
    landing_url: a.landingUrl,
    post_url: a.postUrl ?? null,
  }));
}

export function productRows(ds: AccountDataset, scope: Omit<RowScope, "syncedAt">): TablesInsert<"ad_products">[] {
  return ds.products.map((p) => ({
    workspace_id: scope.workspaceId,
    ad_account_id: scope.adAccountId,
    external_id: p.externalId,
    title: p.title,
    brand: p.brand,
    category: p.category,
    image_url: p.imageUrl,
    price: p.price,
  }));
}

// ---- fatos ----------------------------------------------------------------------------

export type FactTable = "insights_campaign_daily" | "insights_ad_daily" | "insights_breakdown_daily" | "insights_search_term_daily" | "insights_product_daily";

/** Chave primária de cada tabela de fatos (é o onConflict do upsert). */
export const FACT_KEYS = {
  insights_campaign_daily: ["campaign_id", "date"],
  insights_ad_daily: ["ad_id", "date"],
  insights_breakdown_daily: ["ad_account_id", "date", "dimension", "value"],
  insights_search_term_daily: ["campaign_id", "date", "search_term", "match_type"],
  insights_product_daily: ["product_id", "date"],
} as const satisfies Record<FactTable, readonly string[]>;

export const FACT_TABLES = Object.keys(FACT_KEYS) as FactTable[];

export type FactRows = { [T in FactTable]: TablesInsert<T>[] };

const metricColumns = (m: DailyMetrics) => ({
  spend: m.spend,
  impressions: m.impressions,
  reach: m.reach,
  clicks: m.clicks,
  link_clicks: m.linkClicks,
  landing_page_views: m.landingPageViews,
  add_to_cart: m.addToCart,
  initiate_checkout: m.initiateCheckout,
  conversions: m.conversions,
  conversion_value: m.conversionValue,
  video_views: m.videoViews,
  video_thruplays: m.videoThruplays,
  search_impression_share: m.searchImpressionShare,
  search_lost_is_budget: m.searchLostIsBudget,
  search_lost_is_rank: m.searchLostIsRank,
});

const basicColumns = (m: BasicMetrics) => ({
  spend: m.spend,
  impressions: m.impressions,
  clicks: m.clicks,
  conversions: m.conversions,
  conversion_value: m.conversionValue,
});

/** Uma linha por chave (a última vence): o upsert do Postgres não aceita a mesma chave duas vezes no lote. */
function uniqueBy<T extends object>(rows: T[], key: readonly (keyof T)[]): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) seen.set(key.map((k) => String(row[k])).join("\u0000"), row);
  return seen.size === rows.length ? rows : [...seen.values()];
}

export function factRows(ds: AccountDataset, scope: RowScope, ids: EntityIds): FactRows {
  const base = { workspace_id: scope.workspaceId, ad_account_id: scope.adAccountId, synced_at: scope.syncedAt };
  return {
    insights_campaign_daily: uniqueBy(
      ds.campaignDaily.map((r) => ({
        ...base,
        campaign_id: ids.campaign(r.campaignExternalId),
        date: r.date,
        ...metricColumns(r),
        all_conversions: r.allConversions ?? null,
        interactions: r.interactions ?? null,
        top_impression_pct: r.topImpressionPct ?? null,
        absolute_top_impression_pct: r.absoluteTopImpressionPct ?? null,
      })),
      FACT_KEYS.insights_campaign_daily,
    ),
    insights_ad_daily: uniqueBy(
      ds.adDaily.map((r) => ({
        ...base,
        ad_id: ids.ad(r.adExternalId),
        date: r.date,
        spend: r.spend,
        impressions: r.impressions,
        reach: r.reach,
        clicks: r.clicks,
        link_clicks: r.linkClicks,
        conversions: r.conversions,
        conversion_value: r.conversionValue,
        video_views: r.videoViews,
        video_thruplays: r.videoThruplays,
        leads: r.leads ?? null,
        registrations: r.registrations ?? null,
        post_engagement: r.postEngagement ?? null,
        post_reactions: r.postReactions ?? null,
        post_comments: r.postComments ?? null,
        post_shares: r.postShares ?? null,
        post_saves: r.postSaves ?? null,
        profile_visits: r.profileVisits ?? null,
        video_p25: r.videoP25 ?? null,
        video_p50: r.videoP50 ?? null,
        video_p75: r.videoP75 ?? null,
        video_p95: r.videoP95 ?? null,
        video_p100: r.videoP100 ?? null,
        video_watch_seconds: r.videoWatchSeconds ?? null,
      })),
      FACT_KEYS.insights_ad_daily,
    ),
    insights_breakdown_daily: uniqueBy(
      ds.breakdownDaily.map((r) => ({ ...base, date: r.date, dimension: r.dimension, value: r.value, ...basicColumns(r) })),
      FACT_KEYS.insights_breakdown_daily,
    ),
    insights_search_term_daily: uniqueBy(
      ds.searchTermDaily.map((r) => ({ ...base, campaign_id: ids.campaign(r.campaignExternalId), date: r.date, search_term: r.searchTerm, match_type: r.matchType, ...basicColumns(r) })),
      FACT_KEYS.insights_search_term_daily,
    ),
    insights_product_daily: uniqueBy(
      ds.productDaily.map((r) => ({ ...base, product_id: ids.product(r.productExternalId), date: r.date, ...basicColumns(r) })),
      FACT_KEYS.insights_product_daily,
    ),
  };
}

/** Linhas de insights_account_daily (o banco calcula as dele; isto serve às prévias). */
export function accountDailyRows(ds: AccountDataset, scope: RowScope): TablesInsert<"insights_account_daily">[] {
  return ds.accountDaily.map((r) => ({ workspace_id: scope.workspaceId, ad_account_id: scope.adAccountId, synced_at: scope.syncedAt, date: r.date, ...metricColumns(r) }));
}

/**
 * Alcance da conta por dia (nível account, pessoas únicas), para gravar depois
 * do rollup do banco. Só os dias em que a fonte trouxe o número.
 */
export function accountReachRows(ds: AccountDataset, scope: RowScope): (TablesInsert<"insights_account_daily"> & { reach: number })[] {
  return ds.accountDaily.flatMap((r) => (r.reach == null ? [] : [{ workspace_id: scope.workspaceId, ad_account_id: scope.adAccountId, date: r.date, reach: r.reach, synced_at: scope.syncedAt }]));
}

/** Busca de ids a partir das linhas devolvidas pelo upsert das entidades. */
export function idLookup(kind: string, rows: readonly { id: string; external_id: string }[]): IdLookup {
  const map = new Map(rows.map((r) => [r.external_id, r.id]));
  return (externalId) => {
    const id = map.get(externalId);
    if (!id) throw new Error(`${kind} ${externalId} não está entre as entidades gravadas.`);
    return id;
  };
}
