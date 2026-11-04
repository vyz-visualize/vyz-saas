// Dashboard interativo nas amostras: o Dataset recortado pelos filtros. Os números são
// fictícios e o modelo guarda o total por campanha, não por dia: a curva diária da
// campanha sai por proporção, e os cards fecham com a linha dela. Puro e testado; roda
// no navegador (cards) e no servidor (galeria e métricas novas), sempre igual.

import type { PlatformId } from "@/features/accounts/platforms";
import { clampDays, hasFilters, type DashFilters, type DayRange } from "@/features/analytics/filters";
import { addDays } from "@/features/sync/dates";
import { hash } from "@/lib/random";
import type { Campaign, Dataset, DayRow } from "./source";

const METRICS = ["spend", "impressions", "clicks", "conversions", "revenue"] as const;
type Metric = (typeof METRICS)[number];
type Amounts = Record<Metric, number>;

/** O que foi escolhido, somado. A chave dá a variação estável no período anterior. */
type Part = Amounts & { key: string; platform?: PlatformId };

/** Os anúncios escolhidos, somados no servidor (dinheiro em centavos, como o modelo). */
export type AdTotals = Amounts;

export type FilteredDataset = {
  /** Cards e tudo o que respeita todos os filtros. `campaigns` ignora o filtro de campanha, para destacar. */
  ds: Dataset;
  /** Gráfico por dia: o período inteiro, sem o filtro de dias, para destacar o trecho. */
  chart: Pick<Dataset, "current" | "previous">;
  /** Cartões e barras por plataforma: sem o filtro de plataforma, para destacar. */
  platforms: Dataset;
  active: boolean;
};

export type FilterDatasetOptions = {
  /** Dia de hoje (YYYY-MM-DD): o eixo das amostras conta os dias a partir dele. */
  today: string;
  /** Amostras com galeria: os anúncios escolhidos, já no trecho de dias e na campanha filtrada. */
  adSelection?: AdTotals;
};

/** A data de uma linha da amostra, a mesma que o eixo do gráfico mostra. */
export const sampleRowDate = (today: string, ago: number) => addDays(today, -ago);

export function samplePeriod(ds: Pick<Dataset, "current">, today: string): DayRange | null {
  const first = ds.current[0];
  const last = ds.current.at(-1);
  return first && last ? { from: sampleRowDate(today, first.ago), to: sampleRowDate(today, last.ago) } : null;
}

const sum = (rows: readonly DayRow[], key: Metric) => rows.reduce((a, d) => a + d[key], 0);
const each = (make: (m: Metric) => number) => Object.fromEntries(METRICS.map((m) => [m, make(m)])) as Amounts;
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/** Quanto das linhas as partes representam. Mais de uma plataforma atribui a mesma venda: nunca passa do total. */
const sharesOf = (parts: readonly Part[], rows: readonly DayRow[]) =>
  each((m) => {
    const total = sum(rows, m);
    return total > 0 ? clamp01(parts.reduce((a, p) => a + p[m], 0) / total) : 0;
  });

/** Variação estável de cada parte entre os períodos: o anterior não copia a proporção do atual. */
const drift = (seed: string, key: string, m: Metric) => 0.85 + ((hash(`${seed}|${key}|${m}`) >>> 0) % 3001) / 10000;

const driftOf = (seed: string, parts: readonly Part[], m: Metric) => {
  const total = parts.reduce((a, p) => a + p[m], 0);
  return total > 0 ? parts.reduce((a, p) => a + p[m] * drift(seed, p.key, m), 0) / total : 1;
};

type PlatformShares = ReadonlyMap<PlatformId, Pick<Amounts, "spend" | "impressions" | "clicks" | "conversions">>;

/** Quanto de cada plataforma as partes representam. */
function platformSharesOf(parts: readonly Part[], rows: readonly DayRow[]): PlatformShares {
  const out = new Map<PlatformId, Pick<Amounts, "spend" | "impressions" | "clicks" | "conversions">>();
  for (const id of new Set(parts.flatMap((p) => p.platform ?? []))) {
    const mine = parts.filter((p) => p.platform === id);
    const of = (m: "spend" | "impressions" | "clicks" | "conversions") => {
      const total = rows.reduce((a, d) => {
        const row = d.byPlatform[id];
        return a + (row ? (m === "conversions" ? row.conv : row[m]) : 0);
      }, 0);
      return total > 0 ? clamp01(mine.reduce((a, p) => a + p[m], 0) / total) : 0;
    };
    out.set(id, { spend: of("spend"), impressions: of("impressions"), clicks: of("clicks"), conversions: of("conversions") });
  }
  return out;
}

function scaleRow(d: DayRow, share: Amounts, platforms: PlatformShares): DayRow {
  const byPlatform: DayRow["byPlatform"] = {};
  for (const [id, f] of platforms) {
    const p = d.byPlatform[id];
    if (p) byPlatform[id] = { spend: p.spend * f.spend, impressions: p.impressions * f.impressions, clicks: p.clicks * f.clicks, conv: p.conv * f.conversions };
  }
  const c = share.conversions;
  return {
    ...d,
    spend: d.spend * share.spend,
    impressions: d.impressions * share.impressions,
    clicks: d.clicks * share.clicks,
    conversions: d.conversions * c,
    revenue: d.revenue * share.revenue,
    leads: d.leads * c,
    qualified: d.qualified * c,
    visits: d.visits * c,
    calls: d.calls * c,
    sessions: d.sessions * c,
    views: d.views * c,
    byPlatform,
  };
}

const toPart = (c: Campaign): Part => ({ key: c.id, platform: c.platform, spend: c.spend, impressions: c.impressions, clicks: c.clicks, conversions: c.conversions, revenue: c.revenue });

/** As campanhas que o filtro deixa, considerando plataforma e campanha. */
export function selectedCampaigns(ds: Pick<Dataset, "campaigns">, f: Pick<DashFilters, "campaigns" | "platforms">): Campaign[] {
  return ds.campaigns.filter((c) => (!f.campaigns.length || f.campaigns.includes(c.id)) && (!f.platforms.length || f.platforms.includes(c.platform)));
}

/** O trecho dentro das linhas: as mesmas posições valem no período anterior. */
function sliceRows(ds: Dataset, days: DayRange | null, today: string): Pick<Dataset, "current" | "previous"> {
  if (!days) return { current: ds.current, previous: ds.previous };
  const keep = ds.current.flatMap((d, i) => {
    const date = sampleRowDate(today, d.ago);
    return date >= days.from && date <= days.to ? [i] : [];
  });
  return { current: keep.flatMap((i) => ds.current[i] ?? []), previous: keep.flatMap((i) => ds.previous[i] ?? []) };
}

/** Cada campanha no trecho: a mesma fração do período, métrica a métrica. */
function campaignsIn(ds: Dataset, rows: readonly DayRow[]): Campaign[] {
  if (rows === ds.current) return ds.campaigns;
  const r = each((m) => {
    const all = sum(ds.current, m);
    return all > 0 ? sum(rows, m) / all : 0;
  });
  return ds.campaigns.map((c) => ({ ...c, spend: c.spend * r.spend, impressions: c.impressions * r.impressions, clicks: c.clicks * r.clicks, conversions: c.conversions * r.conversions, revenue: c.revenue * r.revenue }));
}

export function filterDataset(ds: Dataset, filters: DashFilters, opts: FilterDatasetOptions): FilteredDataset {
  const period = samplePeriod(ds, opts.today);
  const days = period ? clampDays(filters.days, period) : null;
  const f: DashFilters = { ...filters, days };
  if (!hasFilters(f)) return { ds, chart: { current: ds.current, previous: ds.previous }, platforms: ds, active: false };

  const seed = ds.spec.seed;
  const everyCampaign = ds.campaigns.map(toPart);
  const inDays = sliceRows(ds, days, opts.today);

  /** As linhas de um trecho, na parte de um conjunto de itens. `basis`: as linhas com que as partes foram somadas. */
  const scaled = (rows: Pick<Dataset, "current" | "previous">, parts: readonly Part[] | null, basis: readonly DayRow[], extra?: Amounts) => {
    if (!parts) return { ...rows, adPlatforms: ds.adPlatforms };
    const base = sharesOf(parts, basis);
    const share = extra ? each((m) => base[m] * extra[m]) : base;
    // a soma de todas as campanhas é o total, inclusive no período anterior
    const previous = each((m) => clamp01((share[m] * driftOf(seed, parts, m)) / driftOf(seed, everyCampaign, m)));
    const platforms = platformSharesOf(parts, basis);
    return {
      current: rows.current.map((d) => scaleRow(d, share, platforms)),
      previous: rows.previous.map((d) => scaleRow(d, previous, platforms)),
      adPlatforms: ds.adPlatforms.filter((id) => platforms.has(id)),
    };
  };

  const noCampaignCut = !f.campaigns.length && !f.platforms.length;
  const chosen = noCampaignCut ? null : selectedCampaigns(ds, f).map(toPart);

  // anúncio da galeria: o servidor já somou, com o trecho e a campanha
  const gallery: Part[] | null = f.ads.length && opts.adSelection ? [{ key: f.ads.join(","), platform: "meta", ...opts.adSelection }] : null;

  // criativo do widget do modelo: não tem campanha nem dia; a receita acompanha as conversões
  const totalConversions = sum(ds.current, "conversions");
  const widget: Part[] | null =
    f.ads.length && !opts.adSelection && ds.creatives.some((c) => f.ads.includes(c.id))
      ? ds.creatives
          .filter((c) => f.ads.includes(c.id) && (!f.platforms.length || f.platforms.includes(c.platform)))
          .map((c) => ({ key: c.id, platform: c.platform, spend: c.spend, impressions: c.impressions, clicks: c.clicks, conversions: c.conversions, revenue: totalConversions > 0 ? (sum(ds.current, "revenue") * c.conversions) / totalConversions : 0 }))
      : null;
  const widgetOnCampaign = widget && f.campaigns.length ? sharesOf(selectedCampaigns(ds, { campaigns: f.campaigns, platforms: [] }).map(toPart), ds.current) : undefined;

  const cut = (rows: Pick<Dataset, "current" | "previous">) => {
    if (gallery) return scaled(rows, gallery, inDays.current);
    if (widget) return scaled(rows, widget, ds.current, widgetOnCampaign);
    return scaled(rows, chosen, ds.current);
  };

  const main = cut(inDays);
  const chart = cut({ current: ds.current, previous: ds.previous });

  // a tabela e as barras de campanha não respeitam o próprio filtro: o escolhido fica em destaque
  const table = campaignsIn(ds, inDays.current);
  const campaigns = f.platforms.length ? table.filter((c) => f.platforms.includes(c.platform)) : table;

  const withoutPlatform = f.campaigns.length ? selectedCampaigns(ds, { campaigns: f.campaigns, platforms: [] }).map(toPart) : null;
  const platforms = scaled(inDays, withoutPlatform, ds.current);

  return {
    ds: { ...ds, ...main, campaigns },
    chart: { current: chart.current, previous: chart.previous },
    platforms: { ...ds, ...platforms },
    active: true,
  };
}
