// Página de Criativos nos dashboards de amostra: só nos modelos que usam a Meta
// (TikTok, YouTube e só Google mantêm o widget do modelo). Roda no servidor e passa
// pelo mesmo corte por plano dos dashboards com dados reais. Os anúncios são
// escalados para fechar com o modelo (scale.ts): com a parte da Meta nos modelos
// com outras plataformas de anúncios, e com os cards nos que só têm Meta.

import { PLATFORMS } from "@/features/accounts/platforms";
import { datasetFor } from "@/features/dashboards/data";
import { sampleExtraCatalog } from "@/features/dashboards/metric-prefs";
import { campaignFrequencies, currentTotals, platformPart } from "@/features/metrics/compute";
import { campaignFrequenciesIn, filterDataset, selectedCampaigns } from "@/features/metrics/filter-dataset";
import type { Campaign, Dataset } from "@/features/metrics/source";
import { addDays, DEFAULT_TIME_ZONE, localDate } from "@/features/sync/dates";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { periodDays, type DashboardSettings, type PeriodId } from "@/features/workspace/types";
import { aggregateDashboard, creativeList, redactSpend } from "../aggregate";
import { aggregateFiltered } from "../filtered";
import { hasFilters, NO_FILTERS, type DashFilters, type DayRange } from "../filters";
import { ADD_TO_CART_METRIC, GOOGLE_EXTRA_METRICS, META_EXTRA_METRICS } from "../live-metrics";
import { sampleRows } from "../preview";
import type { AdDayRow, CampaignDayRow, CampaignInfo, CreativesData, MetaView, SampleAdSelection, SampleExtraMetric, WarehouseRows } from "../types";
import { cutCreatives, type CreativesAccess } from "./access";
import { scaleAdRows, type ModelTotals } from "./scale";

export const usesCreativesPage = (t: Pick<DashboardTemplate, "sources" | "dataMode">, pages: readonly PageId[]) => t.dataMode !== "live" && t.sources.includes("meta") && pages.includes("criativos");

export type SampleSpec = { name: string; client: string; settings: DashboardSettings };

/** O que os anúncios da Meta precisam somar: a parte da Meta, a mesma do "Meta 1.574" do card. Só Meta: os cards. */
export const metaTotals = (ds: Dataset): ModelTotals => platformPart(ds, "meta", "current");

// ---- anúncios ligados às campanhas do modelo -----------------------------------------------------

/**
 * Cada anúncio simulado passa a pertencer a uma campanha do modelo (a mesma da tabela e
 * com o mesmo nome). As campanhas do simulador vão para as da Meta em rodízio; se alguma
 * ficasse sem entrega no período, o rodízio é por anúncio, para todas terem anúncios.
 */
function linkToModel(rows: WarehouseRows, model: readonly Campaign[]): WarehouseRows {
  const metaCampaigns = model.filter((c) => c.platform === "meta");
  if (!metaCampaigns.length) return rows;
  const position = new Map(rows.campaigns.map((c, i) => [c.id, i]));
  const delivering = new Set(rows.adDaily.filter((r) => r.date >= rows.current.from && r.date <= rows.current.to).map((r) => r.adId));
  const byCampaign = new Map(rows.ads.map((a) => [a.id, metaCampaigns[(position.get(a.campaignId) ?? 0) % metaCampaigns.length].id]));
  const covered = new Set([...byCampaign].filter(([ad]) => delivering.has(ad)).map(([, campaign]) => campaign));
  if (covered.size < metaCampaigns.length) {
    rows.ads.filter((a) => delivering.has(a.id)).forEach((a, i) => byCampaign.set(a.id, metaCampaigns[i % metaCampaigns.length].id));
  }
  // o objetivo de cada campanha do modelo vem da primeira do simulador que caiu nela
  const source = new Map(metaCampaigns.map((c, i) => [c.id, rows.campaigns[i % rows.campaigns.length]]));
  const campaigns: CampaignInfo[] = model.map((c) => {
    const from = source.get(c.id);
    return { id: c.id, name: c.name, objective: from?.objective ?? null, status: from?.status ?? "active", channel: from?.channel ?? null, funnelStage: from?.funnelStage ?? null, dailyBudget: from?.dailyBudget ?? null };
  });
  return { ...rows, campaigns, ads: rows.ads.map((a) => ({ ...a, campaignId: byCampaign.get(a.id) ?? a.campaignId })) };
}

/** Os anúncios de cada campanha escalados para fechar com ela. A soma das campanhas fecha com o total. */
function scaleByCampaign(rows: WarehouseRows, model: readonly Campaign[], frequencies: ReadonlyMap<string, number>): WarehouseRows {
  const campaignOf = new Map(rows.ads.map((a) => [a.id, a.campaignId]));
  const adDaily = model
    .filter((c) => c.platform === "meta")
    .flatMap((c) => scaleAdRows({ ...rows, adDaily: rows.adDaily.filter((r) => campaignOf.get(r.adId) === c.id) }, { spend: c.spend, impressions: c.impressions, clicks: c.clicks, conversions: c.conversions, revenue: c.revenue, frequency: frequencies.get(c.id) ?? 0 }).adDaily);
  return { ...rows, adDaily };
}

/** Os dias do modelo vêm de hoje para trás; o simulador termina ontem: a mesma posição é um dia antes. */
const toSimulatorDays = (days: DayRange | null): DayRange | null => (days ? { from: addDays(days.from, -1), to: addDays(days.to, -1) } : null);

/** As linhas escaladas do período inteiro e, com filtro, as do recorte. */
function sampleAdRows(ds: Dataset, opts: { period: PeriodId; customDays: number; today?: string; filters?: DashFilters }) {
  const raw = sampleRows("meta", { period: opts.period, customDays: opts.customDays, today: opts.today });
  const period = scaleByCampaign(linkToModel(raw, ds.campaigns), ds.campaigns, campaignFrequencies(ds));
  const f = opts.filters ?? NO_FILTERS;
  if (!hasFilters(f)) return { period, cut: period, filters: f };
  // o trecho e a campanha com a conta dos cards, para a galeria fechar com eles também
  const today = opts.today ?? localDate(new Date(), DEFAULT_TIME_ZONE);
  const inDays = filterDataset(ds, { ...NO_FILTERS, days: f.days }, { today });
  const days = toSimulatorDays(inDays.days);
  const current = days ? { ...days, days: inDays.ds.current.length } : raw.current;
  const model = inDays.ds.campaigns.map((c) => ({ ...c, spend: Math.round(c.spend), impressions: Math.round(c.impressions), clicks: Math.round(c.clicks), conversions: Math.round(c.conversions), revenue: Math.round(c.revenue) }));
  const cut = scaleByCampaign(linkToModel({ ...raw, current }, ds.campaigns), model, campaignFrequenciesIn(ds, inDays.days));
  return { period, cut, filters: { ...f, campaigns: selectedCampaigns(ds, f).map((c) => c.id), platforms: [], days: null } };
}

/** Os anúncios filtrados somados, na escala do modelo: é o que os cards mostram com o filtro de anúncio. */
function adSelection(rows: WarehouseRows, f: DashFilters): SampleAdSelection | undefined {
  if (!f.ads.length) return undefined;
  const campaignOf = new Map(rows.ads.map((a) => [a.id, a.campaignId]));
  const chosen = rows.adDaily.filter((r) => f.ads.includes(r.adId) && (!f.campaigns.length || f.campaigns.includes(campaignOf.get(r.adId) ?? "")));
  const list = creativeList({ ...rows, adDaily: chosen });
  const add = (pick: (r: AdDayRow) => number) => chosen.reduce((a, r) => a + pick(r), 0);
  return {
    spend: add((r) => r.spend) * 100,
    impressions: add((r) => r.impressions),
    clicks: add((r) => r.clicks),
    conversions: list.reduce((a, r) => a + r.result.value, 0),
    revenue: add((r) => r.conversionValue) * 100,
    frequency: add((r) => r.reach ?? 0) > 0 ? add((r) => r.impressions) / add((r) => r.reach ?? 0) : 0,
  };
}

export function sampleCreatives(t: DashboardTemplate, spec: SampleSpec, pages: readonly PageId[], access: CreativesAccess, opts: { period: PeriodId; customDays: number; hideSpend?: boolean; today?: string; filters?: DashFilters }): CreativesData | undefined {
  if (!usesCreativesPage(t, pages)) return undefined;
  // o mesmo conjunto que os cards usam: nome, cliente, modelo e dias do período
  const ds = datasetFor({ templateId: t.id, name: spec.name, client: spec.client, settings: spec.settings }, periodDays({ period: opts.period, customDays: opts.customDays }));
  const cur = currentTotals(ds);
  const { period, cut, filters } = sampleAdRows(ds, opts);
  const aggregated = aggregateFiltered(cut, { ...filters, days: null }, { breakEvenRoas: ds.breakEven }) as MetaView;
  // o comparativo só respeita o período
  const whole = hasFilters(filters) || cut !== period ? { ...aggregated, creativeDays: (aggregateDashboard(period, { breakEvenRoas: ds.breakEven }) as MetaView).creativeDays } : aggregated;
  // a campanha filtrada pode não ser da Meta: nenhum anúncio, em vez de todos
  const noMeta = filters.campaigns.length === 0 && hasFilters(opts.filters ?? NO_FILTERS) && (!!opts.filters?.campaigns.length || !!opts.filters?.platforms.length);
  const shown = noMeta ? { ...whole, creatives: [], creativeList: [] } : whole;
  const view = opts.hideSpend ? redactSpend(shown) : shown;
  const creatives = cutCreatives(view, access, { hideSpend: !!opts.hideSpend, currency: "BRL" }).creatives;
  if (!creatives) return creatives;
  const picked = adSelection(cut, filters);
  // investimento oculto: o que cai no navegador não leva o valor
  const selection = picked && opts.hideSpend ? { ...picked, spend: 0 } : picked;
  const withSelection = { ...creatives, selection };
  if (cur.revenue > 0) return withSelection;
  // modelo sem receita (ex.: geração de leads): sem valor de conversão nem ROAS por anúncio
  return {
    ...withSelection,
    gallery: creatives.gallery.map((c) => ({ ...c, roas: null })),
    compare: creatives.compare.map((a) => ({ ...a, days: a.days.map((d) => ({ ...d, conversionValue: null as unknown as number })) })),
  };
}

// ---- métricas novas nas amostras -----------------------------------------------------------------

/** O recorte de uma amostra, com os nomes dos itens: o que o assistente lê. */
export function sampleFocus(t: DashboardTemplate, ds: Dataset, opts: { period: PeriodId; customDays: number; today?: string }, filters: DashFilters) {
  const names = new Map([...ds.creatives.map((c) => [c.id, c.name] as const), ...sampleRows("meta", opts).ads.map((a) => [a.id, a.name] as const)]);
  const labels = {
    campaigns: Object.fromEntries(ds.campaigns.map((c) => [c.id, c.name])),
    ads: Object.fromEntries(filters.ads.map((id) => [id, names.get(id) ?? id])),
    platforms: Object.fromEntries(ds.adPlatforms.map((id) => [id, PLATFORMS[id].name])),
  };
  return { ds: filteredForSample(t, ds, opts, filters).ds, labels };
}

/** O Dataset com os filtros, somando os anúncios escolhidos quando o modelo tem galeria. */
function filteredForSample(t: DashboardTemplate, ds: Dataset, opts: { period: PeriodId; customDays: number; today?: string }, filters: DashFilters) {
  const today = opts.today ?? localDate(new Date(), DEFAULT_TIME_ZONE);
  if (!filters.ads.length || !t.sources.includes("meta")) return filterDataset(ds, filters, { today });
  const { cut, filters: applied } = sampleAdRows(ds, { ...opts, filters });
  return filterDataset(ds, filters, { today, adSelection: adSelection(cut, applied) });
}

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
export function sampleExtras(t: DashboardTemplate, spec: SampleSpec, opts: { period: PeriodId; customDays: number; hideSpend?: boolean; today?: string; filters?: DashFilters }): SampleExtraMetric[] {
  const catalog = sampleExtraCatalog(t.sources);
  if (!catalog.length) return [];
  const base = datasetFor({ templateId: t.id, name: spec.name, client: spec.client, settings: spec.settings }, periodDays({ period: opts.period, customDays: opts.customDays }));
  const filters = opts.filters ?? NO_FILTERS;
  // com filtro, as métricas novas fecham com os cards filtrados: a conta é a mesma, sobre o recorte
  const ds = hasFilters(filters) ? filteredForSample(t, base, opts, filters).ds : base;
  const period = { period: opts.period, customDays: opts.customDays, today: opts.today };
  const keep = catalog.filter((m) => !(opts.hideSpend && m.spendDerived));
  const labelOf = new Map(keep.map((m) => [m.id, m.label]));

  if (t.sources.includes("meta")) {
    // o recorte ficou sem a Meta (campanha ou plataforma de outra): essas métricas não têm valor
    if (hasFilters(filters) && !ds.adPlatforms.includes("meta")) {
      return [...META_EXTRA_METRICS, ADD_TO_CART_METRIC].flatMap((m) => {
        const label = labelOf.get(m.id);
        return label ? [{ id: m.id, label, format: m.format, better: m.better, value: null, previous: null }] : [];
      });
    }
    const rows = sampleRows("meta", period);
    const cur = platformPart(ds, "meta", "current");
    const prev = platformPart(ds, "meta", "previous");
    // os mesmos anúncios da galeria, com o mesmo recorte
    const { cut, filters: applied } = sampleAdRows(base, { period: opts.period, customDays: opts.customDays, today: opts.today, filters });
    const campaignOf = new Map(cut.ads.map((a) => [a.id, a.campaignId]));
    const adsCur = cut.adDaily.filter((r) => (!applied.ads.length || applied.ads.includes(r.adId)) && (!applied.campaigns.length || applied.campaigns.includes(campaignOf.get(r.adId) ?? "")));
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
