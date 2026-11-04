// Dashboard interativo nos dados reais: as linhas do armazém recortadas pelos filtros
// e agregadas pelas mesmas regras. Puro e testado; roda no servidor, antes de ocultar
// o investimento, para o número filtrado nunca chegar ao navegador sem passar por isso.
//
//   * cada filtro recorta linhas que têm aquela dimensão: nada é rateado;
//   * a visualização onde se clica continua com todos os itens (tabela de campanhas,
//     galeria, gráfico por dia) e só respeita as outras dimensões;
//   * o que a linha não tem (alcance entre campanhas, funil por anúncio) continua no
//     total, e o card diz isso;
//   * o comparativo de criativos ignora os filtros: só o período vale.

import { aggregateDashboard, campaignTable, creativeDays, creativeList, creatives, periodDaily } from "./aggregate";
import { clampDays, comparedDays, daysIn, hasFilters, NO_FILTERS, type DashFilters, type DayRange, type FilterDim, type FilterLabels } from "./filters";
import { ADD_TO_CART_METRIC, META_EXTRA_METRICS } from "./live-metrics";
import type { AccountDayRow, AdDayRow, AggregateOptions, CampaignDayRow, DashboardView, Kpi, MetaView, WarehouseRows } from "./types";

/** Só o que existe nestas linhas vale; o resto da URL é ignorado. */
export function effectiveFilters(rows: WarehouseRows, f: DashFilters): DashFilters {
  const campaigns = new Set(rows.campaigns.map((c) => c.id));
  const ads = new Set(rows.ads.map((a) => a.id));
  return {
    campaigns: f.campaigns.filter((id) => campaigns.has(id)),
    ads: f.ads.filter((id) => ads.has(id)),
    // dados reais: cada dashboard tem uma plataforma só
    platforms: [],
    days: clampDays(f.days, rows.current),
  };
}

type Cut = { campaigns?: ReadonlySet<string>; ads?: ReadonlySet<string>; days?: DayRange | null };

const nullableSum = (a: number | null, b: number | null) => (a == null && b == null ? null : (a ?? 0) + (b ?? 0));

/** Anúncios somados por campanha e dia. Alcance só com um anúncio: pessoas não se somam entre anúncios. */
function campaignRowsFromAds(list: readonly AdDayRow[], campaignOf: ReadonlyMap<string, string>, oneAd: boolean): CampaignDayRow[] {
  const out = new Map<string, CampaignDayRow>();
  for (const r of list) {
    const campaignId = campaignOf.get(r.adId) ?? "";
    const key = `${campaignId}|${r.date}`;
    const row = out.get(key);
    if (!row) {
      out.set(key, {
        campaignId,
        date: r.date,
        spend: r.spend,
        impressions: r.impressions,
        reach: oneAd ? r.reach : null,
        clicks: r.clicks,
        linkClicks: r.linkClicks,
        landingPageViews: null,
        addToCart: null,
        initiateCheckout: null,
        conversions: r.conversions,
        conversionValue: r.conversionValue,
        videoViews: r.videoViews,
        videoThruplays: r.videoThruplays,
        searchImpressionShare: null,
        searchLostIsBudget: null,
        searchLostIsRank: null,
        allConversions: null,
        interactions: null,
        topImpressionPct: null,
        absoluteTopImpressionPct: null,
      });
      continue;
    }
    row.spend += r.spend;
    row.impressions += r.impressions;
    row.clicks += r.clicks;
    row.linkClicks = nullableSum(row.linkClicks, r.linkClicks);
    row.conversions += r.conversions;
    row.conversionValue += r.conversionValue;
    row.videoViews = nullableSum(row.videoViews, r.videoViews);
    row.videoThruplays = nullableSum(row.videoThruplays, r.videoThruplays);
  }
  return [...out.values()];
}

/** A conta por dia a partir das campanhas escolhidas. Alcance só com uma: pessoas não se somam entre campanhas. */
function accountRowsFrom(list: readonly CampaignDayRow[], oneCampaign: boolean): AccountDayRow[] {
  const out = new Map<string, AccountDayRow>();
  for (const r of list) {
    const row = out.get(r.date);
    if (!row) {
      out.set(r.date, {
        date: r.date,
        spend: r.spend,
        impressions: r.impressions,
        reach: oneCampaign ? r.reach : null,
        clicks: r.clicks,
        linkClicks: r.linkClicks,
        landingPageViews: r.landingPageViews,
        addToCart: r.addToCart,
        initiateCheckout: r.initiateCheckout,
        conversions: r.conversions,
        conversionValue: r.conversionValue,
        videoViews: r.videoViews,
        videoThruplays: r.videoThruplays,
        searchImpressionShare: null,
        searchLostIsBudget: null,
        searchLostIsRank: null,
      });
      continue;
    }
    row.spend += r.spend;
    row.impressions += r.impressions;
    row.clicks += r.clicks;
    row.linkClicks = nullableSum(row.linkClicks, r.linkClicks);
    row.landingPageViews = nullableSum(row.landingPageViews, r.landingPageViews);
    row.addToCart = nullableSum(row.addToCart, r.addToCart);
    row.initiateCheckout = nullableSum(row.initiateCheckout, r.initiateCheckout);
    row.conversions += r.conversions;
    row.conversionValue += r.conversionValue;
    row.videoViews = nullableSum(row.videoViews, r.videoViews);
    row.videoThruplays = nullableSum(row.videoThruplays, r.videoThruplays);
  }
  return [...out.values()];
}

/** As linhas que valem para este recorte. Período e período anterior andam juntos. */
function cut(rows: WarehouseRows, c: Cut): WarehouseRows {
  const out: WarehouseRows = { ...rows };
  if (c.days) {
    const compared = comparedDays(c.days, rows.current.days);
    const days = daysIn(c.days);
    out.current = { ...c.days, days };
    out.previous = { ...compared, days };
  }
  if (!c.campaigns?.size && !c.ads?.size) return out;

  const campaignOf = new Map(rows.ads.map((a) => [a.id, a.campaignId]));
  const adKept = (id: string) => (!c.ads?.size || c.ads.has(id)) && (!c.campaigns?.size || c.campaigns.has(campaignOf.get(id) ?? ""));
  out.adDaily = rows.adDaily.filter((r) => adKept(r.adId));
  if (c.ads?.size) {
    out.campaignDaily = campaignRowsFromAds(out.adDaily, campaignOf, c.ads.size === 1);
    out.accountDaily = accountRowsFrom(out.campaignDaily, c.ads.size === 1);
  } else {
    out.campaignDaily = rows.campaignDaily.filter((r) => c.campaigns!.has(r.campaignId));
    out.accountDaily = accountRowsFrom(out.campaignDaily, c.campaigns!.size === 1);
  }
  if (c.campaigns?.size) out.searchTermDaily = rows.searchTermDaily.filter((r) => c.campaigns!.has(r.campaignId));
  return out;
}

/** Cards que dependem de funil: as linhas de anúncio não têm essas colunas. */
const NEEDS_FUNNEL_ROWS = new Set([...META_EXTRA_METRICS.flatMap((m) => (m.source === "rows" ? [m.id] : [])), ADD_TO_CART_METRIC.id]);
const REACH_KPIS = new Set(["reach", "frequency"]);

function replaceKpis(view: DashboardView, from: DashboardView, ids: ReadonlySet<string>, dims: FilterDim[]) {
  const byId = new Map([...from.kpis, ...(from.extraKpis ?? [])].map((k) => [k.id, k]));
  const swap = (k: Kpi): Kpi => {
    const total = ids.has(k.id) ? byId.get(k.id) : undefined;
    return total ? { ...total, unfiltered: dims } : k;
  };
  view.kpis = view.kpis.map(swap);
  view.extraKpis = view.extraKpis?.map(swap);
}

function labelsFor(rows: WarehouseRows, f: DashFilters): FilterLabels {
  const campaigns = new Map(rows.campaigns.map((c) => [c.id, c.name]));
  const ads = new Map(rows.ads.map((a) => [a.id, a.name]));
  return {
    campaigns: Object.fromEntries(f.campaigns.map((id) => [id, campaigns.get(id) ?? id])),
    ads: Object.fromEntries(f.ads.map((id) => [id, ads.get(id) ?? id])),
  };
}

export function aggregateFiltered(rows: WarehouseRows, filters: DashFilters = NO_FILTERS, opts: AggregateOptions): DashboardView {
  const f = effectiveFilters(rows, filters);
  if (!hasFilters(f)) return aggregateDashboard(rows, opts);

  const campaigns = new Set(f.campaigns);
  const ads = new Set(f.ads);
  const { days } = f;
  const view = aggregateDashboard(cut(rows, { campaigns, ads, days }), opts);

  view.campaigns = campaignTable(cut(rows, { ads, days }), view.breakEvenRoas);
  view.daily = periodDaily(cut(rows, { campaigns, ads }), opts);
  view.filterInfo = { filters: f, labels: labelsFor(rows, f), compared: days ? comparedDays(days, rows.current.days) : null };

  if (view.platform === "meta") {
    const meta = view as MetaView;
    const forAds = cut(rows, { campaigns, days });
    meta.creatives = creatives(forAds);
    meta.creativeList = creativeList(forAds);
    meta.creativeDays = creativeDays(rows);

    if (ads.size) {
      const noAds = aggregateDashboard(forAds, opts) as MetaView;
      meta.funnel = noAds.funnel;
      meta.funnelByStage = noAds.funnelByStage;
      replaceKpis(view, noAds, NEEDS_FUNNEL_ROWS, ["ads"]);
    }
    // alcance não soma pessoas entre campanhas ou anúncios: fica no total do que dá para somar
    if (ads.size > 1) {
      const one = campaigns.size === 1;
      replaceKpis(view, aggregateDashboard(one ? forAds : cut(rows, { days }), opts), REACH_KPIS, one || !campaigns.size ? ["ads"] : ["campaigns", "ads"]);
    } else if (!ads.size && campaigns.size > 1) {
      replaceKpis(view, aggregateDashboard(cut(rows, { days }), opts), REACH_KPIS, ["campaigns"]);
    }
  }
  return view;
}
