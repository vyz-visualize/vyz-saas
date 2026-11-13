// Carga do histórico para o MMM: das respostas da Meta e do Google às linhas de mmm.media_daily.
// Puro (sem rede nem banco): o runner (backfill.ts) usa e o teste confere. As métricas vêm dos
// mesmos mapeadores da sincronização (compras pelo omni_purchase, micros do Google em reais).

import { createHash } from "node:crypto";
import { mapGoogleCampaignDay, mapMetaCampaignDay, type GoogleRow, type MetaInsight } from "@/server/sync/live/map";

/** Uma linha de mmm.media_daily (workspace, conta e plataforma vêm do trabalho). */
export type MediaRow = {
  campaign_external_id: string;
  campaign_name: string | null;
  date: string;
  canal: string;
  moeda: string;
  spend: number;
  spend_brl: number | null;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
};

const money = (v: number) => Math.round(v * 100) / 100;

/** Moeda da conta; o valor em reais só quando a conta já é em reais (sem câmbio inventado). */
const inBrl = (currency: string, spend: number) => (currency.toUpperCase() === "BRL" ? money(spend) : null);

export function metaMediaRows(rows: readonly (MetaInsight & { campaign_name?: string })[], currency: string): MediaRow[] {
  const out: MediaRow[] = [];
  for (const r of rows) {
    const d = mapMetaCampaignDay(r);
    if (!d) continue;
    out.push({
      campaign_external_id: d.campaignExternalId,
      campaign_name: r.campaign_name ?? null,
      date: d.date,
      canal: "Meta Ads",
      moeda: currency.toUpperCase(),
      spend: money(d.spend),
      spend_brl: inBrl(currency, d.spend),
      impressions: Math.round(d.impressions),
      clicks: Math.round(d.clicks),
      conversions: money(d.conversions),
      conversion_value: money(d.conversionValue),
    });
  }
  return out;
}

export function googleMediaRows(rows: readonly GoogleRow[], currency: string): MediaRow[] {
  const out: MediaRow[] = [];
  for (const r of rows) {
    const d = mapGoogleCampaignDay(r);
    if (!d) continue;
    out.push({
      campaign_external_id: d.campaignExternalId,
      campaign_name: r.campaign?.name ?? null,
      date: d.date,
      canal: "Google Ads",
      moeda: currency.toUpperCase(),
      spend: money(d.spend),
      spend_brl: inBrl(currency, d.spend),
      impressions: Math.round(d.impressions),
      clicks: Math.round(d.clicks),
      conversions: money(d.conversions),
      conversion_value: money(d.conversionValue),
    });
  }
  return out;
}

/** O mês do trabalho ("2025-03-01") → primeiro e último dia. */
export function monthRange(mes: string): { from: string; to: string } {
  const [y, m] = mes.slice(0, 7).split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${mes.slice(0, 7)}-01`, to: `${mes.slice(0, 7)}-${String(last).padStart(2, "0")}` };
}

/** Assinatura do pedido (vai no bruto: mesma busca, mesmo hash). */
export const requestHash = (parts: readonly string[]) => createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);

/**
 * Uso da cota de insights da Meta (cabeçalho x-fb-ads-insights-throttle:
 * {"app_id_util_pct": 12.3, "acc_id_util_pct": 40}). O maior dos dois, em %; sem cabeçalho, 0.
 */
export function metaThrottle(header: string | null | undefined): number {
  if (!header) return 0;
  try {
    const j = JSON.parse(header) as { app_id_util_pct?: number; acc_id_util_pct?: number };
    return Math.max(Number(j.app_id_util_pct) || 0, Number(j.acc_id_util_pct) || 0);
  } catch {
    return 0;
  }
}

/** Acima disto, a Meta para de receber pedidos da carga até a próxima rodada. */
export const META_THROTTLE_PAUSE = 75;
