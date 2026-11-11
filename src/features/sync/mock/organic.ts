// Orgânico simulado (Instagram e Página do Facebook): determinístico por perfil e
// por dia, como o gerador dos anúncios. O mesmo dia gera sempre os mesmos números,
// qualquer que seja o período pedido; os seguidores crescem a partir de uma base
// presa à âncora (o dia antes de a conta ser descoberta).

import { addDays, dateRange, diffDays, weekday } from "../dates";
import type { OrganicDataset, OrganicDay, OrganicPlatform, OrganicPost, OrganicPostKind } from "../organic";
import { between, clamp, jitter, numericId, roundRandom, stream } from "./random";

export type OrganicMockInput = {
  platform: OrganicPlatform;
  accountExternalId: string;
  accountName: string;
  endDate: string;
  days: number;
  anchorDate: string;
};

const CAPTIONS = [
  "Novidade chegando: conheça a coleção nova",
  "Bastidores da produção desta semana",
  "3 dicas para escolher o tamanho certo",
  "Cliente real, foto real: obrigado pelo carinho",
  "Últimas peças com frete grátis",
  "Como usar no dia a dia",
  "Promoção relâmpago só hoje",
  "Antes e depois",
  "Perguntas que vocês mais mandam",
  "Lançamento: o favorito voltou",
];

function postKind(platform: OrganicPlatform, roll: number): OrganicPostKind {
  if (platform === "facebook") return roll < 0.55 ? "post" : roll < 0.8 ? "video" : roll < 0.9 ? "reel" : "text";
  return roll < 0.35 ? "reel" : roll < 0.6 ? "carousel" : roll < 0.8 ? "post" : "story";
}

/** Peso de alcance por formato (reels vão mais longe). */
const KIND_REACH: Record<OrganicPostKind, number> = { reel: 2.4, video: 1.4, carousel: 1.2, post: 1, story: 0.45, text: 0.6 };

export function generateOrganicData(input: OrganicMockInput): OrganicDataset {
  const { platform, accountExternalId: acc, endDate, days, anchorDate } = input;
  const base = stream("organic", platform, acc, "base");
  const ig = platform === "instagram";
  // tamanho do perfil e engajamento médio, estáveis por perfil
  const followers0 = Math.round(between(base, ig ? [8_000, 60_000] : [4_000, 35_000]));
  const reachRate = between(base, ig ? [0.07, 0.16] : [0.03, 0.08]);
  const engageRate = between(base, ig ? [0.035, 0.07] : [0.012, 0.03]);
  const growth = between(base, [0.0006, 0.0022]);

  const dates = dateRange(endDate, days);
  // seguidores: crescimento diário a partir da âncora (dias antes dela descontam)
  const followersAt = (date: string) => {
    const r = stream("organic", platform, acc, "followers", date);
    const offset = diffDays(anchorDate, date);
    return Math.max(0, Math.round(followers0 * (1 + growth * offset) * jitter(r, 0.002)));
  };

  const posts: OrganicPost[] = [];
  const daily: OrganicDay[] = dates.map((date) => {
    const r = stream("organic", platform, acc, "day", date);
    const followers = followersAt(date);
    const prev = followersAt(addDays(date, -1));
    const net = followers - prev;
    const unfollows = Math.max(0, roundRandom(r, followers * between(r, [0.0004, 0.0012])));
    const follows = Math.max(0, net + unfollows);
    // fim de semana um pouco mais baixo no orgânico de marca
    const wk = weekday(date);
    const dayFactor = wk === 0 || wk === 6 ? 0.85 : 1;
    const nPosts = r.next() < (ig ? 0.75 : 0.55) ? (r.next() < 0.3 ? 2 : 1) : 0;

    // posts do dia (números de vida inteira)
    let postViews = 0;
    for (let i = 0; i < nPosts; i++) {
      const pr = stream("organic", platform, acc, "post", date, i);
      const kind = postKind(platform, pr.next());
      const reach = Math.round(followers * reachRate * KIND_REACH[kind] * jitter(pr, 0.45));
      const views = Math.round(reach * between(pr, [1.15, 1.9]));
      const likes = kind === "story" ? null : Math.round(reach * engageRate * jitter(pr, 0.4));
      const comments = kind === "story" ? null : Math.round((likes ?? 0) * between(pr, [0.02, 0.08]));
      const shares = Math.round(reach * between(pr, [0.002, 0.012]));
      const saves = ig && kind !== "story" ? Math.round(reach * between(pr, [0.004, 0.02])) : null;
      const interactions = (likes ?? 0) + (comments ?? 0) + shares + (saves ?? 0);
      postViews += views;
      const hour = 9 + Math.floor(pr.next() * 11);
      posts.push({
        externalId: numericId(ig ? "1789" : `${acc}_`, ig ? 17 : acc.length + 17, platform, acc, date, i),
        kind,
        caption: pr.pick(CAPTIONS),
        permalink: ig ? `https://www.instagram.com/p/${numericId("", 11, "perma", acc, date, i)}/` : `https://www.facebook.com/${acc}/posts/${numericId("", 16, "perma", acc, date, i)}`,
        thumbnailUrl: null,
        publishedAt: `${date}T${String(hour).padStart(2, "0")}:00:00-03:00`,
        views,
        reach,
        likes,
        comments,
        shares,
        saves,
        interactions,
      });
    }

    // conta inteira no dia: o que os posts recentes ainda entregam + stories + perfil
    const reach = Math.round(followers * reachRate * dayFactor * jitter(r, 0.25) + postViews * 0.25);
    const views = Math.round(reach * between(r, [1.4, 2.2]));
    const likes = Math.round(reach * engageRate * jitter(r, 0.25));
    const comments = Math.round(likes * between(r, [0.02, 0.06]));
    const shares = Math.round(reach * between(r, [0.002, 0.008]));
    const saves = ig ? Math.round(reach * between(r, [0.003, 0.012])) : null;
    const interactions = likes + comments + shares + (saves ?? 0);
    return {
      date,
      followers,
      follows,
      unfollows,
      views,
      reach,
      profileViews: ig ? Math.round(reach * between(r, [0.02, 0.06])) : null,
      accountsEngaged: Math.round(clamp(interactions * between(r, [0.55, 0.8]), 0, reach)),
      interactions,
      likes,
      comments,
      shares,
      saves,
      linkClicks: Math.round(reach * between(r, ig ? [0.001, 0.004] : [0.002, 0.008])),
      posts: nPosts,
    };
  });

  return { platform, accountExternalId: acc, range: { from: dates[0], to: dates[dates.length - 1] }, daily, posts };
}
