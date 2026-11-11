// Orgânico no dashboard (Instagram e Página do Facebook): soma as linhas de
// organic_daily e organic_posts do período e do anterior e monta os cards, a série
// diária, a tabela por perfil e o ranking de conteúdo. Puro (testado).

import type { DateRange, Kpi } from "./types";

export type OrganicProfile = { id: string; name: string; platform: "instagram" | "facebook" };

export type OrganicDayRow = {
  ad_account_id: string;
  date: string;
  followers: number | null;
  follows: number | null;
  unfollows: number | null;
  views: number;
  reach: number | null;
  profile_views: number | null;
  accounts_engaged: number | null;
  interactions: number;
  link_clicks: number | null;
  posts: number;
};

export type OrganicPostRow = {
  ad_account_id: string;
  external_id: string;
  kind: string;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  published_at: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  interactions: number;
};

export type OrganicPostVM = {
  id: string;
  profile: string;
  platform: OrganicProfile["platform"];
  kind: string;
  caption: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  interactions: number;
  /** Interações sobre o alcance (null sem alcance). */
  engagement: number | null;
};

export type OrganicProfileVM = OrganicProfile & {
  followers: number | null;
  followersNet: number | null;
  views: number;
  reach: number | null;
  interactions: number;
  posts: number;
  engagement: number | null;
};

export type OrganicDayVM = { date: string; views: number; reach: number | null; interactions: number; followersNet: number | null };

export type OrganicView = {
  profiles: OrganicProfile[];
  hasData: boolean;
  kpis: Kpi[];
  daily: OrganicDayVM[];
  byProfile: OrganicProfileVM[];
  /** Ranking por interações (os 30 primeiros do período). */
  posts: OrganicPostVM[];
  /** Interações por formato (reel, carrossel, story, post, vídeo). */
  byKind: { kind: string; posts: number; interactions: number; views: number }[];
};

export const KIND_LABEL: Record<string, string> = { post: "Post", carousel: "Carrossel", reel: "Reel", story: "Story", video: "Vídeo", text: "Texto" };

const inRange = (date: string, r: DateRange) => date >= r.from && date <= r.to;
const sum = (list: (number | null)[]) => (list.some((v) => v !== null) ? list.reduce<number>((a, v) => a + (v ?? 0), 0) : null);
const delta = (cur: number | null, prev: number | null) => (cur === null || prev === null || prev === 0 ? null : cur / prev - 1);

/** Seguidores no fim do período: o último número conhecido de cada perfil, somado. */
function followersAt(rows: OrganicDayRow[], until: string): number | null {
  const last = new Map<string, number>();
  for (const r of [...rows].sort((a, b) => a.date.localeCompare(b.date))) if (r.date <= until && r.followers !== null) last.set(r.ad_account_id, r.followers);
  return last.size ? [...last.values()].reduce((a, b) => a + b, 0) : null;
}

/** Ganho líquido no período: seguir menos deixar de seguir (quando a API dá) ou a diferença dos totais. */
function netFollowers(rows: OrganicDayRow[], r: DateRange): number | null {
  const days = rows.filter((x) => inRange(x.date, r));
  const follows = sum(days.map((d) => d.follows));
  const unfollows = sum(days.map((d) => d.unfollows));
  if (follows !== null) return follows - (unfollows ?? 0);
  const end = followersAt(rows, r.to);
  const start = followersAt(rows, r.from);
  return end !== null && start !== null ? end - start : null;
}

function kpi(id: string, label: string, value: number | null, previous: number | null, spark: (number | null)[], format: Kpi["format"] = "int", help?: string): Kpi {
  return { id, label, value, previous, delta: delta(value, previous), format, better: "up", spark, help };
}

export function aggregateOrganic(profiles: OrganicProfile[], days: OrganicDayRow[], posts: OrganicPostRow[], current: DateRange, previous: DateRange): OrganicView {
  const cur = days.filter((d) => inRange(d.date, current));
  const prev = days.filter((d) => inRange(d.date, previous));
  const byDate = new Map<string, OrganicDayRow[]>();
  for (const d of cur) byDate.set(d.date, [...(byDate.get(d.date) ?? []), d]);
  const dates = [...byDate.keys()].sort();
  const daily: OrganicDayVM[] = dates.map((date) => {
    const list = byDate.get(date)!;
    const follows = sum(list.map((x) => x.follows));
    return { date, views: list.reduce((a, x) => a + x.views, 0), reach: sum(list.map((x) => x.reach)), interactions: list.reduce((a, x) => a + x.interactions, 0), followersNet: follows === null ? null : follows - (sum(list.map((x) => x.unfollows)) ?? 0) };
  });

  const total = (rows: OrganicDayRow[], key: "views" | "interactions" | "posts") => rows.reduce((a, x) => a + x[key], 0);
  const views = total(cur, "views");
  const interactions = total(cur, "interactions");
  // alcance de vários dias não soma pessoas únicas: a soma é o alcance diário acumulado (o Meta não dá o único do período)
  const reach = sum(cur.map((x) => x.reach));
  const prevReach = sum(prev.map((x) => x.reach));
  const engagement = reach ? interactions / reach : null;
  const prevEngagement = prevReach ? total(prev, "interactions") / prevReach : null;

  const kpis: Kpi[] = [
    kpi("followers", "Seguidores", followersAt(days, current.to), followersAt(days, previous.to), daily.map(() => null), "int", "Total no fim do período, somando os perfis."),
    kpi("followers_net", "Novos seguidores", netFollowers(days, current), netFollowers(days, previous), daily.map((d) => d.followersNet), "int", "Quem passou a seguir menos quem deixou de seguir."),
    kpi("views", "Visualizações", views, total(prev, "views"), daily.map((d) => d.views), "int", "Vezes que o conteúdo foi visto (o Meta trocou impressões por visualizações)."),
    kpi("reach", "Alcance", reach, prevReach, daily.map((d) => d.reach), "int", "Contas alcançadas por dia, somadas no período."),
    kpi("interactions", "Interações", interactions, total(prev, "interactions"), daily.map((d) => d.interactions), "int", "Curtidas, comentários, compartilhamentos e salvamentos."),
    kpi("engagement", "Taxa de engajamento", engagement, prevEngagement, daily.map((d) => (d.reach ? d.interactions / d.reach : null)), "pct", "Interações sobre o alcance."),
    kpi("posts", "Publicações", total(cur, "posts"), total(prev, "posts"), daily.map((d) => byDate.get(d.date)!.reduce((a, x) => a + x.posts, 0)), "int"),
  ];

  const name = new Map(profiles.map((p) => [p.id, p]));
  const byProfile: OrganicProfileVM[] = profiles.map((p) => {
    const rows = cur.filter((d) => d.ad_account_id === p.id);
    const all = days.filter((d) => d.ad_account_id === p.id);
    const r = sum(rows.map((x) => x.reach));
    const i = rows.reduce((a, x) => a + x.interactions, 0);
    return { ...p, followers: followersAt(all, current.to), followersNet: netFollowers(all, current), views: rows.reduce((a, x) => a + x.views, 0), reach: r, interactions: i, posts: rows.reduce((a, x) => a + x.posts, 0), engagement: r ? i / r : null };
  });

  const periodPosts = posts.filter((p) => inRange(p.published_at.slice(0, 10), current) && name.has(p.ad_account_id));
  const vm: OrganicPostVM[] = periodPosts
    .map((p) => ({
      id: `${p.ad_account_id}:${p.external_id}`,
      profile: name.get(p.ad_account_id)!.name,
      platform: name.get(p.ad_account_id)!.platform,
      kind: p.kind,
      caption: p.caption?.trim() || "Sem legenda",
      permalink: p.permalink,
      thumbnailUrl: p.thumbnail_url,
      publishedAt: p.published_at,
      views: p.views,
      reach: p.reach,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      saves: p.saves,
      interactions: p.interactions,
      engagement: p.reach ? p.interactions / p.reach : null,
    }))
    .sort((a, b) => b.interactions - a.interactions || (b.views ?? 0) - (a.views ?? 0));

  const kinds = new Map<string, { kind: string; posts: number; interactions: number; views: number }>();
  for (const p of vm) {
    const k = kinds.get(p.kind) ?? { kind: p.kind, posts: 0, interactions: 0, views: 0 };
    k.posts += 1;
    k.interactions += p.interactions;
    k.views += p.views ?? 0;
    kinds.set(p.kind, k);
  }

  return {
    profiles,
    hasData: cur.length > 0 || vm.length > 0,
    kpis,
    daily,
    byProfile,
    posts: vm.slice(0, 30),
    byKind: [...kinds.values()].sort((a, b) => b.interactions - a.interactions),
  };
}
