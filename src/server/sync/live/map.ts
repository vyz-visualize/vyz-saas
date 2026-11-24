// Conversão pura das respostas do Meta e do Google para o AccountDataset.
// Sem rede e sem servidor: os testes cobrem estas funções com payloads reais.

import type { AccountDay, AdDay, AdEntity, AdFormat, BreakdownDay, BreakdownDimension, CampaignChannel, CampaignDay, CampaignEntity, DailyMetrics, EntityStatus } from "@/features/sync/dataset";
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

/** "123_456" (página_post) → https://www.facebook.com/123/posts/456. Fora desse formato: null. */
export function facebookPostUrl(storyId: string | undefined | null): string | null {
  const m = storyId?.match(/^(\d+)_(\d+)$/);
  return m ? `https://www.facebook.com/${m[1]}/posts/${m[2]}` : null;
}

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
    /** "<id da página>_<id do post>": o post do anúncio no Facebook. */
    effective_object_story_id?: string;
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
    // o post original: o do Instagram quando há; senão, o da Página no Facebook
    postUrl: c.instagram_permalink_url ?? facebookPostUrl(c.effective_object_story_id),
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
    leads: a.leads,
    messages: a.messages,
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
    messages: a.messages,
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
  segments?: { date?: string; device?: string; hour?: number | string };
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
    // o Google conta as conversões que a conta marcou como principais: não separa lead de compra
    leads: null,
    messages: null,
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
        leads: d.leads,
        messages: d.messages,
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
    cur.leads = add(cur.leads, d.leads);
    cur.messages = add(cur.messages, d.messages);
    cur.videoViews = add(cur.videoViews, d.videoViews);
    cur.videoThruplays = add(cur.videoThruplays, d.videoThruplays);
  }
  for (const [date, reach] of reachByDate) {
    const day = byDate.get(date);
    if (day) day.reach = reach;
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ---- Meta: quebras (posicionamento, estado, dispositivo, hora, idade e gênero) ------------------

/** As quebras pedidas à Meta, uma chamada cada (a Meta não combina essas quebras entre si). */
export const META_BREAKDOWNS = {
  placement: "publisher_platform,platform_position",
  region: "region",
  device: "impression_device",
  hour: "hourly_stats_aggregated_by_advertiser_time_zone",
  age_gender: "age,gender",
} as const satisfies Partial<Record<BreakdownDimension, string>>;
export type MetaBreakdownDimension = keyof typeof META_BREAKDOWNS;

export type MetaBreakdownRow = MetaInsight & {
  publisher_platform?: string;
  platform_position?: string;
  region?: string;
  impression_device?: string;
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
  age?: string;
  gender?: string;
};

const PLACEMENT_OF: Record<string, string> = {
  "facebook|feed": "facebook_feed",
  "facebook|facebook_reels": "facebook_reels",
  "facebook|facebook_reels_overlay": "facebook_reels",
  "facebook|marketplace": "facebook_marketplace",
  "facebook|facebook_stories": "facebook_stories",
  "facebook|video_feeds": "facebook_video_feeds",
  "facebook|search": "facebook_search",
  "facebook|instream_video": "facebook_instream_video",
  "facebook|right_hand_column": "facebook_right_column",
  "instagram|stream": "instagram_feed",
  "instagram|story": "instagram_stories",
  "instagram|reels": "instagram_reels",
  "instagram|instagram_reels": "instagram_reels",
  "instagram|explore": "instagram_explore",
  "instagram|explore_home": "instagram_explore",
  "instagram|profile_feed": "instagram_profile",
  "messenger|messenger_inbox": "messenger_inbox",
  "messenger|messenger_stories": "messenger_stories",
  "threads|threads_feed": "threads_feed",
};

const DEVICE_OF: Record<string, string> = { android_smartphone: "android", android_tablet: "tablet", iphone: "iphone", ipad: "tablet", ipod: "iphone", desktop: "desktop" };

const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
/** "São Paulo", "Sao Paulo (state)", "State of São Paulo" → "SP". Fora do Brasil (ou desconhecido): null. */
export function ufOf(region: string | undefined, states: Record<string, string>): string | null {
  if (!region) return null;
  const name = plain(region.replace(/\(state\)/i, "").replace(/^state of /i, "").replace(/^estado d[eo] /i, ""));
  if (name === "federal district" || name === "distrito federal") return "DF";
  for (const [uf, label] of Object.entries(states)) if (plain(label) === name) return uf;
  return null;
}

/** O valor da quebra na chave do VYZ (insights_breakdown_daily.value). Sem tradução: null (a linha sai). */
export function metaBreakdownValue(dim: MetaBreakdownDimension, r: MetaBreakdownRow, states: Record<string, string>): string | null {
  switch (dim) {
    case "placement": {
      const pub = (r.publisher_platform ?? "").toLowerCase();
      if (!pub) return null;
      if (pub === "audience_network") return "audience_network";
      return PLACEMENT_OF[`${pub}|${(r.platform_position ?? "").toLowerCase()}`] ?? `${pub}_outros`;
    }
    case "region":
      return ufOf(r.region, states);
    case "device":
      return r.impression_device ? (DEVICE_OF[r.impression_device.toLowerCase()] ?? "other") : null;
    case "hour": {
      const h = r.hourly_stats_aggregated_by_advertiser_time_zone?.slice(0, 2);
      return h && /^\d\d$/.test(h) && Number(h) < 24 ? h : null;
    }
    case "age_gender": {
      const age = r.age ?? "";
      const gender = (r.gender ?? "").toLowerCase();
      if (!/^(18-24|25-34|35-44|45-54|55-64|65\+)$/.test(age)) return null;
      return `${age}|${gender === "female" || gender === "male" ? gender : "unknown"}`;
    }
  }
}

/** As linhas de uma quebra, somadas por dia e valor (Android tablet e iPad viram o mesmo "tablet"). */
export function mapMetaBreakdown(dim: MetaBreakdownDimension, rows: readonly MetaBreakdownRow[], states: Record<string, string>): BreakdownDay[] {
  const out = new Map<string, BreakdownDay>();
  for (const r of rows) {
    const value = metaBreakdownValue(dim, r, states);
    if (!value || !r.date_start) continue;
    const m = metaDailyMetrics(r);
    const key = `${r.date_start}|${value}`;
    const prev = out.get(key);
    out.set(key, {
      date: r.date_start,
      dimension: dim,
      value,
      spend: money((prev?.spend ?? 0) + m.spend),
      impressions: (prev?.impressions ?? 0) + m.impressions,
      clicks: (prev?.clicks ?? 0) + m.clicks,
      conversions: (prev?.conversions ?? 0) + m.conversions,
      conversionValue: money((prev?.conversionValue ?? 0) + m.conversionValue),
      leads: m.leads === null && (prev?.leads ?? null) === null ? null : (prev?.leads ?? 0) + (m.leads ?? 0),
      messages: m.messages === null && (prev?.messages ?? null) === null ? null : (prev?.messages ?? 0) + (m.messages ?? 0),
    });
  }
  return [...out.values()];
}

// ---- Google: quebras (dispositivo e hora) ----------------------------------------------------------

const GOOGLE_DEVICE: Record<string, string> = { MOBILE: "mobile", DESKTOP: "desktop", TABLET: "tablet", CONNECTED_TV: "connected_tv" };

/** Dispositivo ou hora por dia (a soma das campanhas), na chave do VYZ. */
export function mapGoogleBreakdown(dim: "device" | "hour", rows: readonly GoogleRow[]): BreakdownDay[] {
  const out = new Map<string, BreakdownDay>();
  for (const r of rows) {
    const date = r.segments?.date;
    if (!date) continue;
    const raw = dim === "device" ? r.segments?.device : r.segments?.hour;
    const value =
      dim === "device"
        ? GOOGLE_DEVICE[String(raw ?? "").toUpperCase()] ?? (raw ? "other" : null)
        : raw !== undefined && raw !== null && Number(raw) >= 0 && Number(raw) < 24
          ? String(Number(raw)).padStart(2, "0")
          : null;
    if (!value) continue;
    const m = googleMetrics(r.metrics ?? {});
    const key = `${date}|${value}`;
    const prev = out.get(key);
    out.set(key, {
      date,
      dimension: dim,
      value,
      spend: money((prev?.spend ?? 0) + m.spend),
      impressions: (prev?.impressions ?? 0) + m.impressions,
      clicks: (prev?.clicks ?? 0) + m.clicks,
      conversions: money((prev?.conversions ?? 0) + m.conversions),
      conversionValue: money((prev?.conversionValue ?? 0) + m.conversionValue),
    });
  }
  return [...out.values()];
}
