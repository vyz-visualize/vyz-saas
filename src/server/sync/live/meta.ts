import "server-only";

// Importação real do Meta (Marketing API, Insights). Um pedido por nível
// (campanha, anúncio e conta), com time_increment=1 e paginação. O alcance da
// conta vem do nível account: pessoas únicas não somam entre campanhas.
// Docs: developers.facebook.com/docs/marketing-api/insights

import type { AccountDataset } from "@/features/sync/dataset";
import type { SyncRange } from "@/features/sync/dates";
import { metaAuthParams } from "@/server/integrations/meta-auth";
import { fetchJson, SYNC_CACHE_SECONDS } from "@/server/integrations/providers/http";
import { getValidAccessToken } from "@/server/integrations/tokens";
import type { SyncAccount } from "../source";
import { BR_STATES } from "@/features/sync/breakdowns";
import { mapMetaAd, mapMetaAdDay, mapMetaBreakdown, mapMetaCampaign, mapMetaCampaignDay, META_BREAKDOWNS, sumAccountDays, type MetaAd, type MetaBreakdownDimension, type MetaBreakdownRow, type MetaCampaign, type MetaInsight } from "./map";

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
export const AD_CREATIVE_FIELDS = `creative.thumbnail_width(${THUMB_PX}).thumbnail_height(${THUMB_PX}){title,body,call_to_action_type,thumbnail_url,image_url,object_url,link_url,video_id,object_type,instagram_permalink_url,effective_object_story_id,object_story_spec{link_data{child_attachments{link}}}}`;

const AD_EXTRA_FIELDS = ["video_p25_watched_actions", "video_p50_watched_actions", "video_p75_watched_actions", "video_p95_watched_actions", "video_p100_watched_actions"].join(",");

type Page<T> = { data?: T[]; paging?: { next?: string } };

// Com "Exigir segredo do app" ligado, toda chamada leva o appsecret_proof (menos a de token do app do cliente).
const authParams = metaAuthParams;

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
      // cache curto (Redis): uma nova tentativa logo depois de uma falha no meio reaproveita as páginas que já vieram
      const page: Page<T> = await fetchJson<Page<T>>(pageUrl, { label, rejectCode: "provedor_recusou", timeoutMs: TIMEOUT_MS, cacheSeconds: SYNC_CACHE_SECONDS });
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

const actOf = (account: SyncAccount) => (account.externalId.startsWith("act_") ? account.externalId : `act_${account.externalId}`);

/**
 * Quebras da conta (posicionamento, estado, dispositivo, hora, idade e gênero), uma chamada cada,
 * em paralelo. Cada uma é opcional: a que falhar fica de fora (com aviso no log) e não entra em
 * `dimensions` (as linhas dela no banco ficam como estão).
 */
export async function fetchMetaBreakdowns(account: SyncAccount, range: SyncRange, token?: string): Promise<{ rows: AccountDataset["breakdownDaily"]; dimensions: MetaBreakdownDimension[] }> {
  const t = token ?? (await getValidAccessToken(account.connectionId));
  const act = actOf(account);
  const timeRange = JSON.stringify({ since: range.from, until: range.to });
  const breakdown = async (dim: MetaBreakdownDimension) => {
    try {
      const rows = await all<MetaBreakdownRow>(`${act}/insights`, { level: "account", fields: "date_start,spend,impressions,clicks,actions,action_values", breakdowns: META_BREAKDOWNS[dim], time_range: timeRange, time_increment: "1", action_attribution_windows: '["7d_click","1d_view"]' }, t, `Meta: quebra ${dim}`);
      return { dim, rows: mapMetaBreakdown(dim, rows, BR_STATES), ok: true };
    } catch (err) {
      console.warn(`[vyz] Meta: quebra ${dim} ficou de fora`, err instanceof Error ? err.message.slice(0, 300) : err);
      return { dim, rows: [], ok: false };
    }
  };
  const parts = await Promise.all((Object.keys(META_BREAKDOWNS) as MetaBreakdownDimension[]).map(breakdown));
  return { rows: parts.flatMap((p) => p.rows), dimensions: parts.filter((p) => p.ok).map((p) => p.dim) };
}

/** Dados da conta. Com { breakdowns: false }, sem as quebras (que podem ir numa rodada à parte). */
export async function fetchMetaDataset(account: SyncAccount, range: SyncRange, opts: { breakdowns?: boolean } = {}): Promise<AccountDataset> {
  const token = await getValidAccessToken(account.connectionId);
  const act = actOf(account);
  const timeRange = JSON.stringify({ since: range.from, until: range.to });
  const insights = (level: string, fields: string) =>
    all<MetaInsight>(`${act}/insights`, { level, fields, time_range: timeRange, time_increment: "1", action_attribution_windows: '["7d_click","1d_view"]' }, token, `Meta: insights ${level}`);

  // quebras da conta (Público e abas da Meta), em paralelo com o resto
  const breakdownsP = opts.breakdowns === false ? Promise.resolve({ rows: [], dimensions: [] as MetaBreakdownDimension[] }) : fetchMetaBreakdowns(account, range, token);

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
  const breakdowns = await breakdownsP;
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
    breakdownDaily: breakdowns.rows,
    breakdownDimensions: breakdowns.dimensions,
    searchTermDaily: [],
    productDaily: [],
  };
}
