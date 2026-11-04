// Regras de cálculo. Toda métrica de razão é calculada sobre os totais do
// período (soma ÷ soma), nunca como média de médias.

import type { PlatformId } from "@/features/accounts/platforms";
import { hash } from "@/lib/random";
import type { MetricId } from "./definitions";
import type { Dataset, DayRow } from "./source";

export type Totals = Record<MetricId, number>;

const safe = (a: number, b: number) => (b > 0 ? a / b : 0);

export function totals(rows: DayRow[], frequency = 0): Totals {
  const sum = (k: keyof DayRow) => rows.reduce((a, d) => a + (d[k] as number), 0);
  const spend = sum("spend");
  const impressions = sum("impressions");
  const clicks = sum("clicks");
  const conversions = sum("conversions");
  const revenue = sum("revenue");
  const leads = sum("leads");
  const qualified = sum("qualified");
  const sessions = sum("sessions");
  const views = sum("views");
  return {
    spend,
    impressions,
    clicks,
    // CTR ponderado: cliques ÷ impressões do período inteiro
    ctr: safe(clicks, impressions),
    cpc: safe(spend, clicks),
    cpm: safe(spend, impressions) * 1000,
    conversions,
    cpa: safe(spend, conversions),
    revenue,
    roas: safe(revenue, spend),
    ticket: safe(revenue, conversions),
    leads,
    cpl: safe(spend, leads),
    qualified,
    cplq: safe(spend, qualified),
    visits: sum("visits"),
    calls: sum("calls"),
    sessions,
    convRate: safe(conversions, sessions),
    views,
    cpv: safe(spend, views),
    viewRate: safe(views, impressions),
    frequency,
  };
}

/** Média de frequência dos criativos, ponderada por impressões. */
export function frequencyOf(ds: Pick<Dataset, "creatives">): number {
  const imp = ds.creatives.reduce((a, c) => a + c.impressions, 0);
  return safe(
    ds.creatives.reduce((a, c) => a + c.frequency * c.impressions, 0),
    imp,
  );
}

/** A frequência dos cards num período: a do recorte, com filtro; a do modelo, sem. */
const frequencyFor = (ds: Dataset, when: "current" | "previous") => ds.filteredFrequency?.[when] ?? (when === "current" ? frequencyOf(ds) : frequencyOf(ds) * 0.94);

/** Frequência de um conjunto: impressões ÷ alcance, como numa campanha só. */
export function combinedFrequency(parts: readonly { impressions: number; frequency: number }[]): number {
  const impressions = parts.reduce((a, p) => a + p.impressions, 0);
  const reach = parts.reduce((a, p) => a + (p.frequency > 0 ? p.impressions / p.frequency : 0), 0);
  return safe(impressions, reach);
}

/**
 * Frequência de cada campanha da amostra: fictícia e estável. As de uma mesma plataforma
 * fecham com a frequência do modelo (impressões ÷ alcance), então os cards não mudam, e
 * nunca ficam abaixo de 1, porque só o que passa de 1 varia.
 */
export function campaignFrequencies(ds: Pick<Dataset, "spec" | "campaigns" | "creatives">): Map<string, number> {
  const total = frequencyOf(ds);
  const out = new Map<string, number>();
  const above = total - 1;
  for (const platform of new Set(ds.campaigns.map((c) => c.platform))) {
    const mine = ds.campaigns.filter((c) => c.platform === platform);
    const shape = mine.map((c) => 0.55 + ((hash(`${ds.spec.seed}|${c.id}|frequencia`) >>> 0) % 901) / 1000);
    const at = (k: number) => mine.map((c, i) => ({ impressions: c.impressions, frequency: 1 + above * shape[i] * k }));
    // acha a escala em que o conjunto fecha com o total (a frequência cresce com a escala)
    let lo = 0;
    let hi = 1;
    while (above > 0 && combinedFrequency(at(hi)) < total && hi < 1e6) hi *= 2;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (combinedFrequency(at(mid)) < total) lo = mid;
      else hi = mid;
    }
    const each = at(hi);
    mine.forEach((c, i) => out.set(c.id, above > 0 ? each[i].frequency : total));
  }
  return out;
}

export function currentTotals(ds: Dataset): Totals {
  return totals(ds.current, frequencyFor(ds, "current"));
}

export function previousTotals(ds: Dataset): Totals {
  return totals(ds.previous, frequencyFor(ds, "previous"));
}

/** Variação relativa entre períodos (0,082 = +8,2%). */
export function delta(cur: number, prev: number): number {
  return prev ? cur / prev - 1 : 0;
}

/** Série diária de uma métrica (razões calculadas dia a dia). */
export function series(rows: DayRow[], id: MetricId): number[] {
  return rows.map((d) => totals([d])[id]);
}

export function movingAverage(values: number[], window = 7): number[] {
  return values.map((_, i) => {
    const from = Math.max(0, i - window + 1);
    const slice = values.slice(from, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** Média móvel que ignora os dias em maturação (não puxa a tendência para baixo). */
export function maturedAverage(rows: DayRow[], id: MetricId, window = 7): number[] {
  const out: number[] = [];
  rows.forEach((_, i) => {
    const from = Math.max(0, i - window + 1);
    const slice = rows.slice(from, i + 1).filter((d) => !d.maturing);
    out.push(slice.length ? totals(slice)[id] : NaN);
  });
  return out;
}

export type PlatformTotals = { id: PlatformId; spend: number; impressions: number; clicks: number; conv: number; ctr: number; cpa: number };

/** O que cada plataforma atribui a si no período. */
export function byPlatform(ds: Dataset): PlatformTotals[] {
  return ds.adPlatforms.map((id) => {
    let spend = 0;
    let impressions = 0;
    let clicks = 0;
    let conv = 0;
    for (const d of ds.current) {
      const p = d.byPlatform[id];
      if (!p) continue;
      spend += p.spend;
      impressions += p.impressions;
      clicks += p.clicks;
      conv += p.conv;
    }
    return { id, spend, impressions, clicks, conv, ctr: safe(clicks, impressions), cpa: safe(spend, conv) };
  });
}

/**
 * Totais de uma plataforma num período (a parte dela nos cards). Só uma plataforma de
 * anúncios: os próprios totais. O modelo só divide investimento, impressões, cliques e
 * conversões; o resto vai na proporção das conversões que cada uma atribuiu a si.
 */
export function platformPart(ds: Dataset, id: PlatformId, when: "current" | "previous"): Totals {
  const rows = ds[when];
  const frequency = frequencyFor(ds, when);
  if (ds.adPlatforms.length <= 1 || !ds.adPlatforms.includes(id)) return totals(rows, frequency);
  const part = { spend: 0, impressions: 0, clicks: 0, conv: 0 };
  let attributed = 0;
  for (const d of rows) {
    const p = d.byPlatform[id];
    if (p) {
      part.spend += p.spend;
      part.impressions += p.impressions;
      part.clicks += p.clicks;
      part.conv += p.conv;
    }
    for (const other of ds.adPlatforms) attributed += d.byPlatform[other]?.conv ?? 0;
  }
  const share = attributed > 0 ? part.conv / attributed : 0;
  const all = totals(rows, frequency);
  const row: DayRow = {
    ago: 0,
    spend: part.spend,
    impressions: part.impressions,
    clicks: part.clicks,
    conversions: part.conv,
    revenue: all.revenue * share,
    leads: all.leads * share,
    qualified: all.qualified * share,
    visits: all.visits * share,
    calls: all.calls * share,
    sessions: all.sessions * share,
    views: all.views * share,
    byPlatform: {},
    maturing: false,
  };
  return totals([row], frequency);
}

/** Índice da etapa que recebe a maior queda relativa. */
export function biggestDrop(steps: { pct: number }[]): number {
  let idx = 1;
  let worst = -1;
  for (let i = 1; i < steps.length; i++) {
    const loss = 1 - steps[i].pct / steps[i - 1].pct;
    if (loss > worst) {
      worst = loss;
      idx = i;
    }
  }
  return idx;
}
