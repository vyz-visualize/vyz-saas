import "server-only";

// Importação real do LinkedIn Ads (Marketing API, REST versionada). Campanhas e
// criativos da conta, e o adAnalytics diário por campanha e por criativo.
// Rest.li 2.0: listas e datas vão na sintaxe List(...) e (year:..,month:..,day:..),
// com os URNs codificados e os parênteses não.
// Docs: learn.microsoft.com/linkedin/marketing/integrations/ads-reporting/ads-reporting

import type { AccountDataset } from "@/features/sync/dataset";
import type { SyncRange } from "@/features/sync/dates";
import { fetchJson } from "@/server/integrations/providers/http";
import { bearer } from "@/server/integrations/providers/oauth2";
import { getValidAccessToken } from "@/server/integrations/tokens";
import type { SyncAccount } from "../source";
import { sumAccountDays } from "./map";
import { mapLinkedInCampaign, mapLinkedInCampaignDay, mapLinkedInCreative, mapLinkedInCreativeDay, type LinkedInAnalyticsRow, type LinkedInCampaign, type LinkedInCreative } from "./ads-map";

const API = "https://api.linkedin.com/rest";
const VERSION = "202510";
const MAX_PAGES = 50;
const TIMEOUT_MS = 45_000;

/** Até 20 campos por chamada do adAnalytics. */
const ANALYTICS_FIELDS = [
  "dateRange",
  "pivotValues",
  "costInLocalCurrency",
  "impressions",
  "clicks",
  "landingPageClicks",
  "externalWebsiteConversions",
  "conversionValueInLocalCurrency",
  "oneClickLeads",
  "videoViews",
  "videoFirstQuartileCompletions",
  "videoMidpointCompletions",
  "videoThirdQuartileCompletions",
  "videoCompletions",
  "likes",
  "comments",
  "shares",
].join(",");

const headers = (token: string) => bearer(token, { "LinkedIn-Version": VERSION, "X-Restli-Protocol-Version": "2.0.0" });

type Page<T> = { elements?: T[]; metadata?: { nextPageToken?: string } };

/** Lista com pageToken (campanhas e criativos). */
async function all<T>(path: string, query: string, token: string, label: string): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const url = `${API}/${path}?${query}&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const page = await fetchJson<Page<T>>(url, { headers: headers(token), label, rejectCode: "provedor_recusou", timeoutMs: TIMEOUT_MS });
    out.push(...(page.elements ?? []));
    pageToken = page.metadata?.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

const dateParam = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `(year:${y},month:${m},day:${d})`;
};

async function analytics(accountId: string, pivot: "CAMPAIGN" | "CREATIVE", range: SyncRange, token: string): Promise<LinkedInAnalyticsRow[]> {
  const accountUrn = encodeURIComponent(`urn:li:sponsoredAccount:${accountId}`);
  const query = [
    "q=analytics",
    `pivot=${pivot}`,
    "timeGranularity=DAILY",
    `dateRange=(start:${dateParam(range.from)},end:${dateParam(range.to)})`,
    `accounts=List(${accountUrn})`,
    `fields=${ANALYTICS_FIELDS}`,
  ].join("&");
  const res = await fetchJson<Page<LinkedInAnalyticsRow>>(`${API}/adAnalytics?${query}`, {
    headers: headers(token),
    label: `LinkedIn: relatório ${pivot === "CAMPAIGN" ? "campanhas" : "criativos"}`,
    rejectCode: "provedor_recusou",
    timeoutMs: TIMEOUT_MS,
  });
  return res.elements ?? [];
}

async function optional<T>(p: Promise<T[]>, label: string): Promise<T[]> {
  try {
    return await p;
  } catch (err) {
    console.warn(`[vyz] LinkedIn: ${label} ficou de fora`, err instanceof Error ? err.message.slice(0, 300) : err);
    return [];
  }
}

export async function fetchLinkedInDataset(account: SyncAccount, range: SyncRange): Promise<AccountDataset> {
  const token = await getValidAccessToken(account.connectionId);
  const accountId = account.externalId.split(":").pop() ?? account.externalId;
  const [campaigns, creatives, campaignRows, creativeRows] = await Promise.all([
    all<LinkedInCampaign>(`adAccounts/${accountId}/adCampaigns`, "q=search", token, "LinkedIn: campanhas"),
    optional(all<LinkedInCreative>(`adAccounts/${accountId}/creatives`, "q=criteria", token, "LinkedIn: criativos"), "criativos"),
    analytics(accountId, "CAMPAIGN", range, token),
    optional(analytics(accountId, "CREATIVE", range, token), "métricas dos criativos"),
  ]);
  const campaignDaily = campaignRows.map(mapLinkedInCampaignDay).filter((d) => d !== null);

  return {
    platform: "linkedin",
    accountExternalId: account.externalId,
    currency: account.currency,
    range: { from: range.from, to: range.to },
    campaigns: campaigns.map(mapLinkedInCampaign),
    ads: creatives.map(mapLinkedInCreative).filter((a) => a !== null),
    products: [],
    accountDaily: sumAccountDays(campaignDaily),
    campaignDaily,
    adDaily: creativeRows.map(mapLinkedInCreativeDay).filter((d) => d !== null),
    breakdownDaily: [],
    searchTermDaily: [],
    productDaily: [],
  };
}
