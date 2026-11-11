// Métricas que cada plataforma entrega pela API, com o nome do campo na API (para a
// pessoa entender de onde vem o número) e o estado da conexão na VYZ. Nos dashboards
// de exemplo o valor vem da parte daquela plataforma no simulador.

import { isAdPlatform, PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { currentTotals, platformPart, previousTotals, type Totals } from "@/features/metrics/compute";
import { isSampleSpendDerived } from "../metric-prefs";
import type { MetricId } from "@/features/metrics/definitions";
import type { Dataset } from "@/features/metrics/source";

/** sync: a VYZ já sincroniza essa plataforma; soon: a API entrega, a conexão chega em breve. */
export type ApiStatus = "sync" | "soon";

export type PlatformMetric = { metric: MetricId; field: string };

export type PlatformApi = { status: ApiStatus; api: string; metrics: PlatformMetric[] };

const m = (metric: MetricId, field: string): PlatformMetric => ({ metric, field });

export const PLATFORM_API: Record<PlatformId, PlatformApi> = {
  meta: {
    status: "sync",
    api: "Marketing API (Insights)",
    metrics: [
      m("spend", "spend"),
      m("impressions", "impressions"),
      m("clicks", "clicks"),
      m("ctr", "ctr"),
      m("cpc", "cpc"),
      m("cpm", "cpm"),
      m("frequency", "frequency"),
      m("conversions", "actions"),
      m("cpa", "cost_per_action_type"),
      m("revenue", "action_values"),
      m("roas", "purchase_roas"),
      m("leads", "actions · lead"),
      m("cpl", "cost_per_action_type · lead"),
      m("views", "video_thruplay_watched_actions"),
    ],
  },
  google: {
    status: "sync",
    api: "Google Ads API (GAQL)",
    metrics: [
      m("spend", "metrics.cost_micros"),
      m("impressions", "metrics.impressions"),
      m("clicks", "metrics.clicks"),
      m("ctr", "metrics.ctr"),
      m("cpc", "metrics.average_cpc"),
      m("cpm", "metrics.average_cpm"),
      m("conversions", "metrics.conversions"),
      m("cpa", "metrics.cost_per_conversion"),
      m("revenue", "metrics.conversions_value"),
      m("roas", "conversions_value ÷ cost"),
      m("views", "metrics.video_views"),
      m("cpv", "metrics.average_cpv"),
    ],
  },
  youtube: {
    status: "sync",
    api: "Google Ads API (campanhas de vídeo)",
    metrics: [m("spend", "metrics.cost_micros"), m("impressions", "metrics.impressions"), m("views", "metrics.video_views"), m("viewRate", "metrics.video_view_rate"), m("cpv", "metrics.average_cpv"), m("clicks", "metrics.clicks"), m("ctr", "metrics.ctr"), m("conversions", "metrics.conversions")],
  },
  instagram: {
    status: "sync",
    api: "Instagram API com Login do Facebook (Insights)",
    metrics: [m("views", "views"), m("impressions", "views"), m("clicks", "profile_links_taps")],
  },
  facebook: {
    status: "sync",
    api: "Pages API (Page Insights)",
    metrics: [m("views", "page_media_view"), m("impressions", "page_media_view"), m("clicks", "page_total_actions")],
  },
  ga4: {
    status: "soon",
    api: "GA4 Data API",
    metrics: [m("sessions", "sessions"), m("conversions", "keyEvents"), m("revenue", "totalRevenue"), m("convRate", "sessionKeyEventRate")],
  },
  tiktok: {
    status: "soon",
    api: "TikTok Marketing API (Reporting)",
    metrics: [m("spend", "spend"), m("impressions", "impressions"), m("clicks", "clicks"), m("ctr", "ctr"), m("cpc", "cpc"), m("cpm", "cpm"), m("conversions", "conversion"), m("cpa", "cost_per_conversion"), m("views", "video_play_actions"), m("revenue", "total_purchase_value"), m("roas", "complete_payment_roas")],
  },
  linkedin: {
    status: "soon",
    api: "LinkedIn Marketing API (adAnalytics)",
    metrics: [m("spend", "costInLocalCurrency"), m("impressions", "impressions"), m("clicks", "clicks"), m("ctr", "clicks ÷ impressions"), m("cpc", "cost ÷ clicks"), m("cpm", "cost ÷ impressions × 1000"), m("leads", "oneClickLeads"), m("cpl", "cost ÷ oneClickLeads"), m("conversions", "externalWebsiteConversions")],
  },
  mercado: {
    status: "soon",
    api: "Mercado Ads API",
    metrics: [m("spend", "cost"), m("impressions", "prints"), m("clicks", "clicks"), m("ctr", "ctr"), m("cpc", "cpc"), m("conversions", "units_quantity"), m("revenue", "total_amount"), m("roas", "roas")],
  },
  shopee: {
    status: "soon",
    api: "Shopee Ads (Open Platform)",
    metrics: [m("spend", "expense"), m("impressions", "impression"), m("clicks", "clicks"), m("ctr", "ctr"), m("conversions", "direct_order"), m("revenue", "direct_gmv"), m("roas", "direct_roas")],
  },
  crm: {
    status: "soon",
    api: "API do CRM (RD Station, HubSpot, Pipedrive)",
    metrics: [m("leads", "contatos"), m("qualified", "negócios qualificados"), m("conversions", "negócios ganhos"), m("revenue", "valor ganho")],
  },
  rdstation: {
    status: "soon",
    api: "RD Station CRM API (login OAuth)",
    metrics: [m("leads", "contacts"), m("qualified", "deals · qualificados"), m("conversions", "deals · win"), m("revenue", "deals · amount_total")],
  },
  hubspot: {
    status: "soon",
    api: "HubSpot CRM API (login OAuth)",
    metrics: [m("leads", "contacts"), m("qualified", "deals · dealstage"), m("conversions", "deals · closedwon"), m("revenue", "deals · amount")],
  },
  pipedrive: {
    status: "soon",
    api: "Pipedrive API (login OAuth)",
    metrics: [m("leads", "persons"), m("qualified", "deals · open"), m("conversions", "deals · won"), m("revenue", "deals · value")],
  },
  kommo: {
    status: "soon",
    api: "Kommo API v4 (login OAuth)",
    metrics: [m("leads", "contacts"), m("qualified", "leads · pipeline"), m("conversions", "leads · status 142"), m("revenue", "leads · price")],
  },
  x: { status: "soon", api: "X Ads API (stats)", metrics: [m("spend", "billed_charge_local_micro"), m("impressions", "impressions"), m("clicks", "clicks"), m("ctr", "clicks ÷ impressions")] },
  spotify: { status: "soon", api: "Spotify Ads API", metrics: [m("spend", "spend"), m("impressions", "impressions"), m("clicks", "clicks")] },
  globo: { status: "soon", api: "Globo Ads", metrics: [] },
  chatgpt: { status: "soon", api: "ChatGPT Ads", metrics: [] },
};

export const API_STATUS_LABEL: Record<ApiStatus, string> = { sync: "Sincroniza hoje", soon: "Na API · conexão em breve" };

/** Plataformas do dashboard que têm métricas para oferecer. */
export function metricPlatforms(sources: readonly PlatformId[]): PlatformId[] {
  return sources.filter((s) => PLATFORM_API[s]?.metrics.length);
}

export function platformMetric(platform: string, metric: string): PlatformMetric | null {
  const p = PLATFORM_API[platform as PlatformId];
  return p?.metrics.find((x) => x.metric === metric) ?? null;
}

/** Métrica vale neste dashboard (a plataforma é uma das fontes; com investimento oculto, sem as de custo). */
export function metricAllowed(sources: readonly PlatformId[], platform: string, metric: string, hideSpend = false): boolean {
  if (!sources.includes(platform as PlatformId) || !platformMetric(platform, metric)) return false;
  return !(hideSpend && isSampleSpendDerived(metric as MetricId));
}

/** Atual e anterior da métrica naquela plataforma, nos dados do dashboard. */
export function platformValue(ds: Dataset, platform: PlatformId, metric: MetricId): { cur: number; prev: number } {
  const pick = (t: Totals) => t[metric] ?? 0;
  if (isAdPlatform(platform) && ds.adPlatforms.includes(platform)) {
    return { cur: pick(platformPart(ds, platform, "current")), prev: pick(platformPart(ds, platform, "previous")) };
  }
  // análise e CRM: o total confirmado do dashboard
  return { cur: pick(currentTotals(ds)), prev: pick(previousTotals(ds)) };
}

export const platformLabel = (id: PlatformId) => PLATFORMS[id].name;
