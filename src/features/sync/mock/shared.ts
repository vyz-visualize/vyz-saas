// Contexto do gerador (conta, período, âncora das histórias) e o que Meta e
// Google compartilham: linhas em unidades inteiras, o catálogo de produtos e
// as quebras do dia.

import { ageGenderValue, HOURS, type AgeBucket, type Gender } from "../breakdowns";
import type { AccountDataset, BreakdownDay, BreakdownDimension, DailyMetrics, ProductDay, ProductEntity, SyncPlatform } from "../dataset";
import { weekday } from "../dates";
import { AGES, GENDER_SHAPE, HOUR_SHAPE, PRODUCTS, type Slice } from "./catalog";
import { jitter, stream } from "./random";
import { isEmpty, splitUnits, toBasic, type Part, type SplitOptions, type Units } from "./split";

export type MockContext = {
  platform: SyncPlatform;
  accountExternalId: string;
  /** Nome da loja ("Loja Exemplo") e como aparece na pesquisa ("loja exemplo"). */
  brand: string;
  brandTerm: string;
  /** Domínio reservado (.example): nunca aponta para um site real. */
  site: string;
  currency: string;
  /** Conversão aproximada a partir de BRL (os números são pensados em reais). */
  fx: number;
  endDate: string;
  dates: string[];
  /** Data de referência das histórias (criativo cansando, campanha nova). */
  anchor: string;
};

/** As histórias plantadas nos dados (para testes e para conferir o painel). */
export type MockStories = {
  /** Campanha com ROAS bem abaixo do equilíbrio. */
  belowBreakEvenCampaign: string;
  /** Meta: criativo com a frequência subindo e o CTR caindo. */
  fatiguedAd: string | null;
  /** Google: pesquisa limitada pelo orçamento (perde parcela de impressões). */
  budgetLimitedCampaign: string | null;
  /** Google: termos que gastam e não convertem. */
  wastefulSearchTerms: string[];
};

export type MockAccountDataset = AccountDataset & { stories: MockStories };

// ---- linhas em unidades ---------------------------------------------------------------

/** Linha completa em unidades: centavos e conversões na escala da plataforma. */
export type FullUnits = Units & {
  reach: number | null;
  linkClicks: number | null;
  landingPageViews: number | null;
  addToCart: number | null;
  initiateCheckout: number | null;
  videoViews: number | null;
  videoThruplays: number | null;
};

const NULLABLE = ["reach", "linkClicks", "landingPageViews", "addToCart", "initiateCheckout", "videoViews", "videoThruplays"] as const;

export function sumFull(rows: readonly FullUnits[]): FullUnits {
  const out: FullUnits = { spend: 0, impressions: 0, clicks: 0, conversions: 0, value: 0, reach: null, linkClicks: null, landingPageViews: null, addToCart: null, initiateCheckout: null, videoViews: null, videoThruplays: null };
  for (const r of rows) {
    out.spend += r.spend;
    out.impressions += r.impressions;
    out.clicks += r.clicks;
    out.conversions += r.conversions;
    out.value += r.value;
    for (const k of NULLABLE) {
      const v = r[k];
      if (v != null) out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

export type ShareOfSearch = Pick<DailyMetrics, "searchImpressionShare" | "searchLostIsBudget" | "searchLostIsRank">;

const NO_SEARCH_SHARE: ShareOfSearch = { searchImpressionShare: null, searchLostIsBudget: null, searchLostIsRank: null };

export function toDailyMetrics(u: FullUnits, conversionScale: number, share: ShareOfSearch = NO_SEARCH_SHARE): DailyMetrics {
  const basic = toBasic(u, conversionScale);
  return {
    ...basic,
    // amostra: o mesmo número serve de lead e de conversa (cada modelo lê o do objetivo dele)
    leads: basic.conversions,
    messages: basic.conversions,
    reach: u.reach,
    linkClicks: u.linkClicks,
    landingPageViews: u.landingPageViews,
    addToCart: u.addToCart,
    initiateCheckout: u.initiateCheckout,
    videoViews: u.videoViews,
    videoThruplays: u.videoThruplays,
    ...share,
  };
}

// ---- produtos ------------------------------------------------------------------------

const MEAN_PRICE = PRODUCTS.reduce((a, p) => a + p.price, 0) / PRODUCTS.length;

export function productEntities(ctx: MockContext): ProductEntity[] {
  return PRODUCTS.map((p) => ({
    externalId: p.sku,
    title: p.title,
    brand: ctx.brand,
    category: p.category,
    imageUrl: null,
    price: Math.round(p.price * ctx.fx * 100) / 100,
  }));
}

/** Divide o que as campanhas de catálogo fizeram no dia entre os produtos. */
export function productDays(ctx: MockContext, date: string, total: Units, opts: SplitOptions): ProductDay[] {
  if (isEmpty(total)) return [];
  const parts: Part[] = PRODUCTS.map((p) => {
    const account = stream(ctx.accountExternalId, "product", p.sku);
    const day = stream(ctx.accountExternalId, ctx.platform, "product", p.sku, date);
    return {
      weight: p.popularity * jitter(account, 0.25) * jitter(day, 0.3),
      ctr: jitter(account, 0.15),
      cvr: (MEAN_PRICE / p.price) ** 0.35 * jitter(account, 0.1),
      aov: p.price,
    };
  });
  const units = splitUnits(total, parts, opts);
  return PRODUCTS.flatMap((p, i) => (units[i].impressions > 0 ? [{ productExternalId: p.sku, date, ...toBasic(units[i], opts.conversionScale) }] : []));
}

// ---- quebras ----------------------------------------------------------------------------

export const AGE_GENDER: readonly Slice[] = AGES.flatMap((a) =>
  GENDER_SHAPE.map((g) => ({
    value: ageGenderValue(a.value as AgeBucket, g.value as Gender),
    weight: a.weight * g.weight,
    ctr: (a.ctr ?? 1) * (g.ctr ?? 1),
    cvr: (a.cvr ?? 1) * (g.cvr ?? 1),
    aov: (a.aov ?? 1) * (g.aov ?? 1),
  })),
);

/** Horas do dia; no fim de semana a manhã esfria e a tarde esquenta. */
export function hourSlices(date: string): Slice[] {
  const weekend = weekday(date) === 0 || weekday(date) === 6;
  return HOUR_SHAPE.map((h, i) => ({
    value: HOURS[i],
    weight: h.weight * (weekend ? (i >= 7 && i <= 11 ? 0.8 : i >= 14 && i <= 18 ? 1.12 : 1) : 1),
    cvr: h.cvr,
  }));
}

/** Divide o total da conta no dia por uma dimensão (cada valor com o seu perfil e um ruído próprio). */
export function breakdownDays(ctx: MockContext, date: string, dimension: BreakdownDimension, slices: readonly Slice[], total: Units, opts: SplitOptions): BreakdownDay[] {
  if (isEmpty(total)) return [];
  const parts: Part[] = slices.map((s) => {
    const account = stream(ctx.accountExternalId, ctx.platform, dimension, s.value);
    const day = stream(ctx.accountExternalId, ctx.platform, dimension, s.value, date);
    return {
      weight: s.weight * jitter(account, 0.12) * jitter(day, 0.08),
      cost: (s.cost ?? 1) * jitter(day, 0.04),
      ctr: (s.ctr ?? 1) * jitter(day, 0.05),
      cvr: (s.cvr ?? 1) * jitter(account, 0.06) * jitter(day, 0.1),
      aov: (s.aov ?? 1) * jitter(day, 0.05),
    };
  });
  const units = splitUnits(total, parts, opts);
  return slices.flatMap((s, i) => (isEmpty(units[i]) ? [] : [{ date, dimension, value: s.value, ...toBasic(units[i], opts.conversionScale) }]));
}
