// Dashboards de amostra: os anúncios vêm do simulador da Meta e os cards, do
// simulador do modelo. Aqui os anúncios são escalados para fechar com o modelo no
// período: a soma de investimento, impressões, cliques e resultados dá exatamente
// o total pedido (sample.ts decide qual), e os cards não mudam. Puro e testado.

import { apportion } from "@/features/sync/apportion";
import type { AdDayRow, WarehouseRows } from "../types";
import { objectiveKey } from "./objectives";

/** O que os anúncios precisam somar no período. Dinheiro em centavos, como em features/metrics. */
export type ModelTotals = { spend: number; impressions: number; clicks: number; conversions: number; revenue: number; frequency: number };

const ratio = (a: number, b: number) => (b > 0 ? a / b : 1);
const scaled = (v: number | null | undefined, f: number) => (v == null ? v : Math.round(v * f));

/**
 * Alcance por linha para o total pedido: a frequência de cada linha se afasta de 1
 * pelo mesmo fator, então alcance nunca passa de impressões e quem tinha frequência
 * maior continua maior (o sinal de cansaço não some).
 */
function reachFor(impressions: readonly number[], frequencies: readonly number[], target: number): number[] {
  const at = (k: number) => impressions.map((imp, i) => imp / (1 + (frequencies[i] - 1) * k));
  const total = (k: number) => at(k).reduce((a, b) => a + b, 0);
  let lo = 0;
  let hi = 1;
  while (total(hi) > target && hi < 1e6) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (total(mid) > target) lo = mid;
    else hi = mid;
  }
  return at(hi).map((r, i) => (impressions[i] > 0 ? Math.max(1, Math.round(r)) : 0));
}

export function scaleAdRows(rows: WarehouseRows, model: ModelTotals): WarehouseRows {
  const inPeriod = rows.adDaily.filter((r) => r.date >= rows.current.from && r.date <= rows.current.to);
  const campaignOf = new Map(rows.ads.map((a) => [a.id, a.campaignId]));
  const objectives = new Map(rows.campaigns.map((c) => [c.id, objectiveKey(c.objective)]));
  const objectiveOf = (r: AdDayRow) => objectives.get(campaignOf.get(r.adId) ?? "") ?? "other";
  const resultWeight = (r: AdDayRow) => {
    const o = objectiveOf(r);
    return (o === "leads" ? r.leads : o === "engagement" ? r.postEngagement : r.conversions) ?? 0;
  };
  const isSale = (r: AdDayRow) => {
    const o = objectiveOf(r);
    return o !== "leads" && o !== "engagement";
  };

  const spend = apportion(Math.round(model.spend), inPeriod.map((r) => r.spend));
  const impressions = apportion(Math.round(model.impressions), inPeriod.map((r) => r.impressions));
  const clicks = apportion(Math.round(model.clicks), inPeriod.map((r) => r.clicks));
  const results = apportion(Math.round(model.conversions), inPeriod.map(resultWeight));
  const value = apportion(Math.round(model.revenue), inPeriod.map((r) => (isSale(r) ? r.conversionValue : 0)));
  const reachTarget = model.frequency > 1 ? model.impressions / model.frequency : null;
  const reach = reachTarget == null ? null : reachFor(impressions, inPeriod.map((r) => (r.reach && r.impressions ? Math.max(1, r.impressions / r.reach) : 1)), reachTarget);

  const adDaily = inPeriod.map((r, i): AdDayRow => {
    const imp = ratio(impressions[i], r.impressions);
    const clk = ratio(clicks[i], r.clicks);
    const o = objectiveOf(r);
    const result = results[i];
    const engagementFactor = o === "engagement" ? ratio(result, r.postEngagement ?? 0) : imp;
    return {
      ...r,
      spend: spend[i] / 100,
      impressions: impressions[i],
      clicks: clicks[i],
      reach: reach ? reach[i] : scaled(r.reach, imp) ?? null,
      linkClicks: r.linkClicks == null ? null : Math.min(clicks[i], Math.round(r.linkClicks * clk)),
      // cada anúncio responde pelo resultado do seu objetivo: é o que a lista soma
      conversions: isSale(r) ? result : 0,
      conversionValue: value[i] / 100,
      leads: o === "leads" ? result : scaled(r.leads, clk),
      registrations: scaled(r.registrations, clk),
      postEngagement: o === "engagement" ? result : scaled(r.postEngagement, imp),
      postReactions: scaled(r.postReactions, engagementFactor),
      postComments: scaled(r.postComments, engagementFactor),
      postShares: scaled(r.postShares, engagementFactor),
      postSaves: scaled(r.postSaves, engagementFactor),
      profileVisits: scaled(r.profileVisits, clk),
      videoViews: scaled(r.videoViews, imp) ?? null,
      videoThruplays: scaled(r.videoThruplays, imp) ?? null,
      videoP25: scaled(r.videoP25, imp),
      videoP50: scaled(r.videoP50, imp),
      videoP75: scaled(r.videoP75, imp),
      videoP95: scaled(r.videoP95, imp),
      videoP100: scaled(r.videoP100, imp),
      videoWatchSeconds: scaled(r.videoWatchSeconds, imp),
    };
  });
  return { ...rows, adDaily };
}
