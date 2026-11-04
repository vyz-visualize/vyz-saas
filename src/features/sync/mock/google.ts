// Google Ads simulado: Performance Max, Shopping, pesquisa de marca e de
// categorias, display de remarketing e YouTube, com poucos anúncios por
// campanha. Pesquisa, Shopping e PMax cobram por clique; display e vídeo, por
// mil impressões. Conversões com até 2 casas (atribuição baseada em dados).
//
// Histórias:
//   * "Pesquisa · Categorias genéricas" fica abaixo do equilíbrio (ROAS ~1,4),
//     perde parcela de impressões por orçamento e tem termos que gastam sem
//     converter (vestido de noiva aluguel, molde para baixar…);
//   * "Pesquisa · Marca" domina a própria marca (parcela ~90%) com ROAS alto.

import { apportion } from "../apportion";
import type { AdDay, AdEntity, BreakdownDay, CampaignDay, CampaignEntity, ProductDay, SearchTermDay } from "../dataset";
import { addDays } from "../dates";
import { rollupAccountDaily } from "../rollup";
import { conversionByWeekday, maturity, spendByWeekday, trendFactor, type Trend } from "./calendar";
import { BRAND_TERMS, GENERIC_TERMS, GOOGLE_CAMPAIGNS, GOOGLE_DEVICES, type GoogleAdSpec, type GoogleCampaignSpec, type SearchTermSpec } from "./catalog";
import { between, clamp, jitter, numericId, roundRandom, stream } from "./random";
import { breakdownDays, hourSlices, productDays, productEntities, sumFull, toDailyMetrics, type FullUnits, type MockAccountDataset, type MockContext, type ShareOfSearch } from "./shared";
import { addUnits, isEmpty, splitUnits, toBasic, ZERO_UNITS, type Part, type SplitOptions, type Units } from "./split";

const SCALE = 100;
const SPLIT: SplitOptions = { billing: "cpc", conversionScale: SCALE };

type Account = { dailySpend: number; aov: number; trend: Trend };

type Campaign = {
  spec: GoogleCampaignSpec;
  id: string;
  share: number;
  /** CPC ou CPM (conforme a cobrança), na moeda da conta. */
  cost: number;
  ctr: number;
  cvr: number;
  aov: number;
  impressionShare: number | null;
  lostBudget: number | null;
  viewRate: number | null;
  thruRate: number | null;
  startedOn: string;
  dailyBudget: number;
};

type Ad = { spec: GoogleAdSpec; id: string; campaign: Campaign; weight: number; ctr: number; cvr: number; cost: number };

function accountParams(ctx: MockContext): Account {
  const r = stream(ctx.accountExternalId, "google", "conta");
  return {
    dailySpend: between(r, [900, 2600]) * ctx.fx,
    aov: between(r, [180, 290]) * ctx.fx,
    trend: { amplitude: between(r, [0.04, 0.08]), period: between(r, [80, 130]), phase: r.int(0, 129) },
  };
}

function campaignParams(ctx: MockContext, account: Account): Campaign[] {
  const list = GOOGLE_CAMPAIGNS.map((spec) => {
    const r = stream(ctx.accountExternalId, "google", "campanha", spec.key);
    const share = spec.share * jitter(r, 0.15);
    const roas = between(r, spec.roas);
    const cost = between(r, spec.cost) * ctx.fx;
    const ctr = between(r, spec.ctr);
    const aov = account.aov * between(r, [0.92, 1.08]);
    // a conversão fecha a conta do ROAS (valor ÷ custo)
    const cvr = clamp(spec.billing === "cpc" ? (roas * cost) / aov : (roas * cost) / (1000 * ctr * aov), 0.001, 0.4);
    return {
      spec,
      id: numericId("2", 11, ctx.accountExternalId, "google", "campanha", spec.key),
      share,
      cost,
      ctr,
      cvr,
      aov,
      impressionShare: spec.impressionShare ? between(r, spec.impressionShare.share) : null,
      lostBudget: spec.impressionShare ? between(r, spec.impressionShare.lostBudget) : null,
      viewRate: spec.video ? between(r, spec.video.viewRate) : null,
      thruRate: spec.video ? between(r, spec.video.thruRate) : null,
      startedOn: addDays(ctx.anchor, -r.int(200, 600)),
      dailyBudget: 0,
    };
  });
  const total = list.reduce((a, c) => a + c.share, 0);
  for (const c of list) {
    c.share /= total;
    // limitada pelo orçamento: gasta o orçamento quase todo dia
    const slack = (c.lostBudget ?? 0) >= 0.1 ? 1.02 : 1.15;
    c.dailyBudget = Math.max(10, Math.round((account.dailySpend * c.share * slack) / 10) * 10);
  }
  return list;
}

function adParams(ctx: MockContext, campaign: Campaign): Ad[] {
  return campaign.spec.ads.map((spec) => {
    const r = stream(ctx.accountExternalId, "google", "anuncio", spec.key);
    return {
      spec,
      id: numericId("7", 12, ctx.accountExternalId, "google", "anuncio", spec.key),
      campaign,
      weight: spec.weight * jitter(r, 0.15),
      ctr: spec.ctr * jitter(r, 0.05),
      cvr: spec.cvr * jitter(r, 0.05),
      cost: jitter(r, 0.04),
    };
  });
}

type DayRates = { cost: number; ctr: number; cvr: number; aov: number };

function adDay(ctx: MockContext, ad: Ad, date: string, spend: number, rates: DayRates, r: ReturnType<typeof stream>): FullUnits {
  const c = ad.campaign;
  let impressions: number;
  let clicks: number;
  if (c.spec.billing === "cpc") {
    clicks = roundRandom(r, spend / 100 / (rates.cost * ad.cost));
    impressions = Math.max(clicks, roundRandom(r, clicks / (rates.ctr * ad.ctr)));
  } else {
    impressions = roundRandom(r, (spend / 100 / (rates.cost * ad.cost)) * 1000);
    clicks = Math.min(impressions, roundRandom(r, impressions * rates.ctr * ad.ctr));
  }
  if (spend > 0) impressions = Math.max(1, impressions);
  let conversions = Math.min(clicks * SCALE, roundRandom(r, clicks * Math.min(0.5, rates.cvr * ad.cvr) * SCALE));
  let value = conversions > 0 ? Math.round((conversions / SCALE) * rates.aov * jitter(r, 0.1) * 100) : 0;
  const videoViews = c.viewRate === null ? null : roundRandom(r, impressions * c.viewRate * jitter(r, 0.06));
  const videoThruplays = videoViews === null || c.thruRate === null ? null : roundRandom(r, videoViews * c.thruRate * jitter(r, 0.06));

  const m = maturity(date, ctx.endDate);
  if (m < 1 && conversions > 0) {
    const matured = roundRandom(stream(ctx.accountExternalId, "google", ad.spec.key, date, "maturacao"), conversions * m);
    value = Math.round((value * matured) / conversions);
    conversions = matured;
  }
  return { spend, impressions, clicks, conversions, value, reach: null, linkClicks: null, landingPageViews: null, addToCart: null, initiateCheckout: null, videoViews, videoThruplays };
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4;

/** Parcela de impressões do dia: o que sobra depois da perda por orçamento é perdido por classificação. */
function shareOfSearch(ctx: MockContext, c: Campaign, date: string): ShareOfSearch | undefined {
  if (c.impressionShare === null || c.lostBudget === null) return undefined;
  const r = stream(ctx.accountExternalId, "google", c.spec.key, date, "parcela");
  const share = round4(clamp(c.impressionShare * jitter(r, 0.05), 0.1, 0.97));
  const lostBudget = round4(clamp(c.lostBudget * spendByWeekday(date) * jitter(r, 0.15), 0, 1 - share));
  return { searchImpressionShare: share, searchLostIsBudget: lostBudget, searchLostIsRank: round4(Math.max(0, 1 - share - lostBudget)) };
}

const termText = (spec: SearchTermSpec, brand: string) => spec.term.replace("{marca}", brand).slice(0, 300);

/** Termos de pesquisa do dia: cobrem a maior parte (não tudo) da campanha, como no relatório do Google. */
function searchTermDays(ctx: MockContext, c: Campaign, date: string, total: Units): SearchTermDay[] {
  if (!c.spec.searchTerms || isEmpty(total)) return [];
  const terms = c.spec.searchTerms === "brand" ? BRAND_TERMS : GENERIC_TERMS;
  const r = stream(ctx.accountExternalId, "google", c.spec.key, date, "termos");
  const coverage = between(r, [0.84, 0.93]);
  const clicks = Math.round(total.clicks * coverage);
  const conversions = Math.min(clicks * SCALE, Math.round(total.conversions * between(r, [0.8, 0.95])));
  const covered: Units = {
    clicks,
    impressions: Math.min(total.impressions, Math.max(clicks, Math.round(total.impressions * coverage))),
    spend: Math.round(total.spend * coverage * jitter(r, 0.02)),
    conversions,
    value: total.conversions > 0 ? Math.round((total.value * conversions) / total.conversions) : 0,
  };
  const parts: Part[] = terms.map((t) => {
    const account = stream(ctx.accountExternalId, "google", "termo", t.seed ?? t.term);
    const day = stream(ctx.accountExternalId, "google", "termo", t.seed ?? t.term, date);
    const present = day.next() < t.presence;
    return {
      weight: present ? t.weight * jitter(account, 0.2) * jitter(day, 0.25) : 0,
      ctr: t.ctr * jitter(day, 0.08),
      cvr: t.cvr * jitter(day, 0.15),
      aov: jitter(day, 0.08),
      cost: jitter(account, 0.12),
    };
  });
  const units = splitUnits(covered, parts, SPLIT);
  return terms.flatMap((t, i) =>
    units[i].impressions > 0 ? [{ campaignExternalId: c.id, date, searchTerm: termText(t, ctx.brandTerm), matchType: t.matchType, ...toBasic(units[i], SCALE) }] : [],
  );
}

export function generateGoogle(ctx: MockContext): MockAccountDataset {
  const account = accountParams(ctx);
  const campaigns = campaignParams(ctx, account);
  const ads = campaigns.flatMap((c) => adParams(ctx, c));

  const campaignDaily: CampaignDay[] = [];
  const adDaily: AdDay[] = [];
  const productDaily: ProductDay[] = [];
  const searchTermDaily: SearchTermDay[] = [];
  const breakdownDaily: BreakdownDay[] = [];

  for (const date of ctx.dates) {
    const market = stream(ctx.accountExternalId, "google", "mercado", date);
    const costShock = jitter(market, 0.05);
    const cvrShock = jitter(market, 0.08);
    let accountUnits: Units = ZERO_UNITS;
    let productUnits: Units = ZERO_UNITS;

    for (const c of campaigns) {
      const r = stream(ctx.accountExternalId, "google", c.spec.key, date);
      const spend = Math.round(account.dailySpend * c.share * spendByWeekday(date) * trendFactor(account.trend, date) * jitter(r, 0.1) * 100);
      const rates: DayRates = {
        cost: c.cost * costShock * jitter(r, 0.06),
        ctr: c.ctr * jitter(r, 0.06),
        cvr: c.cvr * jitter(r, 0.1) * conversionByWeekday(date) * cvrShock,
        aov: c.aov * jitter(r, 0.05),
      };
      const own = ads.filter((ad) => ad.campaign === c);
      const streams = own.map((ad) => stream(ctx.accountExternalId, "google", ad.spec.key, date));
      const spends = apportion(
        spend,
        own.map((ad, i) => ad.weight * jitter(streams[i], 0.15)),
      );
      const rows = own.map((ad, i) => adDay(ctx, ad, date, spends[i], rates, streams[i]));
      rows.forEach((u, i) => {
        if (u.impressions === 0 && u.spend === 0) return;
        adDaily.push({
          adExternalId: own[i].id,
          date,
          spend: u.spend / 100,
          impressions: u.impressions,
          reach: null,
          clicks: u.clicks,
          linkClicks: null,
          conversions: u.conversions / SCALE,
          conversionValue: u.value / 100,
          videoViews: u.videoViews,
          videoThruplays: u.videoThruplays,
        });
      });

      const total = sumFull(rows);
      if (total.impressions === 0 && total.spend === 0) continue;
      campaignDaily.push({ campaignExternalId: c.id, date, ...toDailyMetrics(total, SCALE, shareOfSearch(ctx, c, date)) });
      searchTermDaily.push(...searchTermDays(ctx, c, date, total));
      accountUnits = addUnits(accountUnits, total);
      if (c.spec.products) productUnits = addUnits(productUnits, total);
    }

    productDaily.push(...productDays(ctx, date, productUnits, SPLIT));
    breakdownDaily.push(
      ...breakdownDays(ctx, date, "device", GOOGLE_DEVICES, accountUnits, SPLIT),
      ...breakdownDays(ctx, date, "hour", hourSlices(date), accountUnits, SPLIT),
    );
  }

  const campaignEntities: CampaignEntity[] = campaigns.map((c) => ({
    externalId: c.id,
    name: c.spec.name,
    status: "active",
    objective: "SALES",
    channel: c.spec.channel,
    funnelStage: c.spec.funnelStage,
    dailyBudget: c.dailyBudget,
    startedOn: c.startedOn,
  }));

  const adEntities: AdEntity[] = ads.map((ad) => ({
    externalId: ad.id,
    campaignExternalId: ad.campaign.id,
    name: ad.spec.name,
    format: ad.spec.format,
    status: "active",
    headline: ad.spec.headline,
    body: ad.spec.body,
    callToAction: null,
    thumbnailUrl: null,
    landingUrl: `${ctx.site}${ad.spec.path}?utm_source=google&utm_medium=cpc&utm_campaign=${ad.campaign.spec.key}`,
  }));

  const generic = campaigns.find((c) => c.spec.searchTerms === "generic")!;

  return {
    platform: "google",
    accountExternalId: ctx.accountExternalId,
    currency: ctx.currency,
    range: { from: ctx.dates[0], to: ctx.endDate },
    campaigns: campaignEntities,
    ads: adEntities,
    products: productEntities(ctx),
    accountDaily: rollupAccountDaily(campaignDaily),
    campaignDaily,
    adDaily,
    breakdownDaily,
    searchTermDaily,
    productDaily,
    stories: {
      belowBreakEvenCampaign: campaigns.find((c) => c.spec.story === "below_break_even")!.id,
      fatiguedAd: null,
      budgetLimitedCampaign: generic.id,
      wastefulSearchTerms: GENERIC_TERMS.filter((t) => t.cvr === 0).map((t) => termText(t, ctx.brandTerm)),
    },
  };
}
