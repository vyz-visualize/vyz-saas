// Mapeadores puros do orgânico (Instagram e Página do Facebook): respostas da
// Graph API → linhas do armazém. Testados em organic-map.test.ts.
//
// Instagram (Instagram API com Login do Facebook, v22+): "impressions" saiu em
// 21/04/2025; no lugar entrou "views". Página: "page_impressions" e "page_fans"
// saíram em 15/11/2025; no lugar entraram "page_media_view" e "page_follows".

import type { OrganicDay, OrganicPost, OrganicPostKind } from "@/features/sync/organic";

export type InsightValue = { name: string; total_value?: { value?: number; breakdowns?: { results?: { dimension_values?: string[]; value?: number }[] }[] }; values?: { value?: number | Record<string, number>; end_time?: string }[] };

const n = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.round(v)) : null);

/** Total de um dia do Instagram (metric_type=total_value, since/until de um dia). */
export function igDay(date: string, metrics: InsightValue[], followers: number | null, posts: number): OrganicDay {
  const get = (name: string) => n(metrics.find((m) => m.name === name)?.total_value?.value);
  const fu = metrics.find((m) => m.name === "follows_and_unfollows")?.total_value?.breakdowns?.[0]?.results ?? [];
  const follow = (type: string) => n(fu.find((r) => r.dimension_values?.[0] === type)?.value);
  const likes = get("likes");
  const comments = get("comments");
  const shares = get("shares");
  const saves = get("saves");
  const parts = (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saves ?? 0);
  return {
    date,
    followers,
    follows: follow("FOLLOWER"),
    unfollows: follow("NON_FOLLOWER"),
    views: get("views") ?? 0,
    reach: get("reach"),
    profileViews: get("profile_views"),
    accountsEngaged: get("accounts_engaged"),
    interactions: get("total_interactions") ?? parts,
    likes,
    comments,
    shares,
    saves,
    linkClicks: get("profile_links_taps"),
    posts,
  };
}

/** Série diária da Página (period=day): uma métrica vira um mapa data → valor. end_time é o fim do dia (dia seguinte, 07:00 UTC). */
export function pageSeries(metric: InsightValue | undefined, dateOf: (endTime: string) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const v of metric?.values ?? []) {
    if (!v.end_time || typeof v.value !== "number") continue;
    out.set(dateOf(v.end_time), Math.max(0, Math.round(v.value)));
  }
  return out;
}

export function pageDay(date: string, series: Record<string, Map<string, number>>, posts: number): OrganicDay {
  const get = (name: string) => series[name]?.get(date) ?? null;
  const interactions = get("page_post_engagements") ?? 0;
  return {
    date,
    followers: get("page_follows"),
    follows: get("page_daily_follows_unique"),
    unfollows: get("page_daily_unfollows_unique"),
    views: get("page_media_view") ?? 0,
    reach: get("page_total_media_view_unique"),
    profileViews: null,
    accountsEngaged: null,
    interactions,
    likes: null,
    comments: null,
    shares: null,
    saves: null,
    linkClicks: get("page_total_actions"),
    posts,
  };
}

export type IgMedia = { id: string; caption?: string; media_type?: string; media_product_type?: string; permalink?: string; thumbnail_url?: string; media_url?: string; timestamp: string; like_count?: number; comments_count?: number };

export function igKind(m: Pick<IgMedia, "media_type" | "media_product_type">): OrganicPostKind {
  if (m.media_product_type === "STORY") return "story";
  if (m.media_product_type === "REELS") return "reel";
  if (m.media_type === "CAROUSEL_ALBUM") return "carousel";
  if (m.media_type === "VIDEO") return "video";
  return "post";
}

export function igPost(m: IgMedia, metrics: InsightValue[]): OrganicPost {
  const get = (name: string) => n(metrics.find((x) => x.name === name)?.values?.[0]?.value ?? metrics.find((x) => x.name === name)?.total_value?.value);
  const kind = igKind(m);
  const likes = get("likes") ?? n(m.like_count);
  const comments = get("comments") ?? n(m.comments_count);
  const shares = get("shares");
  const saves = get("saved");
  return {
    externalId: m.id,
    kind,
    caption: m.caption?.trim() || null,
    permalink: m.permalink ?? null,
    thumbnailUrl: m.thumbnail_url ?? (m.media_type === "IMAGE" || m.media_type === "CAROUSEL_ALBUM" ? (m.media_url ?? null) : null),
    publishedAt: m.timestamp,
    views: get("views"),
    reach: get("reach"),
    likes: kind === "story" ? null : likes,
    comments: kind === "story" ? null : comments,
    shares,
    saves: kind === "story" ? null : saves,
    interactions: get("total_interactions") ?? (likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saves ?? 0),
  };
}

export type PagePost = {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
  full_picture?: string;
  status_type?: string;
  shares?: { count?: number };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
};

export function pagePost(p: PagePost, metrics: InsightValue[]): OrganicPost {
  const get = (name: string) => n(metrics.find((x) => x.name === name)?.values?.[0]?.value);
  const likes = n(p.reactions?.summary?.total_count);
  const comments = n(p.comments?.summary?.total_count);
  const shares = n(p.shares?.count) ?? 0;
  const kind: OrganicPostKind = p.status_type === "added_video" ? "video" : p.full_picture ? "post" : "text";
  return {
    externalId: p.id,
    kind,
    caption: p.message?.trim() || null,
    permalink: p.permalink_url ?? null,
    thumbnailUrl: p.full_picture ?? null,
    publishedAt: p.created_time,
    views: get("post_media_view"),
    reach: get("post_total_media_view_unique"),
    likes,
    comments,
    shares,
    saves: null,
    interactions: (likes ?? 0) + (comments ?? 0) + shares,
  };
}
