import "server-only";

// Importação real do TikTok Ads (TikTok API for Business v1.3). Campanhas e
// anúncios, e o relatório diário (report/integrated/get, BASIC) por campanha e
// por anúncio, em janelas de 30 dias. O token do anunciante não expira.
// Docs: business-api.tiktok.com/portal/docs (Reporting > Synchronous report).

import type { AccountDataset } from "@/features/sync/dataset";
import type { SyncRange } from "@/features/sync/dates";
import { fetchJson } from "@/server/integrations/providers/http";
import { ProviderError } from "@/server/integrations/providers/types";
import { getValidAccessToken } from "@/server/integrations/tokens";
import type { SyncAccount } from "../source";
import { sumAccountDays } from "./map";
import { mapTikTokAd, mapTikTokAdDay, mapTikTokCampaign, mapTikTokCampaignDay, windows, type TikTokAd, type TikTokCampaign, type TikTokReportRow } from "./ads-map";

const API = "https://business-api.tiktok.com/open_api/v1.3";
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;
const TIMEOUT_MS = 45_000;

type Envelope<T> = { code: number; message?: string; request_id?: string; data?: T };
type Paged<T> = { list?: T[]; page_info?: { page?: number; total_page?: number } };

/** Métricas pedidas: a base sempre; as de vídeo, engajamento e compra caem fora se a conta recusar. */
const BASE_METRICS = ["spend", "impressions", "reach", "clicks", "conversion"];
const EXTRA_METRICS = ["complete_payment", "total_complete_payment_rate", "video_play_actions", "video_views_p25", "video_views_p50", "video_views_p75", "video_views_p100", "likes", "comments", "shares"];

async function get<T>(path: string, params: Record<string, unknown>, token: string, label: string): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  const res = await fetchJson<Envelope<T>>(url, { headers: { "Access-Token": token }, label, rejectCode: "provedor_recusou", timeoutMs: TIMEOUT_MS });
  // a API responde 200 com code != 0 quando recusa
  if (res.code !== 0 || !res.data) throw new ProviderError("provedor_recusou", `${label}: code=${res.code} ${res.message ?? ""}`.trim());
  return res.data;
}

async function all<T>(path: string, params: Record<string, unknown>, token: string, label: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await get<Paged<T>>(path, { ...params, page, page_size: PAGE_SIZE }, token, label);
    out.push(...(data.list ?? []));
    if (page >= (data.page_info?.total_page ?? 1)) break;
  }
  return out;
}

async function report(advertiserId: string, level: "AUCTION_CAMPAIGN" | "AUCTION_AD", range: SyncRange, token: string): Promise<TikTokReportRow[]> {
  const id = level === "AUCTION_CAMPAIGN" ? "campaign_id" : "ad_id";
  const run = async (metrics: string[]) => {
    const rows: TikTokReportRow[] = [];
    for (const w of windows(range.from, range.to, 30)) {
      rows.push(
        ...(await all<TikTokReportRow>(
          "report/integrated/get/",
          { advertiser_id: advertiserId, report_type: "BASIC", data_level: level, dimensions: [id, "stat_time_day"], metrics, start_date: w.from, end_date: w.to },
          token,
          `TikTok: relatório ${level === "AUCTION_CAMPAIGN" ? "campanhas" : "anúncios"}`,
        )),
      );
    }
    return rows;
  };
  try {
    return await run([...BASE_METRICS, ...EXTRA_METRICS]);
  } catch (err) {
    // métrica que a conta não tem: refaz só com a base
    if (!(err instanceof ProviderError) || err.code !== "provedor_recusou") throw err;
    console.warn("[vyz] TikTok: métricas extras recusadas, seguindo só com a base", err.message.slice(0, 300));
    return run(BASE_METRICS);
  }
}

/** Capa dos vídeos (até 60 por pedido). Falha não derruba a sincronização. */
async function videoThumbnails(advertiserId: string, videoIds: string[], token: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < videoIds.length; i += 60) {
    try {
      const data = await get<{ list?: { video_id: string; video_cover_url?: string; poster_url?: string }[] }>(
        "file/video/ad/info/",
        { advertiser_id: advertiserId, video_ids: videoIds.slice(i, i + 60) },
        token,
        "TikTok: capas dos vídeos",
      );
      for (const v of data.list ?? []) {
        const url = v.video_cover_url || v.poster_url;
        if (url) out.set(v.video_id, url);
      }
    } catch (err) {
      console.warn("[vyz] TikTok: capas dos vídeos ficaram de fora", err instanceof Error ? err.message.slice(0, 300) : err);
    }
  }
  return out;
}

async function optional<T>(p: Promise<T[]>, label: string): Promise<T[]> {
  try {
    return await p;
  } catch (err) {
    console.warn(`[vyz] TikTok: ${label} ficou de fora`, err instanceof Error ? err.message.slice(0, 300) : err);
    return [];
  }
}

export async function fetchTikTokDataset(account: SyncAccount, range: SyncRange): Promise<AccountDataset> {
  const token = await getValidAccessToken(account.connectionId);
  const advertiserId = account.externalId;
  const [campaigns, ads, campaignRows, adRows] = await Promise.all([
    all<TikTokCampaign>("campaign/get/", { advertiser_id: advertiserId }, token, "TikTok: campanhas"),
    optional(all<TikTokAd>("ad/get/", { advertiser_id: advertiserId }, token, "TikTok: anúncios"), "anúncios"),
    report(advertiserId, "AUCTION_CAMPAIGN", range, token),
    optional(report(advertiserId, "AUCTION_AD", range, token), "métricas dos anúncios"),
  ]);
  const videoIds = [...new Set(ads.map((a) => a.video_id).filter((v): v is string => !!v))];
  const thumbs = videoIds.length ? await videoThumbnails(advertiserId, videoIds, token) : new Map<string, string>();
  const campaignDaily = campaignRows.map(mapTikTokCampaignDay).filter((d) => d !== null);

  return {
    platform: "tiktok",
    accountExternalId: account.externalId,
    currency: account.currency,
    range: { from: range.from, to: range.to },
    campaigns: campaigns.map(mapTikTokCampaign),
    ads: ads.map((a) => mapTikTokAd(a, thumbs)),
    products: [],
    accountDaily: sumAccountDays(campaignDaily),
    campaignDaily,
    adDaily: adRows.map(mapTikTokAdDay).filter((d) => d !== null),
    breakdownDaily: [],
    searchTermDaily: [],
    productDaily: [],
  };
}
