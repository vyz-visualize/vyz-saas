// Meta Ads simulado: prospecção (Advantage+, lookalike, interesses),
// remarketing, catálogo e retenção, com 3 a 5 criativos por campanha. Os
// números saem de baixo para cima: o dia de cada anúncio (verba → impressões →
// cliques no link → página → carrinho → checkout → compra); a campanha soma
// os anúncios e a conta soma as campanhas.
//
// Histórias:
//   * "Prospecção · Interesses" fica abaixo do equilíbrio (ROAS ~1,15);
//   * "IMG · Oferta 15% OFF", no remarketing, cansa o público: desde que entrou
//     no ar (34 dias antes da âncora) a frequência sobe e o CTR cai;
//   * "VID · Coleção Primavera" é novo (9 dias antes da âncora) e
//     "IMG · Coleção Inverno" foi pausado 21 dias antes da âncora.

import { apportion } from "../apportion";
import type { AdCreativeMetrics, AdDay, AdEntity, BreakdownDay, CampaignDay, CampaignEntity, ProductDay } from "../dataset";
import { addDays, diffDays } from "../dates";
import { rollupAccountDaily } from "../rollup";
import { conversionByWeekday, maturity, spendByWeekday, trendFactor, type Trend } from "./calendar";
import { META_CAMPAIGNS, META_DEVICES, META_PLACEMENTS, REGIONS, type MetaAdSpec, type MetaCampaignSpec } from "./catalog";
import { between, clamp, jitter, numericId, roundRandom, stream } from "./random";
import { AGE_GENDER, breakdownDays, productDays, productEntities, sumFull, toDailyMetrics, type FullUnits, type MockAccountDataset, type MockContext } from "./shared";
import { addUnits, ZERO_UNITS, type SplitOptions, type Units } from "./split";

const SPLIT: SplitOptions = { billing: "cpm", conversionScale: 1 };

type Account = { dailySpend: number; aov: number; cpm: number; clickRatio: number; trend: Trend };

type Campaign = {
  spec: MetaCampaignSpec;
  id: string;
  share: number;
  ctr: number;
  cpm: number;
  frequency: number;
  lpv: number;
  atc: number;
  ic: number;
  purchase: number;
  aov: number;
  /** Alcance da campanha ÷ soma do alcance dos anúncios (a mesma pessoa vê mais de um). */
  dedup: number;
  startedOn: string;
  dailyBudget: number;
};

type Ad = {
  spec: MetaAdSpec;
  id: string;
  campaign: Campaign;
  weight: number;
  ctr: number;
  cvr: number;
  frequency: number;
  cpm: number;
  hook: number | null;
  thru: number;
  launch: string;
  end: string | null;
};

/** Taxas da campanha num dia (com o ruído do dia já aplicado). */
type DayRates = { cpm: number; ctr: number; lpv: number; atc: number; ic: number; purchase: number; aov: number; frequency: number; clickRatio: number };

type Effect = { frequency: number; ctr: number; weight: number; cvr: number };

const NO_EFFECT: Effect = { frequency: 1, ctr: 1, weight: 1, cvr: 1 };

function accountParams(ctx: MockContext): Account {
  const r = stream(ctx.accountExternalId, "meta", "conta");
  return {
    dailySpend: between(r, [1400, 4200]) * ctx.fx,
    aov: between(r, [170, 280]) * ctx.fx,
    cpm: between(r, [18, 27]) * ctx.fx,
    clickRatio: between(r, [1.45, 1.85]),
    trend: { amplitude: between(r, [0.04, 0.09]), period: between(r, [84, 126]), phase: r.int(0, 125) },
  };
}

function campaignParams(ctx: MockContext, account: Account): Campaign[] {
  const list = META_CAMPAIGNS.map((spec) => {
    const r = stream(ctx.accountExternalId, "meta", "campanha", spec.key);
    const share = spec.share * jitter(r, 0.15);
    const roas = between(r, spec.roas);
    const ctr = between(r, spec.ctr);
    const cpm = account.cpm * between(r, spec.cpm);
    const frequency = between(r, spec.frequency);
    const lpv = between(r, spec.lpv);
    const ic = between(r, [0.45, 0.6]);
    const purchase = between(r, [0.5, 0.68]);
    const aov = account.aov * between(r, [0.92, 1.08]);
    // a taxa de carrinho fecha a conta do ROAS: ROAS = 1000 × CTR × LPV × carrinho × checkout × compra × ticket ÷ CPM
    const atc = clamp((roas * cpm) / (1000 * ctr * lpv * ic * purchase * aov), 0.03, 0.35);
    return {
      spec,
      id: numericId("1202", 18, ctx.accountExternalId, "meta", "campanha", spec.key),
      share,
      ctr,
      cpm,
      frequency,
      lpv,
      atc,
      ic,
      purchase,
      aov,
      dedup: between(r, [0.86, 0.94]),
      startedOn: addDays(ctx.anchor, -r.int(220, 520)),
      dailyBudget: 0,
    };
  });
  const total = list.reduce((a, c) => a + c.share, 0);
  for (const c of list) {
    c.share /= total;
    c.dailyBudget = Math.max(10, Math.round((account.dailySpend * c.share * 1.12) / 10) * 10);
  }
  return list;
}

function adParams(ctx: MockContext, campaign: Campaign): Ad[] {
  return campaign.spec.ads.map((spec) => {
    const r = stream(ctx.accountExternalId, "meta", "anuncio", spec.key);
    return {
      spec,
      id: numericId("1202", 18, ctx.accountExternalId, "meta", "anuncio", spec.key),
      campaign,
      weight: spec.weight * jitter(r, 0.15),
      ctr: spec.ctr * jitter(r, 0.06),
      cvr: spec.cvr * jitter(r, 0.06),
      frequency: (spec.frequency ?? 1) * jitter(r, 0.04),
      cpm: jitter(r, 0.05),
      hook: spec.hook ? between(r, spec.hook) : null,
      thru: between(r, [0.2, 0.32]),
      launch: addDays(ctx.anchor, spec.launch ?? -r.int(100, 200)),
      end: spec.end === undefined ? null : addDays(ctx.anchor, spec.end),
    };
  });
}

const isLive = (ad: Ad, date: string) => date >= ad.launch && (ad.end === null || date < ad.end);

/** Criativo novo ganha verba aos poucos (fase de aprendizado). */
const rampUp = (ad: Ad, date: string) => (ad.spec.launch === undefined ? 1 : Math.min(1, (diffDays(ad.launch, date) + 1) / 5));

/** Cansaço do público: 0 quando o anúncio entra no ar, perto de 1 depois de umas 7 semanas. */
const fatigueIndex = (daysLive: number) => 1 - Math.exp(-Math.max(0, daysLive) / 16);

function storyEffect(ad: Ad, date: string): Effect {
  if (ad.spec.story !== "fatigue") return NO_EFFECT;
  const f = fatigueIndex(diffDays(ad.launch, date));
  // a frequência sobe, o CTR cai e o leilão tira verba do anúncio
  return { frequency: 1 + 1.25 * f, ctr: 1 - 0.6 * f, weight: 1 - 0.45 * f, cvr: 1 - 0.15 * f };
}

function adDay(ctx: MockContext, ad: Ad, date: string, spend: number, rates: DayRates, effect: Effect, r: ReturnType<typeof stream>): FullUnits {
  const impressions = spend > 0 ? Math.max(1, roundRandom(r, (spend / 100 / (rates.cpm * ad.cpm)) * 1000)) : 0;
  const frequency = Math.max(1.01, rates.frequency * ad.frequency * effect.frequency * jitter(r, 0.04));
  const reach = impressions > 0 ? clamp(Math.round(impressions / frequency), 1, impressions) : 0;
  const linkClicks = Math.min(impressions, roundRandom(r, impressions * rates.ctr * ad.ctr * effect.ctr * jitter(r, 0.08)));
  const clicks = Math.min(impressions, linkClicks + roundRandom(r, linkClicks * (rates.clickRatio - 1) * jitter(r, 0.1)));
  const quality = Math.sqrt(ad.cvr * effect.cvr);
  const landingPageViews = roundRandom(r, linkClicks * rates.lpv);
  const addToCart = roundRandom(r, landingPageViews * Math.min(0.9, rates.atc * quality));
  const initiateCheckout = roundRandom(r, addToCart * rates.ic);
  let conversions = roundRandom(r, initiateCheckout * Math.min(0.95, rates.purchase * quality));
  let value = conversions > 0 ? Math.round(conversions * rates.aov * jitter(r, 0.1) * 100) : 0;
  const videoViews = ad.hook === null ? null : roundRandom(r, impressions * ad.hook * jitter(r, 0.06));
  const videoThruplays = videoViews === null ? null : roundRandom(r, videoViews * ad.thru * jitter(r, 0.06));

  // compras recentes ainda chegando (sequência à parte: o resto do dia não muda com o período pedido)
  const m = maturity(date, ctx.endDate);
  if (m < 1 && conversions > 0) {
    const matured = roundRandom(stream(ctx.accountExternalId, "meta", ad.spec.key, date, "maturacao"), conversions * m);
    value = Math.round((value * matured) / conversions);
    conversions = matured;
  }
  return { spend, impressions, clicks, conversions, value, reach, linkClicks, landingPageViews, addToCart, initiateCheckout, videoViews, videoThruplays };
}

const LEADS_OBJECTIVE = "OUTCOME_LEADS";

/**
 * Engajamento, leads, visitas ao perfil e retenção de vídeo do anúncio no dia.
 * Sorteios à parte (sequência própria): nenhum número que já existia muda.
 */
function creativeMetrics(ctx: MockContext, ad: Ad, date: string, u: FullUnits): AdCreativeMetrics {
  const base = stream(ctx.accountExternalId, "meta", "criativo", ad.spec.key);
  const engagementRate = between(base, [0.008, 0.026]);
  const watchPerView = between(base, [5, 13]);
  const r = stream(ctx.accountExternalId, "meta", ad.spec.key, date, "criativo");
  const engagement = roundRandom(r, u.impressions * engagementRate * jitter(r, 0.12));
  const reactions = roundRandom(r, engagement * 0.58 * jitter(r, 0.08));
  const comments = roundRandom(r, engagement * 0.08 * jitter(r, 0.15));
  const shares = roundRandom(r, engagement * 0.07 * jitter(r, 0.15));
  const saves = roundRandom(r, engagement * 0.05 * jitter(r, 0.15));
  const profileVisits = roundRandom(r, u.clicks * 0.06 * jitter(r, 0.15));
  const leads = ad.campaign.spec.objective === LEADS_OBJECTIVE ? roundRandom(r, (u.linkClicks ?? 0) * 0.09 * jitter(r, 0.12)) : null;
  const views = u.videoViews;
  const p25 = views === null ? null : roundRandom(r, views * 0.62 * jitter(r, 0.05));
  const p50 = p25 === null ? null : roundRandom(r, p25 * 0.62 * jitter(r, 0.05));
  const p75 = p50 === null ? null : roundRandom(r, p50 * 0.68 * jitter(r, 0.05));
  const p95 = p75 === null ? null : roundRandom(r, p75 * 0.72 * jitter(r, 0.05));
  const p100 = p95 === null ? null : roundRandom(r, p95 * 0.86 * jitter(r, 0.05));
  const watch = views === null ? null : Math.round(views * watchPerView * jitter(r, 0.08));
  return {
    leads,
    postEngagement: engagement,
    postReactions: reactions,
    postComments: comments,
    postShares: shares,
    postSaves: saves,
    profileVisits,
    videoP25: p25,
    videoP50: p50,
    videoP75: p75,
    videoP95: p95,
    videoP100: p100,
    videoWatchSeconds: watch,
  };
}

/**
 * Pessoas únicas da conta no dia: as campanhas de prospecção e de remarketing
 * se sobrepõem, então fica entre o maior alcance de campanha e a soma deles.
 */
function dedupReach(reaches: readonly number[], r: ReturnType<typeof stream>): number {
  const total = reaches.reduce((a, b) => a + b, 0);
  const largest = Math.max(...reaches);
  return clamp(Math.round(total * 0.78 * jitter(r, 0.04)), largest, total);
}

export function generateMeta(ctx: MockContext): MockAccountDataset {
  const account = accountParams(ctx);
  const campaigns = campaignParams(ctx, account);
  const ads = campaigns.flatMap((c) => adParams(ctx, c));

  const campaignDaily: CampaignDay[] = [];
  const adDaily: AdDay[] = [];
  const productDaily: ProductDay[] = [];
  const breakdownDaily: BreakdownDay[] = [];
  /** Alcance da conta no dia (pessoas únicas, nível account): menor que a soma das campanhas. */
  const accountReach = new Map<string, number>();

  for (const date of ctx.dates) {
    const market = stream(ctx.accountExternalId, "meta", "mercado", date);
    const cpmShock = jitter(market, 0.06);
    const cvrShock = jitter(market, 0.08);
    let accountUnits: Units = ZERO_UNITS;
    let catalogUnits: Units = ZERO_UNITS;
    const reaches: number[] = [];

    for (const c of campaigns) {
      const r = stream(ctx.accountExternalId, "meta", c.spec.key, date);
      const spend = Math.round(account.dailySpend * c.share * spendByWeekday(date) * trendFactor(account.trend, date) * jitter(r, 0.12) * 100);
      const rates: DayRates = {
        cpm: c.cpm * cpmShock * jitter(r, 0.05),
        ctr: c.ctr * jitter(r, 0.07),
        lpv: Math.min(0.95, c.lpv * jitter(r, 0.03)),
        atc: c.atc * jitter(r, 0.08) * conversionByWeekday(date) * cvrShock,
        ic: Math.min(0.9, c.ic * jitter(r, 0.05)),
        purchase: Math.min(0.9, c.purchase * jitter(r, 0.05)),
        aov: c.aov * jitter(r, 0.05),
        frequency: c.frequency * jitter(r, 0.03),
        clickRatio: account.clickRatio,
      };
      const dedup = c.dedup * jitter(r, 0.02);

      const live = ads.filter((ad) => ad.campaign === c && isLive(ad, date));
      if (live.length === 0) continue;
      const streams = live.map((ad) => stream(ctx.accountExternalId, "meta", ad.spec.key, date));
      const effects = live.map((ad) => storyEffect(ad, date));
      const spends = apportion(
        spend,
        live.map((ad, i) => ad.weight * rampUp(ad, date) * effects[i].weight * jitter(streams[i], 0.18)),
      );

      const rows = live.map((ad, i) => adDay(ctx, ad, date, spends[i], rates, effects[i], streams[i]));
      rows.forEach((u, i) => {
        if (u.impressions === 0 && u.spend === 0) return;
        adDaily.push({
          adExternalId: live[i].id,
          date,
          spend: u.spend / 100,
          impressions: u.impressions,
          reach: u.reach,
          clicks: u.clicks,
          linkClicks: u.linkClicks,
          conversions: u.conversions,
          conversionValue: u.value / 100,
          videoViews: u.videoViews,
          videoThruplays: u.videoThruplays,
          ...creativeMetrics(ctx, live[i], date, u),
        });
      });

      const total = sumFull(rows);
      if (total.impressions === 0 && total.spend === 0) continue;
      total.reach = total.impressions > 0 ? clamp(Math.round((total.reach ?? 0) * dedup), 1, total.impressions) : 0;
      campaignDaily.push({ campaignExternalId: c.id, date, ...toDailyMetrics(total, 1) });
      reaches.push(total.reach);
      accountUnits = addUnits(accountUnits, total);
      if (c.spec.catalog) catalogUnits = addUnits(catalogUnits, total);
    }

    if (reaches.length) accountReach.set(date, dedupReach(reaches, stream(ctx.accountExternalId, "meta", "alcance", date)));

    productDaily.push(...productDays(ctx, date, catalogUnits, SPLIT));
    breakdownDaily.push(
      ...breakdownDays(ctx, date, "age_gender", AGE_GENDER, accountUnits, SPLIT),
      ...breakdownDays(ctx, date, "placement", META_PLACEMENTS, accountUnits, SPLIT),
      ...breakdownDays(ctx, date, "device", META_DEVICES, accountUnits, SPLIT),
      ...breakdownDays(ctx, date, "region", REGIONS, accountUnits, SPLIT),
    );
  }

  const campaignEntities: CampaignEntity[] = campaigns.map((c) => ({
    externalId: c.id,
    name: c.spec.name,
    status: "active",
    objective: c.spec.objective ?? "OUTCOME_SALES",
    channel: null,
    funnelStage: c.spec.funnelStage,
    dailyBudget: c.dailyBudget,
    startedOn: c.startedOn,
  }));

  const adEntities: AdEntity[] = ads
    .filter((ad) => ad.launch <= ctx.endDate)
    .map((ad) => ({
      externalId: ad.id,
      campaignExternalId: ad.campaign.id,
      name: ad.spec.name,
      format: ad.spec.format,
      status: ad.end !== null && ad.end <= ctx.endDate ? "paused" : "active",
      headline: ad.spec.headline,
      body: ad.spec.body,
      callToAction: ad.spec.cta,
      thumbnailUrl: null,
      // domínio reservado (.example): nunca aponta para um post real
      postUrl: `${ctx.site.replace("https://", "https://instagram.")}/p/${ad.spec.key}`,
      landingUrl: `${ctx.site}${ad.spec.path}?utm_source=facebook&utm_medium=paid_social&utm_campaign=${ad.campaign.spec.key}&utm_content=${ad.spec.key}`,
    }));

  const fatigued = ads.find((ad) => ad.spec.story === "fatigue" && ad.launch <= ctx.endDate);

  return {
    platform: "meta",
    accountExternalId: ctx.accountExternalId,
    currency: ctx.currency,
    range: { from: ctx.dates[0], to: ctx.endDate },
    campaigns: campaignEntities,
    ads: adEntities,
    products: productEntities(ctx),
    accountDaily: rollupAccountDaily(campaignDaily).map((day) => ({ ...day, reach: accountReach.get(day.date) ?? day.reach })),
    campaignDaily,
    adDaily,
    breakdownDaily,
    searchTermDaily: [],
    productDaily,
    stories: {
      belowBreakEvenCampaign: campaigns.find((c) => c.spec.story === "below_break_even")!.id,
      fatiguedAd: fatigued?.id ?? null,
      budgetLimitedCampaign: null,
      wastefulSearchTerms: [],
    },
  };
}
