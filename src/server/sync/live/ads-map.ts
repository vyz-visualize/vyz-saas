// Mapeadores puros do TikTok Ads e do LinkedIn Ads para o formato do armazém
// (AccountDataset). Sem rede: testados em ads-map.test.ts.

import type { AdDay, AdEntity, AdFormat, CampaignDay, CampaignEntity, EntityStatus } from "@/features/sync/dataset";

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const optNum = (v: unknown): number | null => (v === undefined || v === null || v === "" || v === "-" ? null : num(v));
const money = (v: unknown) => Math.round(num(v) * 100) / 100;
const int = (v: unknown) => Math.round(num(v));

/** Dia sem nada: quem chega aqui não gera linha no armazém. */
const isEmptyDay = (d: { spend: number; impressions: number; clicks: number; conversions: number }) => !d.spend && !d.impressions && !d.clicks && !d.conversions;

// ---- TikTok (Business API v1.3) -------------------------------------------------------------

export type TikTokCampaign = {
  campaign_id: string | number;
  campaign_name?: string;
  operation_status?: string;
  secondary_status?: string;
  objective_type?: string;
  budget?: number | string;
  budget_mode?: string;
  create_time?: string;
};

export type TikTokAd = {
  ad_id: string | number;
  ad_name?: string;
  campaign_id: string | number;
  operation_status?: string;
  secondary_status?: string;
  ad_format?: string;
  ad_text?: string;
  call_to_action?: string;
  landing_page_url?: string;
  video_id?: string | null;
  image_ids?: string[] | null;
};

export type TikTokReportRow = {
  dimensions: { campaign_id?: string | number; ad_id?: string | number; stat_time_day?: string };
  metrics: Record<string, string | number | null | undefined>;
};

function tiktokStatus(operation?: string, secondary?: string): EntityStatus {
  const s = (secondary ?? "").toUpperCase();
  if (s.includes("DELETE")) return "removed";
  if ((operation ?? "").toUpperCase() === "ENABLE") return "active";
  return "paused";
}

export function mapTikTokCampaign(c: TikTokCampaign): CampaignEntity {
  const id = String(c.campaign_id);
  return {
    externalId: id,
    name: (c.campaign_name ?? `Campanha ${id}`).slice(0, 200),
    status: tiktokStatus(c.operation_status, c.secondary_status),
    objective: c.objective_type ?? null,
    channel: null,
    funnelStage: null,
    dailyBudget: c.budget_mode === "BUDGET_MODE_DAY" && num(c.budget) > 0 ? money(c.budget) : null,
    startedOn: c.create_time ? c.create_time.slice(0, 10) : null,
  };
}

function tiktokFormat(ad: TikTokAd): AdFormat {
  const f = (ad.ad_format ?? "").toUpperCase();
  if (f.includes("CAROUSEL")) return "carousel";
  if (f.includes("VIDEO") || ad.video_id) return "video";
  return "image";
}

export function mapTikTokAd(ad: TikTokAd, thumbnails: Map<string, string> = new Map()): AdEntity {
  const id = String(ad.ad_id);
  return {
    externalId: id,
    campaignExternalId: String(ad.campaign_id),
    name: (ad.ad_name ?? `Anúncio ${id}`).slice(0, 200),
    format: tiktokFormat(ad),
    status: tiktokStatus(ad.operation_status, ad.secondary_status),
    headline: null,
    body: ad.ad_text?.slice(0, 2000) || null,
    callToAction: ad.call_to_action || null,
    thumbnailUrl: (ad.video_id && thumbnails.get(ad.video_id)) || null,
    landingUrl: ad.landing_page_url || null,
  };
}

/** "2026-11-01 00:00:00" → "2026-11-01". */
const tiktokDate = (v?: string) => (v ? v.slice(0, 10) : "");

function tiktokMetrics(m: TikTokReportRow["metrics"]) {
  const purchases = optNum(m.complete_payment);
  return {
    spend: money(m.spend),
    impressions: int(m.impressions),
    reach: optNum(m.reach) === null ? null : int(m.reach),
    clicks: int(m.clicks),
    conversions: purchases !== null && purchases > 0 ? purchases : num(m.conversion),
    conversionValue: money(m.total_complete_payment_rate),
    videoViews: optNum(m.video_play_actions) === null ? null : int(m.video_play_actions),
    videoThruplays: optNum(m.video_views_p100) === null ? null : int(m.video_views_p100),
  };
}

export function mapTikTokCampaignDay(r: TikTokReportRow): CampaignDay | null {
  const id = r.dimensions.campaign_id;
  const date = tiktokDate(r.dimensions.stat_time_day);
  if (id === undefined || !date) return null;
  const m = tiktokMetrics(r.metrics);
  const day: CampaignDay = {
    campaignExternalId: String(id),
    date,
    ...m,
    linkClicks: m.clicks,
    landingPageViews: null,
    addToCart: null,
    initiateCheckout: null,
    searchImpressionShare: null,
    searchLostIsBudget: null,
    searchLostIsRank: null,
  };
  return isEmptyDay(day) ? null : day;
}

export function mapTikTokAdDay(r: TikTokReportRow): AdDay | null {
  const id = r.dimensions.ad_id;
  const date = tiktokDate(r.dimensions.stat_time_day);
  if (id === undefined || !date) return null;
  const m = tiktokMetrics(r.metrics);
  const day: AdDay = {
    adExternalId: String(id),
    date,
    ...m,
    linkClicks: m.clicks,
    postReactions: optNum(r.metrics.likes),
    postComments: optNum(r.metrics.comments),
    postShares: optNum(r.metrics.shares),
    videoP25: optNum(r.metrics.video_views_p25),
    videoP50: optNum(r.metrics.video_views_p50),
    videoP75: optNum(r.metrics.video_views_p75),
    videoP100: optNum(r.metrics.video_views_p100),
  };
  return isEmptyDay(day) ? null : day;
}

// ---- LinkedIn (Marketing API, REST versionada) -------------------------------------------------

export type LinkedInCampaign = {
  id: number | string;
  name?: string;
  status?: string;
  objectiveType?: string;
  dailyBudget?: { amount?: string; currencyCode?: string };
  runSchedule?: { start?: number; end?: number };
};

export type LinkedInCreative = {
  id: string;
  campaign?: string;
  intendedStatus?: string;
  name?: string;
  content?: { reference?: string; textAd?: { headline?: string; description?: string; landingPage?: string } };
};

export type LinkedInDate = { year: number; month: number; day: number };

export type LinkedInAnalyticsRow = {
  dateRange?: { start?: LinkedInDate };
  pivotValues?: string[];
  costInLocalCurrency?: string | number;
  impressions?: number;
  clicks?: number;
  landingPageClicks?: number;
  externalWebsiteConversions?: number;
  conversionValueInLocalCurrency?: string | number;
  oneClickLeads?: number;
  videoViews?: number;
  videoCompletions?: number;
  videoFirstQuartileCompletions?: number;
  videoMidpointCompletions?: number;
  videoThirdQuartileCompletions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  approximateMemberReach?: number;
};

/** "urn:li:sponsoredCampaign:123" → "123". */
export const urnId = (urn: string | number | undefined) => String(urn ?? "").split(":").pop() ?? "";

const pad = (n: number) => String(n).padStart(2, "0");
export const linkedinDate = (d?: LinkedInDate) => (d ? `${d.year}-${pad(d.month)}-${pad(d.day)}` : "");

function linkedinStatus(s?: string): EntityStatus {
  switch ((s ?? "").toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "ARCHIVED":
    case "COMPLETED":
      return "archived";
    case "CANCELED":
    case "REMOVED":
      return "removed";
    default:
      return "paused";
  }
}

export function mapLinkedInCampaign(c: LinkedInCampaign): CampaignEntity {
  const id = urnId(c.id);
  const start = c.runSchedule?.start;
  return {
    externalId: id,
    name: (c.name ?? `Campanha ${id}`).slice(0, 200),
    status: linkedinStatus(c.status),
    objective: c.objectiveType ?? null,
    channel: null,
    funnelStage: null,
    dailyBudget: c.dailyBudget?.amount && num(c.dailyBudget.amount) > 0 ? money(c.dailyBudget.amount) : null,
    startedOn: start ? new Date(start).toISOString().slice(0, 10) : null,
  };
}

export function mapLinkedInCreative(c: LinkedInCreative): AdEntity | null {
  const id = urnId(c.id);
  const campaign = urnId(c.campaign);
  if (!id || !campaign) return null;
  const ref = c.content?.reference ?? "";
  return {
    externalId: id,
    campaignExternalId: campaign,
    name: (c.name || c.content?.textAd?.headline || `Anúncio ${id}`).slice(0, 200),
    format: c.content?.textAd ? "text" : ref.includes("video") ? "video" : "image",
    status: linkedinStatus(c.intendedStatus),
    headline: c.content?.textAd?.headline ?? null,
    body: c.content?.textAd?.description ?? null,
    callToAction: null,
    thumbnailUrl: null,
    landingUrl: c.content?.textAd?.landingPage ?? null,
  };
}

function linkedinMetrics(r: LinkedInAnalyticsRow) {
  return {
    spend: money(r.costInLocalCurrency),
    impressions: int(r.impressions),
    clicks: int(r.clicks),
    conversions: int(r.externalWebsiteConversions) + int(r.oneClickLeads),
    conversionValue: money(r.conversionValueInLocalCurrency),
    videoViews: r.videoViews === undefined ? null : int(r.videoViews),
    videoThruplays: r.videoCompletions === undefined ? null : int(r.videoCompletions),
  };
}

export function mapLinkedInCampaignDay(r: LinkedInAnalyticsRow): CampaignDay | null {
  const id = urnId(r.pivotValues?.[0]);
  const date = linkedinDate(r.dateRange?.start);
  if (!id || !date) return null;
  const m = linkedinMetrics(r);
  const day: CampaignDay = {
    campaignExternalId: id,
    date,
    ...m,
    reach: null,
    linkClicks: r.landingPageClicks === undefined ? null : int(r.landingPageClicks),
    landingPageViews: null,
    addToCart: null,
    initiateCheckout: null,
    searchImpressionShare: null,
    searchLostIsBudget: null,
    searchLostIsRank: null,
  };
  return isEmptyDay(day) ? null : day;
}

export function mapLinkedInCreativeDay(r: LinkedInAnalyticsRow): AdDay | null {
  const id = urnId(r.pivotValues?.[0]);
  const date = linkedinDate(r.dateRange?.start);
  if (!id || !date) return null;
  const m = linkedinMetrics(r);
  const day: AdDay = {
    adExternalId: id,
    date,
    ...m,
    reach: null,
    linkClicks: r.landingPageClicks === undefined ? null : int(r.landingPageClicks),
    leads: r.oneClickLeads === undefined ? null : int(r.oneClickLeads),
    postReactions: r.likes === undefined ? null : int(r.likes),
    postComments: r.comments === undefined ? null : int(r.comments),
    postShares: r.shares === undefined ? null : int(r.shares),
    videoP25: r.videoFirstQuartileCompletions === undefined ? null : int(r.videoFirstQuartileCompletions),
    videoP50: r.videoMidpointCompletions === undefined ? null : int(r.videoMidpointCompletions),
    videoP75: r.videoThirdQuartileCompletions === undefined ? null : int(r.videoThirdQuartileCompletions),
    videoP100: r.videoCompletions === undefined ? null : int(r.videoCompletions),
  };
  return isEmptyDay(day) ? null : day;
}

/** Quebra um período em janelas de até `size` dias (o TikTok aceita 30 dias por relatório diário). */
export function windows(from: string, to: string, size: number): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  const day = 86_400_000;
  let start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  while (start <= end) {
    const stop = Math.min(start + (size - 1) * day, end);
    out.push({ from: new Date(start).toISOString().slice(0, 10), to: new Date(stop).toISOString().slice(0, 10) });
    start = stop + day;
  }
  return out;
}
