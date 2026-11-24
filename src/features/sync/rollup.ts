// Soma de linhas diárias com as mesmas regras de public.rollup_account_insights:
// cada coluna é somada (null quando todas as linhas são null) e a parcela de
// impressões é a média ponderada pelas impressões das linhas que têm o dado.
// Valores de 2 casas são somados em centésimos (sem erro de ponto flutuante).

import type { AccountDay, CampaignDay, DailyMetrics } from "./dataset";

type NumberKey = { [K in keyof DailyMetrics]: DailyMetrics[K] extends number ? K : never }[keyof DailyMetrics];
type NullableKey = Exclude<keyof DailyMetrics, NumberKey>;

/** Colunas numeric(…, 2) do armazém; as outras são inteiras. */
const HUNDREDTHS = new Set<keyof DailyMetrics>(["spend", "conversionValue", "conversions", "addToCart", "initiateCheckout"]);

const scaleOf = (key: keyof DailyMetrics) => (HUNDREDTHS.has(key) ? 100 : 1);

function sumOf(rows: readonly DailyMetrics[], key: NumberKey): number {
  const scale = scaleOf(key);
  return rows.reduce((total, r) => total + Math.round(r[key] * scale), 0) / scale;
}

function sumNullable(rows: readonly DailyMetrics[], key: Exclude<NullableKey, `search${string}`>): number | null {
  const scale = scaleOf(key);
  let any = false;
  let total = 0;
  for (const r of rows) {
    const v = r[key];
    if (v == null) continue;
    any = true;
    total += Math.round(v * scale);
  }
  return any ? total / scale : null;
}

/** numeric(7, 6), como o banco grava. */
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

function weightedShare(rows: readonly DailyMetrics[], key: "searchImpressionShare" | "searchLostIsBudget" | "searchLostIsRank"): number | null {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    const v = r[key];
    if (v == null) continue;
    num += v * r.impressions;
    den += r.impressions;
  }
  return den > 0 ? round6(num / den) : null;
}

export function sumMetrics(rows: readonly DailyMetrics[]): DailyMetrics {
  return {
    spend: sumOf(rows, "spend"),
    impressions: sumOf(rows, "impressions"),
    reach: sumNullable(rows, "reach"),
    clicks: sumOf(rows, "clicks"),
    linkClicks: sumNullable(rows, "linkClicks"),
    landingPageViews: sumNullable(rows, "landingPageViews"),
    addToCart: sumNullable(rows, "addToCart"),
    initiateCheckout: sumNullable(rows, "initiateCheckout"),
    conversions: sumOf(rows, "conversions"),
    conversionValue: sumOf(rows, "conversionValue"),
    leads: sumNullable(rows, "leads"),
    messages: sumNullable(rows, "messages"),
    videoViews: sumNullable(rows, "videoViews"),
    videoThruplays: sumNullable(rows, "videoThruplays"),
    searchImpressionShare: weightedShare(rows, "searchImpressionShare"),
    searchLostIsBudget: weightedShare(rows, "searchLostIsBudget"),
    searchLostIsRank: weightedShare(rows, "searchLostIsRank"),
  };
}

/** Total da conta por dia a partir das campanhas (o mesmo que o banco calcula). */
export function rollupAccountDaily(campaignDaily: readonly CampaignDay[]): AccountDay[] {
  const byDate = new Map<string, CampaignDay[]>();
  for (const row of campaignDaily) {
    const list = byDate.get(row.date);
    if (list) list.push(row);
    else byDate.set(row.date, [row]);
  }
  return [...byDate.keys()].sort().map((date) => ({ date, ...sumMetrics(byDate.get(date)!) }));
}
