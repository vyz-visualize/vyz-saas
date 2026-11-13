// Conversão pura das respostas do Meta e do Google para o AccountDataset.
// Sem rede e sem servidor: os testes cobrem estas funções com payloads reais.

import type { AccountDay, AdDay, AdEntity, AdFormat, CampaignChannel, CampaignDay, CampaignEntity, DailyMetrics, EntityStatus } from "@/features/sync/dataset";
import { readMetaActions, type MetaAction } from "@/features/sync/meta-actions";

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => (v === undefined || v === null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const money = (v: number) => Math.round(v * 100) / 100;
const share = (v: unknown): number | null => {
  const n = numOrNull(v);
  if (n === null) return null;
  return Math.min(1, Math.max(0, n));
};

// ---- Meta ------------------------------------------------------------------------

export type MetaCampaign = { id: string; name?: string; effective_status?: string; status?: string; objective?: string; daily_budget?: string; start_time?: string };
export type MetaAd = {
  id: string;
  name?: string;
  campaign_id?: string;
  effective_status?: string;
  creative?: {
    title?: string;
    body?: string;
    call_to_action_type?: string;
    thumbnail_url?: string;
    image_url?: string;
    object_url?: string;
    link_url?: string;
    video_id?: string;
    object_type?: string;
    instagram_permalink_url?: string;
    object_story_spec?: { link_data?: { child_attachments?: unknown[] } };
  };
};
export type MetaInsight = {
  date_start: string;
  campaign_id?: string;
  ad_id?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  video_thruplay_watched_actions?: MetaAction[];
  video_p25_watched_actions?: MetaAction[];
  video_p50_watched_actions?: MetaAction[];
  video_p75_watched_actions?: MetaAction[];
  video_p95_watched_actions?: MetaAction[];
  video_p100_watched_actions?: MetaAction[];
};

export function metaStatus(s: string | undefined): EntityStatus {
  switch ((s ?? "").toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "ARCHIVED":
      return "archived";
    case "DELETED":
      return "removed";
    default:
      return "paused";
  }
}

/** Orçamento do Meta vem em centavos da moeda da conta. */
export const metaBudget = (v: string | undefined) => (v ? money(num(v) / 100) : null);

export function mapMetaCampaign(c: MetaCampaign): CampaignEntity {
  return {
    externalId: c.id,
    name: (c.name ?? `Campanha ${c.id}`).slice(0, 200),
    status: metaStatus(c.effective_status ?? c.status),
    objective: c.objective ?? null,
    channel: null,
    funnelStage: null,
    dailyBudget: metaBudget(c.daily_budget),
    startedOn: c.start_time ? c.start_time.slice(0, 10) : null,
  };
}

function metaFormat(ad: MetaAd): AdFormat {
  const t = (ad.creative?.object_type ?? "").toUpperCase();
  if ((ad.creative?.object_story_spec?.link_data?.child_attachments?.length ?? 0) > 1) return "carousel";
  if (ad.creative?.video_id || t === "VIDEO") return "video";
  if (t === "SHARE" || t === "PHOTO" || ad.creative?.image_url) return "image";
  return "image";
}

export function mapMetaAd(ad: MetaAd): AdEntity | null {
  if (!ad.campaign_id) return null;
  const c = ad.creative ?? {};
  return {
    externalId: ad.id,
    campaignExternalId: ad.campaign_id,
    name: (ad.name ?? `Anúncio ${ad.id}`).slice(0, 200),
    format: metaFormat(ad),
    status: metaStatus(ad.effective_status),
    headline: c.title ?? null,
    body: c.body ?? null,
    callToAction: c.call_to_action_type ?? null,
    thumbnailUrl: c.thumbnail_url ?? c.image_url ?? null,
    landingUrl: c.link_url ?? c.object_url ?? null,
    postUrl: c.instagram_permalink_url ?? null,
  };
}

/** Valor do primeiro (e único) item de uma lista de ações do vídeo. */
const videoAction = (list: MetaAction[] | undefined) => (list && list.length ? numOrNull(list[0].value) : null);

export function metaDailyMetrics(row: MetaInsight): DailyMetrics {
  const a = readMetaActions(row.actions);
  const v = readMetaActions(row.action_values);
  return {
    spend: money(num(row.spend)),
    impressions: num(row.impressions),
    reach: numOrNull(row.reach),
    clicks: num(row.clicks),
    linkClicks: a.linkClicks,
    landingPageViews: a.landingPageViews,
    addToCart: a.addToCart,
    initiateCheckout: a.initiateCheckout,
    conversions: a.conversions ?? 0,
    conversionValue: money(v.conversions ?? 0),
    videoViews: a.videoViews,
    videoThruplays: videoAction(row.video_thruplay_watched_actions),
    searchImpressionShare: null,
    searchLostIsBudget: null,
    searchLostIsRank: null,
  };
}

export function mapMetaCampaignDay(row: MetaInsight): CampaignDay | null {
  if (!row.campaign_id) return null;
  return { ...metaDailyMetrics(row), campaignExternalId: row.campaign_id, date: row.date_start };
}

export function mapMetaAdDay(row: MetaInsight): AdDay | null {
  if (!row.ad_id) return null;
  const m = metaDailyMetrics(row);
  const a = readMetaActions(row.actions);
  return {
    adExternalId: row.ad_id,
    date: row.date_start,
    spend: m.spend,
    impressions: m.impressions,
    reach: m.reach,
    clicks: m.clicks,
    linkClicks: m.linkClicks,
    conversions: m.conversions,
    conversionValue: m.conversionValue,
    videoViews: m.videoViews,
    videoThruplays: m.videoThruplays,
    leads: a.leads,
    registrations: a.registrations,
    postEngagement: a.postEngagement,
    postReactions: a.postReactions,
    postComments: a.postComments,
    postShares: a.postShares,
    postSaves: a.postSaves,
    videoP25: videoAction(row.video_p25_watched_actions),
    videoP50: videoAction(row.video_p50_watched_actions),
    videoP75: videoAction(row.video_p75_watched_actions),
    videoP95: videoAction(row.video_p95_watched_actions),
    videoP100: videoAction(row.video_p100_watched_actions),
  };
}

// ---- Google ----------------------------------------------------------------------

export type GoogleRow = {
  campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string; startDate?: string; /** v26: "2025-09-11 09:25:31" (start_date não existe mais). */ startDateTime?: string };
  campaignBudget?: { amountMicros?: string; explicitlyShared?: boolean };
  adGroupAd?: {
    status?: string;
    ad?: { id?: string; name?: string; type?: string; finalUrls?: string[]; responsiveSearchAd?: { headlines?: { text?: string }[]; descriptions?: { text?: string }[] } };
  };
  segments?: { date?: string };
  metrics?: {
    costMicros?: string;
    impressions?: string;
    clicks?: string;
    conversions?: number | string;
    conversionsValue?: number | string;
    allConversions?: number | string;
    interactions?: string;
    /** Na v26 da API o campo chama video_trueview_views (video_views não existe mais). */
    videoTrueviewViews?: string;
    videoViews?: string;
    searchImpressionShare?: number | string;
    searchBudgetLostImpressionShare?: number | string;
    searchRankLostImpressionShare?: number | string;
    topImpressionPercentage?: number | string;
    absoluteTopImpressionPercentage?: number | string;
  };
};

export function googleStatus(s: string | undefined): EntityStatus {
  switch ((s ?? "").toUpperCase()) {
    case "ENABLED":
      return "active";
    case "REMOVED":
      return "removed";
    default:
      return "paused";
  }
}

const CHANNELS: Record<string, CampaignChannel> = {
  SEARCH: "search",
  PERFORMANCE_MAX: "performance_max",
  SHOPPING: "shopping",
  DISPLAY: "display",
  VIDEO: "video",
  DEMAND_GEN: "demand_gen",
  DISCOVERY: "demand_gen",
  MULTI_CHANNEL: "app",
};

export const micros = (v: unknown) => money(num(v) / 1e6);

export function mapGoogleCampaign(r: GoogleRow): CampaignEntity | null {
  const c = r.campaign;
  if (!c?.id) return null;
  const shared = r.campaignBudget?.explicitlyShared === true;
  return {
    externalId: c.id,
    name: (c.name ?? `Campanha ${c.id}`).slice(0, 200),
    status: googleStatus(c.status),
    objective: null,
    channel: CHANNELS[(c.advertisingChannelType ?? "").toUpperCase()] ?? null,
    funnelStage: null,
    dailyBudget: shared || !r.campaignBudget?.amountMicros ? null : micros(r.campaignBudget.amountMicros),
    startedOn: (c.startDateTime ?? c.startDate)?.slice(0, 10) ?? null,
  };
}

function googleMetrics(m: GoogleRow["metrics"] = {}): DailyMetrics {
  return {
    spend: micros(m.costMicros),
    impressions: num(m.impressions),
    reach: null,
    clicks: num(m.clicks),
    linkClicks: null,
    landingPageViews: null,
    addToCart: null,
    initiateCheckout: null,
    conversions: Math.round(num(m.conversions) * 100) / 100,
    conversionValue: money(num(m.conversionsValue)),
    videoViews: numOrNull(m.videoTrueviewViews ?? m.videoViews),
    videoThruplays: null,
    searchImpressionShare: share(m.searchImpressionShare),
    searchLostIsBudget: share(m.searchBudgetLostImpressionShare),
    searchLostIsRank: share(m.searchRankLostImpressionShare),
  };
}

export function mapGoogleCampaignDay(r: GoogleRow): CampaignDay | null {
  if (!r.campaign?.id || !r.segments?.date) return null;
  const m = r.metrics ?? {};
  return {
    ...googleMetrics(m),
    campaignExternalId: r.campaign.id,
    date: r.segments.date,
    allConversions: numOrNull(m.allConversions),
    interactions: numOrNull(m.interactions),
    topImpressionPct: share(m.topImpressionPercentage),
    absoluteTopImpressionPct: share(m.absoluteTopImpressionPercentage),
  };
}

function googleFormat(type: string | undefined): AdFormat {
  const t = (type ?? "").toUpperCase();
  if (t.includes("VIDEO")) return "video";
  if (t.includes("SHOPPING")) return "shopping";
  if (t.includes("RESPONSIVE")) return "responsive";
  if (t.includes("IMAGE")) return "image";
  return "text";
}

export function mapGoogleAd(r: GoogleRow): AdEntity | null {
  const ad = r.adGroupAd?.ad;
  if (!ad?.id || !r.campaign?.id) return null;
  const rsa = ad.responsiveSearchAd;
  return {
    externalId: ad.id,
    campaignExternalId: r.campaign.id,
    name: (ad.name || rsa?.headlines?.[0]?.text || `Anúncio ${ad.id}`).slice(0, 200),
    format: googleFormat(ad.type),
    status: googleStatus(r.adGroupAd?.status),
    headline: rsa?.headlines?.[0]?.text ?? null,
    body: rsa?.descriptions?.[0]?.text ?? null,
    callToAction: null,
    thumbnailUrl: null,
    landingUrl: ad.finalUrls?.[0] ?? null,
  };
}

export function mapGoogleAdDay(r: GoogleRow): AdDay | null {
  const id = r.adGroupAd?.ad?.id;
  if (!id || !r.segments?.date) return null;
  const m = googleMetrics(r.metrics);
  return {
    adExternalId: id,
    date: r.segments.date,
    spend: m.spend,
    impressions: m.impressions,
    reach: null,
    clicks: m.clicks,
    linkClicks: null,
    conversions: m.conversions,
    conversionValue: m.conversionValue,
    videoViews: m.videoViews,
    videoThruplays: null,
  };
}

// ---- total da conta ------------------------------------------------------------------

/** Soma das campanhas por dia. O alcance (pessoas únicas) não soma: vem à parte ou fica null. */
export function sumAccountDays(days: CampaignDay[], reachByDate: Map<string, number> = new Map()): AccountDay[] {
  const byDate = new Map<string, AccountDay>();
  const add = (a: number | null, b: number | null) => (a === null && b === null ? null : (a ?? 0) + (b ?? 0));
  for (const d of days) {
    const cur = byDate.get(d.date);
    if (!cur) {
      byDate.set(d.date, {
        date: d.date,
        spend: d.spend,
        impressions: d.impressions,
        reach: null,
        clicks: d.clicks,
        linkClicks: d.linkClicks,
        landingPageViews: d.landingPageViews,
        addToCart: d.addToCart,
        initiateCheckout: d.initiateCheckout,
        conversions: d.conversions,
        conversionValue: d.conversionValue,
        videoViews: d.videoViews,
        videoThruplays: d.videoThruplays,
        searchImpressionShare: null,
        searchLostIsBudget: null,
        searchLostIsRank: null,
      });
      continue;
    }
    cur.spend = money(cur.spend + d.spend);
    cur.impressions += d.impressions;
    cur.clicks += d.clicks;
    cur.linkClicks = add(cur.linkClicks, d.linkClicks);
    cur.landingPageViews = add(cur.landingPageViews, d.landingPageViews);
    cur.addToCart = add(cur.addToCart, d.addToCart);
    cur.initiateCheckout = add(cur.initiateCheckout, d.initiateCheckout);
    cur.conversions = Math.round((cur.conversions + d.conversions) * 100) / 100;
    cur.conversionValue = money(cur.conversionValue + d.conversionValue);
    cur.videoViews = add(cur.videoViews, d.videoViews);
    cur.videoThruplays = add(cur.videoThruplays, d.videoThruplays);
  }
  for (const [date, reach] of reachByDate) {
    const day = byDate.get(date);
    if (day) day.reach = reach;
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
