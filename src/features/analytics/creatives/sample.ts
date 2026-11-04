// Página de Criativos nos dashboards de amostra: só nos modelos que usam a Meta
// (TikTok, YouTube e só Google mantêm o widget do modelo). Roda no servidor e passa
// pelo mesmo corte por plano dos dashboards com dados reais. Os anúncios são
// escalados para fechar com o modelo (scale.ts): com a parte da Meta nos modelos
// com outras plataformas de anúncios, e com os cards nos que só têm Meta.

import { datasetFor } from "@/features/dashboards/data";
import { sampleExtraCatalog } from "@/features/dashboards/metric-prefs";
import { currentTotals, platformPart } from "@/features/metrics/compute";
import type { Dataset } from "@/features/metrics/source";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { periodDays, type DashboardSettings, type PeriodId } from "@/features/workspace/types";
import { aggregateDashboard, redactSpend } from "../aggregate";
import { ADD_TO_CART_METRIC, GOOGLE_EXTRA_METRICS, META_EXTRA_METRICS } from "../live-metrics";
import { sampleRows } from "../preview";
import type { AdDayRow, CampaignDayRow, CreativesData, MetaView, SampleExtraMetric, WarehouseRows } from "../types";
import { cutCreatives, type CreativesAccess } from "./access";
import { scaleAdRows, type ModelTotals } from "./scale";

export const usesCreativesPage = (t: Pick<DashboardTemplate, "sources" | "dataMode">, pages: readonly PageId[]) => t.dataMode !== "live" && t.sources.includes("meta") && pages.includes("criativos");

export type SampleSpec = { name: string; client: string; settings: DashboardSettings };

/** O que os anúncios da Meta precisam somar: a parte da Meta, a mesma do "Meta 1.574" do card. Só Meta: os cards. */
export const metaTotals = (ds: Dataset): ModelTotals => platformPart(ds, "meta", "current");

export function sampleCreatives(t: DashboardTemplate, spec: SampleSpec, pages: readonly PageId[], access: CreativesAccess, opts: { period: PeriodId; customDays: number; hideSpend?: boolean; today?: string }): CreativesData | undefined {
  if (!usesCreativesPage(t, pages)) return undefined;
  // o mesmo conjunto que os cards usam: nome, cliente, modelo e dias do período
  const ds = datasetFor({ templateId: t.id, name: spec.name, client: spec.client, settings: spec.settings }, periodDays({ period: opts.period, customDays: opts.customDays }));
  const cur = currentTotals(ds);
  const rows = scaleAdRows(sampleRows("meta", { period: opts.period, customDays: opts.customDays, today: opts.today }), metaTotals(ds));
  const aggregated = aggregateDashboard(rows, { breakEvenRoas: ds.breakEven }) as MetaView;
  const view = opts.hideSpend ? redactSpend(aggregated) : aggregated;
  const creatives = cutCreatives(view, access, { hideSpend: !!opts.hideSpend, currency: "BRL" }).creatives;
  if (!creatives || cur.revenue > 0) return creatives;
  // modelo sem receita (ex.: geração de leads): sem valor de conversão nem ROAS por anúncio
  return {
    ...creatives,
    gallery: creatives.gallery.map((c) => ({ ...c, roas: null })),
    compare: creatives.compare.map((a) => ({ ...a, days: a.days.map((d) => ({ ...d, conversionValue: null as unknown as number })) })),
  };
}

// ---- métricas novas nas amostras -----------------------------------------------------------------

const inRange = (date: string, r: { from: string; to: string }) => date >= r.from && date <= r.to;
const sum = <T>(rows: readonly T[], pick: (r: T) => number | null | undefined) => rows.reduce((a, r) => a + Number(pick(r) ?? 0), 0);

/** Linhas de campanha da Meta com a mesma escala dos anúncios. */
function metaRowsScaled(rows: WarehouseRows, range: { from: string; to: string }, model: ModelTotals, ads: readonly AdDayRow[]) {
  const raw = rows.campaignDaily.filter((r) => inRange(r.date, range));
  const f = model.clicks / (sum(raw, (r) => r.clicks) || 1);
  return [
    {
      spend: model.spend / 100,
      linkClicks: sum(ads, (r) => r.linkClicks),
      landingPageViews: Math.round(sum(raw, (r) => r.landingPageViews) * f),
      addToCart: Math.round(sum(raw, (r) => r.addToCart) * f),
      initiateCheckout: Math.round(sum(raw, (r) => r.initiateCheckout) * f),
    },
  ];
}

/** Linhas de campanha do Google na escala dos totais do modelo. */
function googleRowsScaled(rows: WarehouseRows, range: { from: string; to: string }, model: ModelTotals): CampaignDayRow[] {
  const raw = rows.campaignDaily.filter((r) => inRange(r.date, range));
  const fSpend = model.spend / 100 / (sum(raw, (r) => r.spend) || 1);
  const fImp = model.impressions / (sum(raw, (r) => r.impressions) || 1);
  const fClicks = model.clicks / (sum(raw, (r) => r.clicks) || 1);
  const fConv = model.conversions / (sum(raw, (r) => r.conversions) || 1);
  return raw.map((r) => ({
    ...r,
    spend: r.spend * fSpend,
    impressions: r.impressions * fImp,
    clicks: r.clicks * fClicks,
    conversions: r.conversions * fConv,
    allConversions: r.allConversions == null ? r.allConversions : r.allConversions * fConv,
    interactions: r.interactions == null ? r.interactions : r.interactions * fClicks,
    videoViews: r.videoViews == null ? r.videoViews : r.videoViews * fImp,
  }));
}

/** Os valores das métricas novas nos dois períodos, na escala do modelo. Sem investimento oculto escapando. */
export function sampleExtras(t: DashboardTemplate, spec: SampleSpec, opts: { period: PeriodId; customDays: number; hideSpend?: boolean; today?: string }): SampleExtraMetric[] {
  const catalog = sampleExtraCatalog(t.sources);
  if (!catalog.length) return [];
  const ds = datasetFor({ templateId: t.id, name: spec.name, client: spec.client, settings: spec.settings }, periodDays({ period: opts.period, customDays: opts.customDays }));
  const period = { period: opts.period, customDays: opts.customDays, today: opts.today };
  const keep = catalog.filter((m) => !(opts.hideSpend && m.spendDerived));
  const labelOf = new Map(keep.map((m) => [m.id, m.label]));

  if (t.sources.includes("meta")) {
    const rows = sampleRows("meta", period);
    const cur = platformPart(ds, "meta", "current");
    const prev = platformPart(ds, "meta", "previous");
    const adsCur = scaleAdRows(rows, cur).adDaily;
    const adsPrev = scaleAdRows({ ...rows, current: rows.previous }, prev).adDaily;
    const rowCur = metaRowsScaled(rows, rows.current, cur, adsCur);
    const rowPrev = metaRowsScaled(rows, rows.previous, prev, adsPrev);
    return [...META_EXTRA_METRICS, ADD_TO_CART_METRIC].flatMap((m) => {
      const label = labelOf.get(m.id);
      if (!label) return [];
      const value = m.source === "ads" ? m.value(adsCur) : m.value(rowCur);
      const previous = m.source === "ads" ? m.value(adsPrev) : m.value(rowPrev);
      return [{ id: m.id, label, format: m.format, better: m.better, value, previous }];
    });
  }
  const rows = sampleRows("google", period);
  const isVideo = (id: string) => rows.campaigns.some((c) => c.id === id && c.channel === "video");
  const cur = googleRowsScaled(rows, rows.current, platformPart(ds, "google", "current"));
  const prev = googleRowsScaled(rows, rows.previous, platformPart(ds, "google", "previous"));
  return GOOGLE_EXTRA_METRICS.flatMap((m) => {
    const label = labelOf.get(m.id);
    return label ? [{ id: m.id, label, format: m.format, better: m.better, value: m.value(cur, isVideo), previous: m.value(prev, isVideo) }] : [];
  });
}
