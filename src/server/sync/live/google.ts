import "server-only";

// Importação real do Google Ads (GAQL, googleAds:search com paginação). A conta
// é lida com o login-customer-id gravado na descoberta (MCC ou ela mesma).
// Docs: developers.google.com/google-ads/api/docs/query/overview

import type { AccountDataset } from "@/features/sync/dataset";
import type { SyncRange } from "@/features/sync/dates";
import { ADS, adsHeaders } from "@/server/integrations/providers/google";
import { fetchJson } from "@/server/integrations/providers/http";
import { getValidAccessToken } from "@/server/integrations/tokens";
import { createAdminSupabase } from "@/server/supabase/admin";
import type { SyncAccount } from "../source";
import { mapGoogleAd, mapGoogleAdDay, mapGoogleCampaign, mapGoogleCampaignDay, sumAccountDays, type GoogleRow } from "./map";

const MAX_PAGES = 50;

type SearchResponse = { results?: GoogleRow[]; nextPageToken?: string };

async function loginCustomerId(accountId: string, fallback: string): Promise<string> {
  const { data } = await createAdminSupabase().from("ad_accounts").select("metadata").eq("id", accountId).maybeSingle();
  const meta = (data?.metadata ?? {}) as { login_customer_id?: unknown };
  return typeof meta.login_customer_id === "string" && /^\d{10}$/.test(meta.login_customer_id) ? meta.login_customer_id : fallback;
}

/** Parte opcional da importação: falha vira lista vazia, com aviso no log (não derruba a conta inteira). */
async function optional(p: Promise<GoogleRow[]>, label: string): Promise<GoogleRow[]> {
  try {
    return await p;
  } catch (err) {
    console.warn(`[vyz] Google: ${label} ficou de fora`, err instanceof Error ? err.message.slice(0, 300) : err);
    return [];
  }
}

export async function fetchGoogleDataset(account: SyncAccount, range: SyncRange): Promise<AccountDataset> {
  const token = await getValidAccessToken(account.connectionId);
  const customer = account.externalId.replace(/-/g, "");
  const headers = adsHeaders(token, { "login-customer-id": await loginCustomerId(account.id, customer), "Content-Type": "application/json" });
  const during = `segments.date BETWEEN '${range.from}' AND '${range.to}'`;

  const search = async (query: string, label: string): Promise<GoogleRow[]> => {
    const out: GoogleRow[] = [];
    let pageToken: string | undefined;
    for (let i = 0; i < MAX_PAGES; i++) {
      const res: SearchResponse = await fetchJson<SearchResponse>(`${ADS}/customers/${customer}/googleAds:search`, {
        method: "POST",
        headers,
        body: JSON.stringify(pageToken ? { query, pageToken } : { query }),
        label,
        rejectCode: "provedor_recusou",
      });
      out.push(...(res.results ?? []));
      pageToken = res.nextPageToken;
      if (!pageToken) break;
    }
    return out;
  };

  const [campaignRows, campaignDayRows, adRows, adDayRows] = await Promise.all([
    search(
      "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.start_date_time, campaign_budget.amount_micros, campaign_budget.explicitly_shared FROM campaign WHERE campaign.status != 'REMOVED'",
      "Google: campanhas",
    ),
    search(
      `SELECT campaign.id, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value, metrics.all_conversions, metrics.interactions, metrics.video_trueview_views, metrics.search_impression_share, metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share, metrics.top_impression_percentage, metrics.absolute_top_impression_percentage FROM campaign WHERE ${during}`,
      "Google: métricas das campanhas",
    ),
    // anúncios são complemento: se o Google recusar (campo novo, permissão), conta e campanhas entram mesmo assim
    optional(search(
      "SELECT campaign.id, ad_group_ad.status, ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED'",
      "Google: anúncios",
    ), "anúncios"),
    optional(search(
      `SELECT campaign.id, ad_group_ad.ad.id, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.conversions_value, metrics.video_trueview_views FROM ad_group_ad WHERE ${during}`,
      "Google: métricas dos anúncios",
    ), "métricas dos anúncios"),
  ]);

  const campaignDaily = campaignDayRows.map(mapGoogleCampaignDay).filter((d) => d !== null);
  // O mesmo anúncio pode aparecer em vários grupos: soma por anúncio e dia.
  const adDays = new Map<string, NonNullable<ReturnType<typeof mapGoogleAdDay>>>();
  for (const row of adDayRows) {
    const d = mapGoogleAdDay(row);
    if (!d) continue;
    const key = `${d.adExternalId}|${d.date}`;
    const cur = adDays.get(key);
    if (!cur) adDays.set(key, d);
    else {
      cur.spend = Math.round((cur.spend + d.spend) * 100) / 100;
      cur.impressions += d.impressions;
      cur.clicks += d.clicks;
      cur.conversions = Math.round((cur.conversions + d.conversions) * 100) / 100;
      cur.conversionValue = Math.round((cur.conversionValue + d.conversionValue) * 100) / 100;
      cur.videoViews = cur.videoViews === null && d.videoViews === null ? null : (cur.videoViews ?? 0) + (d.videoViews ?? 0);
    }
  }
  const ads = new Map<string, NonNullable<ReturnType<typeof mapGoogleAd>>>();
  for (const row of adRows) {
    const a = mapGoogleAd(row);
    if (a && !ads.has(a.externalId)) ads.set(a.externalId, a);
  }

  return {
    platform: "google",
    accountExternalId: account.externalId,
    currency: account.currency,
    range: { from: range.from, to: range.to },
    campaigns: campaignRows.map(mapGoogleCampaign).filter((c) => c !== null),
    ads: [...ads.values()],
    products: [],
    accountDaily: sumAccountDays(campaignDaily),
    campaignDaily,
    adDaily: [...adDays.values()],
    breakdownDaily: [],
    searchTermDaily: [],
    productDaily: [],
  };
}
