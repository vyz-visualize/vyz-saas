import "server-only";

// Importação real do orgânico pelo login do Meta (Graph API v26.0).
//
// Instagram (Instagram API com Login do Facebook):
//   * conta: GET /{ig-id}/insights, metric_type=total_value, um dia por pedido
//     (o total_value não vem dia a dia); seguidores atuais em followers_count;
//   * posts: GET /{ig-id}/media dos últimos 30 dias do intervalo e
//     GET /{media-id}/insights (vida inteira).
// Página do Facebook (Pages API, com o token da Página):
//   * conta: GET /{page-id}/insights?period=day, uma métrica por pedido (uma
//     métrica recusada não derruba as outras);
//   * posts: GET /{page-id}/posts e GET /{post-id}/insights.
// Docs: developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights,
// .../instagram-platform/reference/instagram-media/insights,
// .../pages-api/platforminsights/page

import { addDays, dateRange, type SyncRange } from "@/features/sync/dates";
import type { OrganicDataset } from "@/features/sync/organic";
import { graph } from "@/server/integrations/providers/meta";
import { getValidAccessToken } from "@/server/integrations/tokens";
import type { SyncAccount } from "../source";
import { igDay, igPost, pageDay, pagePost, pageSeries, type IgMedia, type InsightValue, type PagePost } from "./organic-map";

type Page<T> = { data?: T[]; paging?: { cursors?: { after?: string }; next?: string } };
const MAX_PAGES = 20;
/** Posts mais antigos que isto (antes do fim do intervalo) não são relidos: os números já quase não mudam. */
const POST_WINDOW_DAYS = 30;
const IG_DAY_METRICS = ["reach", "views", "accounts_engaged", "total_interactions", "likes", "comments", "shares", "saves", "profile_links_taps"];
const IG_POST_METRICS: Record<string, string[]> = {
  story: ["views", "reach", "shares", "total_interactions"],
  default: ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions"],
};
const PAGE_METRICS = ["page_media_view", "page_total_media_view_unique", "page_post_engagements", "page_follows", "page_daily_follows_unique", "page_daily_unfollows_unique", "page_total_actions"];
// reações pelas métricas do post: os campos reactions/comments/shares do post pedem pages_read_user_content
const PAGE_POST_METRICS = ["post_media_view", "post_total_media_view_unique", "post_reactions_by_type_total"];

/** Data local (fuso da conta) de um instante. */
const localDay = (iso: string, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
/** Início do dia local em segundos Unix (o Meta aceita since/until em Unix). */
const unixStart = (date: string) => String(Math.floor(Date.parse(`${date}T00:00:00-03:00`) / 1000));

async function pages<T>(path: string, params: Record<string, string>, token: string, label: string): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const res = await graph<Page<T>>(path, { ...params, limit: "100", ...(after ? { after } : {}) }, token, label);
    out.push(...(res.data ?? []));
    after = res.paging?.next ? res.paging.cursors?.after : undefined;
    if (!after) break;
  }
  return out;
}

/** Pedido que pode ser recusado (métrica fora do tipo de mídia, conta pequena demais para o recorte): volta vazio. */
async function soft<T>(run: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await run();
  } catch {
    return empty;
  }
}

async function fetchInstagram(account: SyncAccount, range: SyncRange, token: string): Promise<OrganicDataset> {
  const ig = account.externalId;
  const days = dateRange(range.to, range.days);
  const profile = await graph<{ followers_count?: number }>(`/${ig}`, { fields: "followers_count" }, token, "Instagram: perfil");

  const since = addDays(range.to, -POST_WINDOW_DAYS + 1) < range.from ? addDays(range.to, -POST_WINDOW_DAYS + 1) : range.from;
  const media = await pages<IgMedia>(
    `/${ig}/media`,
    { fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count", since: unixStart(since), until: unixStart(addDays(range.to, 1)) },
    token,
    "Instagram: posts",
  );
  const stories = await soft(() => pages<IgMedia>(`/${ig}/stories`, { fields: "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp" }, token, "Instagram: stories"), []);
  const all = [...media, ...stories.filter((s) => !media.some((m) => m.id === s.id))];

  const posts = [];
  for (const m of all) {
    const metrics = IG_POST_METRICS[m.media_product_type === "STORY" ? "story" : "default"];
    const res = await soft(() => graph<{ data?: InsightValue[] }>(`/${m.id}/insights`, { metric: metrics.join(",") }, token, "Instagram: números do post"), { data: [] });
    posts.push(igPost(m, res.data ?? []));
  }

  const perDay = new Map<string, number>();
  for (const p of posts) {
    const d = localDay(p.publishedAt, account.timezone);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }

  const daily = [];
  for (const date of days) {
    const base = { metric_type: "total_value", period: "day", since: unixStart(date), until: unixStart(addDays(date, 1)) };
    const main = await graph<{ data?: InsightValue[] }>(`/${ig}/insights`, { ...base, metric: IG_DAY_METRICS.join(",") }, token, "Instagram: números do dia");
    // seguir e deixar de seguir só sai para perfis com 100+ seguidores
    const follows = await soft(() => graph<{ data?: InsightValue[] }>(`/${ig}/insights`, { ...base, metric: "follows_and_unfollows", breakdown: "follow_type" }, token, "Instagram: seguidores do dia"), { data: [] });
    // o total de seguidores só existe "agora": vai no último dia
    daily.push(igDay(date, [...(main.data ?? []), ...(follows.data ?? [])], date === range.to ? (profile.followers_count ?? null) : null, perDay.get(date) ?? 0));
  }
  return { platform: "instagram", accountExternalId: ig, range: { from: range.from, to: range.to }, daily, posts };
}

async function fetchPage(account: SyncAccount, range: SyncRange, userToken: string): Promise<OrganicDataset> {
  const pageId = account.externalId;
  const { access_token: token } = await graph<{ access_token?: string }>(`/${pageId}`, { fields: "access_token" }, userToken, "Página: token");
  if (!token) throw new Error("Meta: a Página não devolveu o token (falta pages_show_list ou a Página não está na integração)");
  // end_time da série diária é o fim do dia: a data do valor é a véspera, no fuso da conta
  const dateOf = (endTime: string) => addDays(localDay(endTime, account.timezone), -1);

  const series: Record<string, Map<string, number>> = {};
  for (const metric of PAGE_METRICS) {
    const res = await soft(
      () => graph<{ data?: InsightValue[] }>(`/${pageId}/insights`, { metric, period: "day", since: range.from, until: addDays(range.to, 1) }, token, "Página: números do dia"),
      { data: [] },
    );
    series[metric] = pageSeries(res.data?.[0], dateOf);
  }

  const since = addDays(range.to, -POST_WINDOW_DAYS + 1) < range.from ? addDays(range.to, -POST_WINDOW_DAYS + 1) : range.from;
  const window = { since: unixStart(since), until: unixStart(addDays(range.to, 1)) };
  const BASIC = "id,message,created_time,permalink_url,full_picture,status_type";
  // com engajamento direto no post quando o app tem pages_read_user_content; sem ela (code=10), só o básico
  const list = await pages<PagePost>(`/${pageId}/posts`, { fields: `${BASIC},shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)`, ...window }, token, "Página: posts").catch((err) => {
    if (!/code=10\b/.test(err instanceof Error ? err.message : "")) throw err;
    return pages<PagePost>(`/${pageId}/posts`, { fields: BASIC, ...window }, token, "Página: posts");
  });
  const posts = [];
  for (const p of list) {
    const res = await soft(() => graph<{ data?: InsightValue[] }>(`/${p.id}/insights`, { metric: PAGE_POST_METRICS.join(",") }, token, "Página: números do post"), { data: [] });
    posts.push(pagePost(p, res.data ?? []));
  }
  const perDay = new Map<string, number>();
  for (const p of posts) {
    const d = localDay(p.publishedAt, account.timezone);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  const daily = dateRange(range.to, range.days).map((date) => pageDay(date, series, perDay.get(date) ?? 0));
  return { platform: "facebook", accountExternalId: pageId, range: { from: range.from, to: range.to }, daily, posts };
}

export async function fetchOrganicDataset(account: SyncAccount, range: SyncRange): Promise<OrganicDataset> {
  const token = await getValidAccessToken(account.connectionId);
  return account.platform === "instagram" ? fetchInstagram(account, range, token) : fetchPage(account, range, token);
}
