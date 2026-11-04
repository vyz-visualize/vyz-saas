// Agregação dos dashboards com dados reais: das linhas do armazém para o que a
// tela desenha. Pura e testada; roda no servidor (dados reais) e no navegador
// (prévia com o gerador). Regras:
//   * razões sobre os totais do período (soma ÷ soma), nunca média de médias:
//     CTR = cliques ÷ impressões; ROAS = valor ÷ investimento; CPA = investimento
//     ÷ conversões; ticket = valor ÷ conversões; CPM = investimento ÷ mil impressões;
//   * frequência = impressões ÷ alcance, só nas linhas com alcance (o alcance
//     diário não soma pessoas únicas entre dias: é uma média);
//   * parcela de impressões ponderada pelas impressões elegíveis
//     (impressões ÷ parcela), assim como as perdas por orçamento e classificação;
//   * os últimos dias ficam "em maturação" (conversões ainda chegando).

import { breakdownLabel, parseAgeGender } from "@/features/sync/breakdowns";
import type { BreakdownDimension } from "@/features/sync/dataset";
import { dateRange, weekday } from "@/features/sync/dates";
import { objectiveResult } from "./creatives/objectives";
import { maturingStart, MATURING_DAYS } from "./ranges";
import type {
  AccountDayRow,
  AdDayRow,
  CompareAd,
  CreativeListVM,
  AgeGenderCell,
  AggregateOptions,
  BasicRow,
  CampaignRowVM,
  ChannelVM,
  CreativeVM,
  DailyPoint,
  DashboardView,
  DateRange,
  FunnelByStage,
  FunnelStep,
  GoogleView,
  HeatCell,
  ImpressionShareVM,
  Kpi,
  MetaView,
  MetricRow,
  ProductVM,
  SearchTermVM,
  SliceVM,
  Totals,
  WarehouseRows,
} from "./types";

// ---- contas básicas ------------------------------------------------------------------

/** a ÷ b, ou null quando o divisor não é positivo. */
export const ratio = (a: number | null | undefined, b: number | null | undefined): number | null => (a != null && b != null && b > 0 ? a / b : null);

/** Variação relativa; null quando não dá para comparar. */
export function deltaOf(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return cur / prev - 1;
}

/** Soma em centésimos (dinheiro sem erro de ponto flutuante). */
const money = (values: Iterable<number>) => {
  let cents = 0;
  for (const v of values) cents += Math.round(v * 100);
  return cents / 100;
};

const inRange = (date: string, r: DateRange) => date >= r.from && date <= r.to;

function sumBasic(rows: readonly BasicRow[]) {
  let impressions = 0;
  let clicks = 0;
  let conversions = 0;
  for (const r of rows) {
    impressions += r.impressions;
    clicks += r.clicks;
    conversions += r.conversions;
  }
  return { spend: money(rows.map((r) => r.spend)), impressions, clicks, conversions: Math.round(conversions * 100) / 100, value: money(rows.map((r) => r.conversionValue)) };
}

function sumNullable<T>(rows: readonly T[], pick: (r: T) => number | null | undefined): number | null {
  let any = false;
  let total = 0;
  for (const r of rows) {
    const v = pick(r);
    if (v == null) continue;
    any = true;
    total += v;
  }
  return any ? total : null;
}

/** Impressões ÷ alcance, só nas linhas que têm alcance. */
function frequencyOf(rows: readonly Pick<MetricRow, "impressions" | "reach">[]): number | null {
  let impressions = 0;
  let reach = 0;
  for (const r of rows) {
    if (r.reach == null || r.reach <= 0) continue;
    impressions += r.impressions;
    reach += r.reach;
  }
  return ratio(impressions, reach);
}

export function totalsOf(rows: readonly (BasicRow & Partial<Pick<MetricRow, "linkClicks" | "reach">>)[]): Totals & { spend: number } {
  const b = sumBasic(rows);
  const linkClicks = sumNullable(rows, (r) => r.linkClicks);
  return {
    spend: b.spend,
    impressions: b.impressions,
    clicks: b.clicks,
    linkClicks,
    conversions: b.conversions,
    value: b.value,
    ctr: ratio(b.clicks, b.impressions),
    linkCtr: ratio(linkClicks, b.impressions),
    cpc: ratio(b.spend, b.clicks),
    cpm: b.impressions > 0 ? (b.spend / b.impressions) * 1000 : null,
    roas: ratio(b.value, b.spend),
    cpa: ratio(b.spend, b.conversions),
    ticket: ratio(b.value, b.conversions),
    frequency: frequencyOf(rows.map((r) => ({ impressions: r.impressions, reach: r.reach ?? null }))),
  };
}

/** Parcela de impressões e perdas, ponderadas pelas impressões elegíveis (impressões ÷ parcela). */
export function weightedShare(rows: readonly Pick<MetricRow, "impressions" | "searchImpressionShare" | "searchLostIsBudget" | "searchLostIsRank">[]) {
  let impressions = 0;
  let eligible = 0;
  let budget = 0;
  let rank = 0;
  let withBudget = 0;
  let withRank = 0;
  for (const r of rows) {
    const s = r.searchImpressionShare;
    if (s == null || s <= 0 || r.impressions <= 0) continue;
    const e = r.impressions / s;
    impressions += r.impressions;
    eligible += e;
    if (r.searchLostIsBudget != null) {
      budget += e * r.searchLostIsBudget;
      withBudget += e;
    }
    if (r.searchLostIsRank != null) {
      rank += e * r.searchLostIsRank;
      withRank += e;
    }
  }
  return { share: ratio(impressions, eligible), lostBudget: ratio(budget, withBudget), lostRank: ratio(rank, withRank) };
}

function groupBy<T>(rows: readonly T[], key: (r: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

// ---- série diária e KPIs -----------------------------------------------------------------

type DayMetric = (rows: AccountDayRow[]) => number | null;

function dailySeries(rows: readonly AccountDayRow[], range: DateRange, maturingFrom: string | null): { dates: string[]; byDate: Map<string, AccountDayRow[]>; points: DailyPoint[] } {
  const byDate = groupBy(
    rows.filter((r) => inRange(r.date, range)),
    (r) => r.date,
  );
  const dates = dateRange(range.to, range.days);
  const points = dates.map((date) => {
    const t = totalsOf(byDate.get(date) ?? []);
    return { date, spend: t.spend, value: t.value, conversions: t.conversions, roas: t.roas, maturing: maturingFrom != null && date >= maturingFrom };
  });
  return { dates, byDate, points };
}

function spark(dates: string[], byDate: Map<string, AccountDayRow[]>, metric: DayMetric): (number | null)[] {
  return dates.map((d) => {
    const rows = byDate.get(d);
    return rows?.length ? metric(rows) : null;
  });
}

type KpiDef = Omit<Kpi, "value" | "previous" | "delta" | "spark"> & { pick: DayMetric };

function buildKpis(defs: KpiDef[], cur: AccountDayRow[], prev: AccountDayRow[], dates: string[], byDate: Map<string, AccountDayRow[]>): Kpi[] {
  return defs.map(({ pick, ...def }) => {
    const value = cur.length ? pick(cur) : null;
    const previous = prev.length ? pick(prev) : null;
    return { ...def, value, previous, delta: deltaOf(value, previous), spark: spark(dates, byDate, pick) };
  });
}

const t = (rows: AccountDayRow[]) => totalsOf(rows);

/**
 * Média do alcance diário. A Meta não soma pessoas únicas entre dias, então o
 * alcance do período inteiro não sai destas linhas (docs/PENDENCIAS.md).
 */
export function reachPerDay(rows: readonly { date: string; reach: number | null }[]): number | null {
  const withReach = rows.filter((r) => r.reach != null);
  if (!withReach.length) return null;
  const total = withReach.reduce((a, r) => a + (r.reach ?? 0), 0);
  return total / new Set(withReach.map((r) => r.date)).size;
}

// ---- campanhas -------------------------------------------------------------------------------

function campaignTable(rows: WarehouseRows, breakEven: number | null): CampaignRowVM[] {
  const cur = rows.campaignDaily.filter((r) => inRange(r.date, rows.current));
  const byCampaign = groupBy(cur, (r) => r.campaignId);
  const totalSpend = money(cur.map((r) => r.spend));
  const threshold = breakEven ?? 1;
  const out: CampaignRowVM[] = [];
  for (const c of rows.campaigns) {
    const list = byCampaign.get(c.id);
    if (!list?.length) continue;
    const tt = totalsOf(list);
    const share = weightedShare(list);
    out.push({
      id: c.id,
      name: c.name,
      status: c.status,
      kind: rows.platform === "google" ? c.channel : c.funnelStage,
      spend: tt.spend,
      spendShare: ratio(tt.spend, totalSpend) ?? 0,
      value: tt.value,
      conversions: tt.conversions,
      roas: tt.roas,
      cpa: tt.cpa,
      ctr: tt.ctr,
      linkCtr: tt.linkCtr,
      cpc: tt.cpc,
      cpm: tt.cpm,
      frequency: tt.frequency,
      impressions: tt.impressions,
      impressionShare: share.share,
      lostBudget: share.lostBudget,
      lostRank: share.lostRank,
      belowBreakEven: tt.spend > 0 && (tt.roas ?? 0) < threshold,
    });
  }
  return out.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
}

const nameOf = (rows: WarehouseRows) => new Map(rows.campaigns.map((c) => [c.id, c.name]));

// ---- quebras ----------------------------------------------------------------------------------

function slices(list: readonly (BasicRow & { key: string; label: string })[]): SliceVM[] {
  const groups = groupBy(list, (r) => r.key);
  const all = sumBasic(list);
  const out: SliceVM[] = [];
  for (const [key, g] of groups) {
    const s = sumBasic(g);
    out.push({
      key,
      label: g[0].label,
      spend: s.spend,
      spendShare: ratio(s.spend, all.spend) ?? 0,
      value: s.value,
      valueShare: ratio(s.value, all.value) ?? 0,
      conversions: s.conversions,
      roas: ratio(s.value, s.spend),
      cpa: ratio(s.spend, s.conversions),
      ctr: ratio(s.clicks, s.impressions),
    });
  }
  return out.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
}

function breakdownSlices(rows: WarehouseRows, dimension: BreakdownDimension): SliceVM[] {
  return slices(
    rows.breakdownDaily.filter((r) => r.dimension === dimension && inRange(r.date, rows.current)).map((r) => ({ ...r, key: r.value, label: breakdownLabel(dimension, r.value) })),
  );
}

function ageGenderCells(rows: WarehouseRows): AgeGenderCell[] {
  const list = rows.breakdownDaily.filter((r) => r.dimension === "age_gender" && inRange(r.date, rows.current));
  const totalValue = money(list.map((r) => r.conversionValue));
  const out: AgeGenderCell[] = [];
  for (const [key, g] of groupBy(list, (r) => r.value)) {
    const parsed = parseAgeGender(key);
    if (!parsed) continue;
    const s = sumBasic(g);
    out.push({ age: parsed.age, gender: parsed.gender, spend: s.spend, value: s.value, conversions: s.conversions, roas: ratio(s.value, s.spend), valueShare: ratio(s.value, totalValue) ?? 0 });
  }
  return out;
}

function hourHeatmap(rows: WarehouseRows): HeatCell[] {
  const cells = new Map<string, HeatCell>();
  for (const r of rows.breakdownDaily) {
    if (r.dimension !== "hour" || !inRange(r.date, rows.current) || !/^\d{2}$/.test(r.value)) continue;
    const wd = weekday(r.date);
    const hour = Number(r.value);
    const key = `${wd}|${hour}`;
    const cell = cells.get(key) ?? { weekday: wd, hour, conversions: 0, value: 0, spend: 0 };
    cell.conversions = Math.round((cell.conversions + r.conversions) * 100) / 100;
    cell.value = Math.round((cell.value + r.conversionValue) * 100) / 100;
    cell.spend = Math.round(((cell.spend ?? 0) + r.spend) * 100) / 100;
    cells.set(key, cell);
  }
  return [...cells.values()].sort((a, b) => a.weekday - b.weekday || a.hour - b.hour);
}

// ---- Meta ----------------------------------------------------------------------------------------

export const FUNNEL_STAGE_LABEL: Record<string, string> = { prospecting: "Prospecção", retargeting: "Remarketing", retention: "Retenção" };

function metaFunnel(cur: AccountDayRow[], spend: number): FunnelStep[] {
  const sum = (pick: (r: AccountDayRow) => number | null) => sumNullable(cur, pick) ?? 0;
  const steps = [
    { id: "impressions", label: "Impressões", count: sum((r) => r.impressions) },
    { id: "linkClicks", label: "Cliques no link", count: sum((r) => r.linkClicks) },
    { id: "landingPageViews", label: "Visualizações da página", count: sum((r) => r.landingPageViews) },
    { id: "addToCart", label: "Adições ao carrinho", count: sum((r) => r.addToCart) },
    { id: "initiateCheckout", label: "Checkouts iniciados", count: sum((r) => r.initiateCheckout) },
    { id: "conversions", label: "Compras", count: sum((r) => r.conversions) },
  ];
  return steps.map((s, i) => ({ ...s, count: Math.round(s.count * 100) / 100, rate: i ? ratio(s.count, steps[i - 1].count) : null, cost: i ? ratio(spend, s.count) : null }));
}

function funnelByStage(rows: WarehouseRows): FunnelByStage[] {
  const stageOf = new Map(rows.campaigns.map((c) => [c.id, c.funnelStage ?? "other"]));
  const cur = rows.campaignDaily.filter((r) => inRange(r.date, rows.current));
  const out: FunnelByStage[] = [];
  for (const [stage, g] of groupBy(cur, (r) => stageOf.get(r.campaignId) ?? "other")) {
    const tt = totalsOf(g);
    const linkClicks = sumNullable(g, (r) => r.linkClicks) ?? 0;
    out.push({
      stage,
      label: FUNNEL_STAGE_LABEL[stage] ?? "Outras",
      spend: tt.spend,
      linkClicks,
      addToCart: sumNullable(g, (r) => r.addToCart) ?? 0,
      conversions: tt.conversions,
      convRate: ratio(tt.conversions, linkClicks),
      roas: tt.roas,
    });
  }
  const order = ["prospecting", "retargeting", "retention", "other"];
  return out.sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage));
}

/** Mudança mínima (frequência subindo e CTR caindo) para marcar fadiga. */
export const FATIGUE_THRESHOLD = 0.15;
const FATIGUE_MIN_IMPRESSIONS = 2000;

function creatives(rows: WarehouseRows): CreativeVM[] {
  const cur = rows.adDaily.filter((r) => inRange(r.date, rows.current));
  const byAd = groupBy(cur, (r) => r.adId);
  const campaigns = nameOf(rows);
  const dates = dateRange(rows.current.to, rows.current.days);
  const mid = dates[Math.floor(dates.length / 2)];
  const out: CreativeVM[] = [];
  for (const ad of rows.ads) {
    const list = byAd.get(ad.id);
    if (!list?.length) continue;
    const tt = totalsOf(list);
    const videoViews = sumNullable(list, (r) => r.videoViews);
    const thruplays = sumNullable(list, (r) => r.videoThruplays);
    const first = list.filter((r) => r.date < mid);
    const second = list.filter((r) => r.date >= mid);
    out.push({
      id: ad.id,
      name: ad.name,
      campaignName: campaigns.get(ad.campaignId) ?? "",
      format: ad.format,
      status: ad.status,
      headline: ad.headline,
      thumbnailUrl: ad.thumbnailUrl,
      spend: tt.spend,
      value: tt.value,
      conversions: tt.conversions,
      roas: tt.roas,
      linkCtr: tt.linkCtr ?? tt.ctr,
      frequency: tt.frequency,
      hookRate: videoViews ? ratio(videoViews, tt.impressions) : null,
      holdRate: videoViews && thruplays != null ? ratio(thruplays, videoViews) : null,
      fatigue: fatigueOf(first, second),
      ctrSpark: ctrSpark(list, dates),
    });
  }
  return out.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
}

/** Lista simples: nome, campanha, investimento e o resultado principal do objetivo. */
function creativeList(rows: WarehouseRows): CreativeListVM[] {
  const byAd = groupBy(
    rows.adDaily.filter((r) => inRange(r.date, rows.current)),
    (r) => r.adId,
  );
  const campaigns = new Map(rows.campaigns.map((c) => [c.id, c]));
  const out: CreativeListVM[] = [];
  for (const ad of rows.ads) {
    const list = byAd.get(ad.id);
    if (!list?.length) continue;
    const campaign = campaigns.get(ad.campaignId);
    const tt = totalsOf(list);
    out.push({
      id: ad.id,
      name: ad.name,
      campaignName: campaign?.name ?? "",
      status: ad.status,
      spend: tt.spend,
      result: objectiveResult(campaign?.objective ?? null, {
        conversions: tt.conversions,
        leads: sumNullable(list, (r) => r.leads),
        postEngagement: sumNullable(list, (r) => r.postEngagement),
        linkClicks: tt.linkClicks,
        clicks: tt.clicks,
        impressions: tt.impressions,
      }),
    });
  }
  return out.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
}

function withoutAdId(row: AdDayRow): CompareAd["days"][number] {
  const day: Partial<AdDayRow> = { ...row };
  delete day.adId;
  return day as CompareAd["days"][number];
}

/** Os dias de cada anúncio com entrega no período, para o comparativo. */
function creativeDays(rows: WarehouseRows): CompareAd[] {
  const byAd = groupBy(
    rows.adDaily.filter((r) => inRange(r.date, rows.current)),
    (r) => r.adId,
  );
  const campaigns = new Map(rows.campaigns.map((c) => [c.id, c]));
  const out: CompareAd[] = [];
  for (const ad of rows.ads) {
    const list = byAd.get(ad.id);
    if (!list?.length) continue;
    const campaign = campaigns.get(ad.campaignId);
    out.push({
      id: ad.id,
      name: ad.name,
      campaignName: campaign?.name ?? "",
      objective: campaign?.objective ?? null,
      format: ad.format,
      status: ad.status,
      headline: ad.headline,
      thumbnailUrl: ad.thumbnailUrl,
      postUrl: ad.postUrl ?? null,
      days: [...list].sort((a, b) => a.date.localeCompare(b.date)).map(withoutAdId),
    });
  }
  return out;
}

function ctrSpark(list: AdDayRow[], dates: string[]): (number | null)[] {
  const byDate = groupBy(list, (r) => r.date);
  return dates.map((d) => {
    const g = byDate.get(d);
    if (!g) return null;
    const tt = totalsOf(g);
    return tt.linkCtr ?? tt.ctr;
  });
}

/** Fadiga: na 2ª metade do período a frequência subiu e o CTR do link caiu (os dois além do limite). */
export function fatigueOf(first: readonly AdDayRow[], second: readonly AdDayRow[]): CreativeVM["fatigue"] {
  const a = totalsOf(first);
  const b = totalsOf(second);
  if (a.impressions < FATIGUE_MIN_IMPRESSIONS || b.impressions < FATIGUE_MIN_IMPRESSIONS) return null;
  const frequencyChange = deltaOf(b.frequency, a.frequency);
  const ctrChange = deltaOf(b.linkCtr ?? b.ctr, a.linkCtr ?? a.ctr);
  if (frequencyChange == null || ctrChange == null) return null;
  return frequencyChange >= FATIGUE_THRESHOLD && ctrChange <= -FATIGUE_THRESHOLD ? { frequencyChange, ctrChange } : null;
}

// ---- Google --------------------------------------------------------------------------------------

export const CHANNEL_LABEL: Record<string, string> = {
  performance_max: "Performance Max",
  shopping: "Shopping",
  search: "Pesquisa",
  display: "Display",
  video: "YouTube",
  demand_gen: "Demand Gen",
  app: "App",
};

function channels(rows: WarehouseRows): ChannelVM[] {
  const channelOf = new Map(rows.campaigns.map((c) => [c.id, c.channel ?? "other"]));
  return slices(
    rows.campaignDaily.filter((r) => inRange(r.date, rows.current)).map((r) => {
      const ch = channelOf.get(r.campaignId) ?? "other";
      return { ...r, key: ch, label: CHANNEL_LABEL[ch] ?? "Outras" };
    }),
  ).map((s) => ({ channel: s.key, label: s.label, spend: s.spend, spendShare: s.spendShare, value: s.value, valueShare: s.valueShare, conversions: s.conversions, roas: s.roas, cpa: s.cpa }));
}

function impressionShare(rows: WarehouseRows): ImpressionShareVM {
  const cur = rows.campaignDaily.filter((r) => inRange(r.date, rows.current));
  const prev = rows.campaignDaily.filter((r) => inRange(r.date, rows.previous));
  const byDate = groupBy(cur, (r) => r.date);
  const w = weightedShare(cur);
  return {
    ...w,
    previousShare: weightedShare(prev).share,
    daily: dateRange(rows.current.to, rows.current.days).map((date) => ({ date, share: weightedShare(byDate.get(date) ?? []).share })),
  };
}

function searchTerms(rows: WarehouseRows): SearchTermVM[] {
  const campaigns = nameOf(rows);
  const cur = rows.searchTermDaily.filter((r) => inRange(r.date, rows.current));
  const out: SearchTermVM[] = [];
  for (const g of groupBy(cur, (r) => `${r.searchTerm}\u0000${r.matchType}`).values()) {
    const s = sumBasic(g);
    // a campanha que mais gastou com o termo
    const top = [...groupBy(g, (r) => r.campaignId)].map(([id, l]) => [id, money(l.map((r) => r.spend))] as const).sort((a, b) => b[1] - a[1])[0];
    out.push({
      term: g[0].searchTerm,
      matchType: g[0].matchType,
      campaignName: campaigns.get(top[0]) ?? "",
      spend: s.spend,
      clicks: s.clicks,
      impressions: s.impressions,
      conversions: s.conversions,
      value: s.value,
      roas: ratio(s.value, s.spend),
      cpa: ratio(s.spend, s.conversions),
      ctr: ratio(s.clicks, s.impressions),
    });
  }
  return out.sort((a, b) => b.value - a.value || (b.spend ?? 0) - (a.spend ?? 0));
}

function products(rows: WarehouseRows): ProductVM[] {
  const cur = rows.productDaily.filter((r) => inRange(r.date, rows.current));
  const byProduct = groupBy(cur, (r) => r.productId);
  const totalValue = money(cur.map((r) => r.conversionValue));
  const out: ProductVM[] = [];
  for (const p of rows.products) {
    const g = byProduct.get(p.id);
    if (!g?.length) continue;
    const s = sumBasic(g);
    out.push({
      id: p.id,
      title: p.title,
      category: p.category,
      price: p.price,
      imageUrl: p.imageUrl,
      spend: s.spend,
      value: s.value,
      valueShare: ratio(s.value, totalValue) ?? 0,
      conversions: s.conversions,
      roas: ratio(s.value, s.spend),
      ctr: ratio(s.clicks, s.impressions),
    });
  }
  return out.sort((a, b) => b.value - a.value);
}

function productCategories(rows: WarehouseRows): SliceVM[] {
  const categoryOf = new Map(rows.products.map((p) => [p.id, p.category ?? "Sem categoria"]));
  return slices(
    rows.productDaily
      .filter((r) => inRange(r.date, rows.current))
      .map((r) => {
        const c = categoryOf.get(r.productId) ?? "Sem categoria";
        return { ...r, key: c, label: c };
      }),
  ).sort((a, b) => b.value - a.value);
}

// ---- montagem ---------------------------------------------------------------------------------

export function aggregateDashboard(rows: WarehouseRows, opts: AggregateOptions): DashboardView {
  const maturingFrom = maturingStart(rows.current, opts.maturingDays ?? MATURING_DAYS);
  const cur = rows.accountDaily.filter((r) => inRange(r.date, rows.current));
  const prev = rows.accountDaily.filter((r) => inRange(r.date, rows.previous));
  const { dates, byDate, points } = dailySeries(rows.accountDaily, rows.current, maturingFrom);
  const totals = totalsOf(cur);
  const previousTotals = totalsOf(prev);
  const breakEven = opts.breakEvenRoas != null && opts.breakEvenRoas > 0 ? opts.breakEvenRoas : null;
  const roasNote = breakEven ? `equilíbrio ${breakEven.toFixed(1).replace(".", ",")}` : undefined;
  const base = { daily: points, totals, previousTotals, campaigns: campaignTable(rows, breakEven), breakEvenRoas: breakEven, hasData: cur.length > 0 };

  if (rows.platform === "meta") {
    const kpis = buildKpis(
      [
        { id: "spend", label: "Investimento", format: "money", better: "neutral", spendBased: true, pick: (r) => t(r).spend },
        { id: "revenue", label: "Receita", format: "money", better: "up", pick: (r) => t(r).value },
        { id: "roas", label: "ROAS", format: "ratio", better: "up", spendBased: true, note: roasNote, help: "Receita ÷ investimento. Equilíbrio = 1 ÷ margem.", pick: (r) => t(r).roas },
        { id: "purchases", label: "Compras", format: "int", better: "up", pick: (r) => t(r).conversions },
        { id: "cpa", label: "Custo por compra", format: "money", better: "down", spendBased: true, pick: (r) => t(r).cpa },
        { id: "ticket", label: "Ticket médio", format: "money", better: "up", pick: (r) => t(r).ticket },
        { id: "linkCtr", label: "CTR do link", format: "pct", better: "up", help: "Cliques no link ÷ impressões do período.", pick: (r) => t(r).linkCtr },
        { id: "cpm", label: "CPM", format: "money", better: "down", spendBased: true, help: "Investimento por mil impressões.", pick: (r) => t(r).cpm },
        {
          id: "frequency",
          label: "Frequência média por dia",
          format: "decimal",
          better: "neutral",
          help: "Impressões ÷ alcance, dia a dia. O alcance não soma pessoas únicas entre dias, então não é a frequência do período inteiro.",
          pick: (r) => t(r).frequency,
        },
      ],
      cur,
      prev,
      dates,
      byDate,
    );
    const extraKpis = buildKpis(
      [
        { id: "impressions", label: "Impressões", format: "int", better: "neutral", pick: (r) => t(r).impressions },
        { id: "reach", label: "Alcance médio por dia", format: "int", better: "neutral", help: "Média do alcance diário. Não é o total de pessoas únicas do período.", pick: reachPerDay },
        { id: "clicks", label: "Cliques", format: "int", better: "up", pick: (r) => t(r).clicks },
        { id: "linkClicks", label: "Cliques no link", format: "int", better: "up", pick: (r) => t(r).linkClicks },
        { id: "ctr", label: "CTR", format: "pct", better: "up", help: "Todos os cliques ÷ impressões do período.", pick: (r) => t(r).ctr },
        { id: "cpc", label: "CPC", format: "money", better: "down", spendBased: true, help: "Investimento ÷ cliques.", pick: (r) => t(r).cpc },
      ],
      cur,
      prev,
      dates,
      byDate,
    );
    const view: MetaView = {
      platform: "meta",
      ...base,
      kpis,
      extraKpis,
      funnel: metaFunnel(cur, totals.spend ?? 0),
      funnelByStage: funnelByStage(rows),
      creatives: creatives(rows),
      creativeList: creativeList(rows),
      creativeDays: creativeDays(rows),
      ageGender: ageGenderCells(rows),
      placements: breakdownSlices(rows, "placement"),
      devices: breakdownSlices(rows, "device"),
      regions: breakdownSlices(rows, "region"),
    };
    return view;
  }

  const share = impressionShare(rows);
  const kpis = buildKpis(
    [
      { id: "spend", label: "Custo", format: "money", better: "neutral", spendBased: true, pick: (r) => t(r).spend },
      { id: "value", label: "Valor de conversão", format: "money", better: "up", pick: (r) => t(r).value },
      { id: "roas", label: "ROAS", format: "ratio", better: "up", spendBased: true, note: roasNote, help: "Valor de conversão ÷ custo. Equilíbrio = 1 ÷ margem.", pick: (r) => t(r).roas },
      { id: "conversions", label: "Conversões", format: "decimal", better: "up", help: "O Google divide conversões entre cliques (atribuição baseada em dados): pode ter decimais.", pick: (r) => t(r).conversions },
      { id: "cpa", label: "CPA", format: "money", better: "down", spendBased: true, pick: (r) => t(r).cpa },
      { id: "ctr", label: "CTR", format: "pct", better: "up", pick: (r) => t(r).ctr },
      { id: "cpc", label: "CPC médio", format: "money", better: "down", spendBased: true, pick: (r) => t(r).cpc },
    ],
    cur,
    prev,
    dates,
    byDate,
  );
  kpis.push({
    id: "impressionShare",
    label: "Parcela de impressões",
    format: "pct",
    better: "up",
    help: "Campanhas de pesquisa: impressões ÷ impressões possíveis, ponderado pelas impressões elegíveis.",
    value: share.share,
    previous: share.previousShare,
    delta: deltaOf(share.share, share.previousShare),
    spark: share.daily.map((d) => d.share),
  });
  const terms = searchTerms(rows);
  const wasted = terms.filter((s) => s.conversions === 0 && (s.spend ?? 0) > 0).sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  const wastedSpend = money(wasted.map((s) => s.spend ?? 0));
  const extraKpis = buildKpis(
    [
      { id: "impressions", label: "Impressões", format: "int", better: "neutral", pick: (r) => t(r).impressions },
      { id: "clicks", label: "Cliques", format: "int", better: "up", pick: (r) => t(r).clicks },
      { id: "cpm", label: "CPM", format: "money", better: "down", spendBased: true, help: "Custo por mil impressões.", pick: (r) => t(r).cpm },
    ],
    cur,
    prev,
    dates,
    byDate,
  );
  const view: GoogleView = {
    platform: "google",
    ...base,
    extraKpis,
    kpis,
    channels: channels(rows),
    devices: breakdownSlices(rows, "device"),
    heatmap: hourHeatmap(rows),
    impressionShare: share,
    searchTerms: terms,
    wastedTerms: wasted,
    wastedSpend,
    wastedShare: ratio(wastedSpend, totals.spend) ?? 0,
    products: products(rows),
    productCategories: productCategories(rows),
  };
  return view;
}

// ---- investimento oculto ----------------------------------------------------------------------

/** Campos dos quais o investimento dá para recalcular (ex.: CPM × impressões, receita ÷ ROAS). */
const SPEND_FIELDS = new Set(["spend", "roas", "cpa", "cpc", "cpm", "cost", "wastedSpend", "breakEvenRoas"]);

function scrubSpend<T>(value: T): T {
  if (Array.isArray(value)) return value.map(scrubSpend) as T;
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SPEND_FIELDS.has(k) ? null : k === "belowBreakEven" ? false : scrubSpend(v);
  }
  return out as T;
}

const blankKpi = (k: Kpi): Kpi => (k.spendBased ? { ...k, value: null, previous: null, delta: null, spark: [], note: undefined } : k);

/**
 * Tira o investimento e tudo de onde ele dá para recalcular (links com "ocultar
 * investimento"). Roda no servidor, antes de mandar para o navegador: os números
 * nunca chegam ao cliente. Varre a estrutura inteira, para campo novo já nascer coberto.
 */
export function redactSpend<V extends DashboardView>(view: V): V {
  const clean = scrubSpend(view);
  return { ...clean, kpis: view.kpis.map(blankKpi), extraKpis: view.extraKpis?.map(blankKpi) };
}
