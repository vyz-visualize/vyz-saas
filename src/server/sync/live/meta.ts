import "server-only";

// Importação real do Meta (Marketing API, Insights). Um pedido por nível
// (campanha, anúncio e conta), com time_increment=1 e paginação. O alcance da
// conta vem do nível account: pessoas únicas não somam entre campanhas.
// Docs: developers.facebook.com/docs/marketing-api/insights

import { createHmac } from "node:crypto";
import type { AccountDataset } from "@/features/sync/dataset";
import type { SyncRange } from "@/features/sync/dates";
import { serverEnv } from "@/server/env";
import { fetchJson } from "@/server/integrations/providers/http";
import { getValidAccessToken } from "@/server/integrations/tokens";
import type { SyncAccount } from "../source";
import { mapMetaAd, mapMetaAdDay, mapMetaCampaign, mapMetaCampaignDay, sumAccountDays, type MetaAd, type MetaCampaign, type MetaInsight } from "./map";

const GRAPH = "https://graph.facebook.com/v26.0";
const MAX_PAGES = 50;

const INSIGHT_FIELDS = [
  "date_start",
  "spend",
  "impressions",
  "reach",
  "clicks",
  "actions",
  "action_values",
  "video_thruplay_watched_actions",
].join(",");
const AD_EXTRA_FIELDS = ["video_p25_watched_actions", "video_p50_watched_actions", "video_p75_watched_actions", "video_p95_watched_actions", "video_p100_watched_actions"].join(",");

type Page<T> = { data?: T[]; paging?: { next?: string } };

function authParams(token: string): Record<string, string> {
  const secret = serverEnv().META_APP_SECRET;
  const params: Record<string, string> = { access_token: token };
  // Com "Exigir segredo do app" ligado, toda chamada leva o appsecret_proof.
  if (secret) params.appsecret_proof = createHmac("sha256", secret).update(token).digest("hex");
  return params;
}

async function all<T>(path: string, params: Record<string, string>, token: string, label: string): Promise<T[]> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries({ ...params, ...authParams(token), limit: "500" })) url.searchParams.set(k, v);
  const out: T[] = [];
  let next: string | undefined = url.toString();
  for (let i = 0; next && i < MAX_PAGES; i++) {
    const page: Page<T> = await fetchJson<Page<T>>(next, { label, rejectCode: "provedor_recusou" });
    out.push(...(page.data ?? []));
    next = page.paging?.next;
  }
  return out;
}

export async function fetchMetaDataset(account: SyncAccount, range: SyncRange): Promise<AccountDataset> {
  const token = await getValidAccessToken(account.connectionId);
  const act = account.externalId.startsWith("act_") ? account.externalId : `act_${account.externalId}`;
  const timeRange = JSON.stringify({ since: range.from, until: range.to });
  const insights = (level: string, fields: string) =>
    all<MetaInsight>(`${act}/insights`, { level, fields, time_range: timeRange, time_increment: "1", action_attribution_windows: '["7d_click","1d_view"]' }, token, `Meta: insights ${level}`);

  const [campaigns, ads, campaignRows, adRows, accountRows] = await Promise.all([
    all<MetaCampaign>(`${act}/campaigns`, { fields: "id,name,status,effective_status,objective,daily_budget,start_time" }, token, "Meta: campanhas"),
    all<MetaAd>(
      `${act}/ads`,
      { fields: "id,name,campaign_id,effective_status,creative{title,body,call_to_action_type,thumbnail_url,image_url,object_url,link_url,video_id,object_type,instagram_permalink_url}" },
      token,
      "Meta: anúncios",
    ),
    insights("campaign", `campaign_id,${INSIGHT_FIELDS}`),
    insights("ad", `ad_id,${INSIGHT_FIELDS},${AD_EXTRA_FIELDS}`),
    insights("account", "date_start,reach"),
  ]);

  const campaignDaily = campaignRows.map(mapMetaCampaignDay).filter((d) => d !== null);
  const reachByDate = new Map(accountRows.filter((r) => r.reach).map((r) => [r.date_start, Number(r.reach)] as const));

  return {
    platform: "meta",
    accountExternalId: account.externalId,
    currency: account.currency,
    range: { from: range.from, to: range.to },
    campaigns: campaigns.map(mapMetaCampaign),
    ads: ads.map(mapMetaAd).filter((a) => a !== null),
    products: [],
    accountDaily: sumAccountDays(campaignDaily, reachByDate),
    campaignDaily,
    adDaily: adRows.map(mapMetaAdDay).filter((d) => d !== null),
    breakdownDaily: [],
    searchTermDaily: [],
    productDaily: [],
  };
}
