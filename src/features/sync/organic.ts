// Orgânico (Instagram e Página do Facebook) no formato do armazém: o que a
// sincronização grava em organic_daily e organic_posts. Vale para o gerador
// simulado e para a API do Meta.
//
// Convenções:
//   * datas "YYYY-MM-DD" no fuso da conta;
//   * views = visualizações (o Meta trocou impressões por visualizações em 2025:
//     Instagram "views", Página "page_media_view");
//   * null = a plataforma não informa o número (ex.: salvamentos na Página);
//   * os posts trazem os números de vida inteira (o Meta não dá série diária por post).

export const ORGANIC_PLATFORMS = ["instagram", "facebook"] as const;
export type OrganicPlatform = (typeof ORGANIC_PLATFORMS)[number];
export const isOrganicSyncPlatform = (value: unknown): value is OrganicPlatform => (ORGANIC_PLATFORMS as readonly unknown[]).includes(value);

export type OrganicPostKind = "post" | "carousel" | "reel" | "story" | "video" | "text";

export type OrganicDay = {
  date: string;
  /** Seguidores no fim do dia (null quando a API não dá o histórico). */
  followers: number | null;
  follows: number | null;
  unfollows: number | null;
  views: number;
  reach: number | null;
  profileViews: number | null;
  accountsEngaged: number | null;
  interactions: number;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  linkClicks: number | null;
  /** Posts publicados no dia. */
  posts: number;
};

export type OrganicPost = {
  externalId: string;
  kind: OrganicPostKind;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  /** ISO com fuso. */
  publishedAt: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  interactions: number;
};

export type OrganicDataset = {
  platform: OrganicPlatform;
  accountExternalId: string;
  range: { from: string; to: string };
  daily: OrganicDay[];
  posts: OrganicPost[];
};

/** Linhas para o banco (snake_case), sem os ids internos. */
export const organicDayRow = (d: OrganicDay) => ({
  date: d.date,
  followers: d.followers,
  follows: d.follows,
  unfollows: d.unfollows,
  views: d.views,
  reach: d.reach,
  profile_views: d.profileViews,
  accounts_engaged: d.accountsEngaged,
  interactions: d.interactions,
  likes: d.likes,
  comments: d.comments,
  shares: d.shares,
  saves: d.saves,
  link_clicks: d.linkClicks,
  posts: d.posts,
});

export const organicPostRow = (p: OrganicPost) => ({
  external_id: p.externalId,
  kind: p.kind,
  caption: p.caption ? p.caption.slice(0, 2000) : null,
  permalink: p.permalink,
  thumbnail_url: p.thumbnailUrl,
  published_at: p.publishedAt,
  views: p.views,
  reach: p.reach,
  likes: p.likes,
  comments: p.comments,
  shares: p.shares,
  saves: p.saves,
  interactions: p.interactions,
});
