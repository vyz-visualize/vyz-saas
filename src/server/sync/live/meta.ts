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
/** Lado da imagem do criativo pedida à Meta (quadrada; os cartões cortam no centro). */
const THUMB_PX = 640;

/**
 * O criativo do anúncio. A miniatura padrão da Meta tem 64x64: o tamanho vai como modificador
 * na expansão (thumbnail_width/height no topo da chamada não valem para o criativo expandido;
 * conferido nas contas reais: 64x64 assim, 720x720 com o modificador). Vídeo: a capa.
 * child_attachments: o carrossel (dois cartões ou mais).
 */
export const AD_CREATIVE_FIELDS = `creative.thumbnail_width(${THUMB_PX}).thumbnail_height(${THUMB_PX}){title,body,call_to_action_type,thumbnail_url,image_url,object_url,link_url,video_id,object_type,instagram_permalink_url,object_story_spec{link_data{child_attachments{link}}}}`;

const AD_EXTRA_FIELDS = ["video_p25_watched_actions", "video_p50_watched_actions", "video_p75_watched_actions", "video_p95_watched_actions", "video_p100_watched_actions"].join(",");

type Page<T> = { data?: T[]; paging?: { next?: string } };

function authParams(token: string): Record<string, string> {
  const secret = serverEnv().META_APP_SECRET;
  const params: Record<string, string> = { access_token: token };
  // Com "Exigir segredo do app" ligado, toda chamada leva o appsecret_proof.
  if (secret) params.appsecret_proof = createHmac("sha256", secret).update(token).digest("hex");
  return params;
}

/** Páginas cada vez menores quando a Meta reclama de volume ("reduce the amount of data", HTTP 500 code=1) ou demora. */
const LIMITS = [500, 200, 100, 50, 25] as const;
const TIMEOUT_MS = 45_000;

const tooMuch = (err: unknown) => {
  const e = err as { code?: string; message?: string };
  return e?.code === "provedor_indisponivel" || /code=1\b|sem resposta/.test(e?.message ?? "");
};

async function all<T>(path: string, params: Record<string, string>, token: string, label: string, firstLimit: (typeof LIMITS)[number] = 500): Promise<T[]> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries({ ...params, ...authParams(token) })) url.searchParams.set(k, v);
  const out: T[] = [];
  let next: string | undefined = url.toString();
  let step = LIMITS.indexOf(firstLimit);
  for (let i = 0; next && i < MAX_PAGES * 2; i++) {
    const pageUrl: URL = new URL(next);
    pageUrl.searchParams.set("limit", String(LIMITS[step]));
    // o paging.next da Meta volta sem o appsecret_proof: sem reaplicar, a 2ª página é recusada (code=100)
    for (const [k, v] of Object.entries(authParams(token))) pageUrl.searchParams.set(k, v);
    try {
      const page: Page<T> = await fetchJson<Page<T>>(pageUrl, { label, rejectCode: "provedor_recusou", timeoutMs: TIMEOUT_MS });
      out.push(...(page.data ?? []));
      next = page.paging?.next;
    } catch (err) {
      // a mesma página de novo, menor; no menor tamanho, desiste
      if (!tooMuch(err) || step === LIMITS.length - 1) throw err;
      step++;
    }
  }
  return out;
}

/** Parte opcional: falha vira lista vazia, com aviso no log (conta e campanhas entram mesmo assim). */
async function optional<T>(p: Promise<T[]>, label: string): Promise<T[]> {
  try {
    return await p;
  } catch (err) {
    console.warn(`[vyz] Meta: ${label} ficou de fora`, err instanceof Error ? err.message.slice(0, 300) : err);
    return [];
  }
}

export async function fetchMetaDataset(account: SyncAccount, range: SyncRange): Promise<AccountDataset> {
  const token = await getValidAccessToken(account.connectionId);
  const act = account.externalId.startsWith("act_") ? account.externalId : `act_${account.externalId}`;
  const timeRange = JSON.stringify({ since: range.from, until: range.to });
  const insights = (level: string, fields: string) =>
    all<MetaInsight>(`${act}/insights`, { level, fields, time_range: timeRange, time_increment: "1", action_attribution_windows: '["7d_click","1d_view"]' }, token, `Meta: insights ${level}`);

  const [campaigns, ads, campaignRows, adRows, accountRows] = await Promise.all([
    all<MetaCampaign>(`${act}/campaigns`, { fields: "id,name,status,effective_status,objective,daily_budget,start_time" }, token, "Meta: campanhas"),
    // o criativo expandido pesa: começa com páginas de 100 anúncios
    optional(
      all<MetaAd>(
        `${act}/ads`,
        { fields: `id,name,campaign_id,effective_status,${AD_CREATIVE_FIELDS}` },
        token,
        "Meta: anúncios",
        100,
      ),
      "anúncios",
    ),
    insights("campaign", `campaign_id,${INSIGHT_FIELDS}`),
    optional(insights("ad", `ad_id,${INSIGHT_FIELDS},${AD_EXTRA_FIELDS}`), "métricas dos anúncios"),
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
