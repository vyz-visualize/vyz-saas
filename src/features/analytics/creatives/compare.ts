// Comparativo de criativos: tudo que é conta, sem tela. Puro e testado.
// Regras:
//   * dia de veiculação = dia com impressões dentro do período selecionado;
//   * "Média/dia" só divide o que se soma (contagens e investimento). Taxas e
//     custos são iguais nos dois modos, porque já são soma ÷ soma;
//   * alcance é sempre média diária: somar dias não dá pessoas únicas;
//   * o melhor valor só existe com 2 anúncios ou mais com dado e valores diferentes.

import { decimal, int } from "@/lib/format";
import { fatigueOf } from "../aggregate";
import { formatValue } from "../format";
import type { CompareAd, ValueFormat } from "../types";
import { OBJECTIVE_LABEL, objectiveKey, type ObjectiveKey } from "./objectives";

export type CompareMode = "day" | "total";
export type CompareGroup = "delivery" | "clicks" | "video" | "engagement";
type Day = CompareAd["days"][number];

export const COMPARE_GROUP_LABEL: Record<CompareGroup, string> = {
  delivery: "Entrega e alcance",
  clicks: "Cliques e conversão",
  video: "Vídeo e perfil",
  engagement: "Engajamento",
};
export const COMPARE_GROUPS: CompareGroup[] = ["delivery", "clicks", "video", "engagement"];

export const BLOCK_DAYS = 5;
export const BLOCK_AFTER_DAYS = 30;

export type Sums = {
  days: number;
  spend: number | null;
  impressions: number;
  /** Soma do alcance diário e quantos dias têm alcance: dá a média por dia, nunca pessoas únicas. */
  reachSum: number | null;
  reachDays: number;
  clicks: number;
  linkClicks: number | null;
  conversions: number;
  value: number;
  videoViews: number | null;
  thruplays: number | null;
  leads: number | null;
  engagement: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  profileVisits: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p95: number | null;
  p100: number | null;
  watchSeconds: number | null;
};

function sumOf(days: readonly Day[], pick: (d: Day) => number | null | undefined): number | null {
  let any = false;
  let total = 0;
  for (const d of days) {
    const v = pick(d);
    if (v == null) continue;
    any = true;
    total += Number(v);
  }
  return any ? total : null;
}

export function sumsOf(days: readonly Day[]): Sums {
  return {
    days: days.length,
    spend: sumOf(days, (d) => d.spend),
    impressions: sumOf(days, (d) => d.impressions) ?? 0,
    reachSum: sumOf(days, (d) => d.reach),
    reachDays: days.filter((d) => d.reach != null).length,
    clicks: sumOf(days, (d) => d.clicks) ?? 0,
    linkClicks: sumOf(days, (d) => d.linkClicks),
    conversions: sumOf(days, (d) => d.conversions) ?? 0,
    value: sumOf(days, (d) => d.conversionValue) ?? 0,
    videoViews: sumOf(days, (d) => d.videoViews),
    thruplays: sumOf(days, (d) => d.videoThruplays),
    leads: sumOf(days, (d) => d.leads),
    engagement: sumOf(days, (d) => d.postEngagement),
    reactions: sumOf(days, (d) => d.postReactions),
    comments: sumOf(days, (d) => d.postComments),
    shares: sumOf(days, (d) => d.postShares),
    saves: sumOf(days, (d) => d.postSaves),
    profileVisits: sumOf(days, (d) => d.profileVisits),
    p25: sumOf(days, (d) => d.videoP25),
    p50: sumOf(days, (d) => d.videoP50),
    p75: sumOf(days, (d) => d.videoP75),
    p95: sumOf(days, (d) => d.videoP95),
    p100: sumOf(days, (d) => d.videoP100),
    watchSeconds: sumOf(days, (d) => d.videoWatchSeconds),
  };
}

const per = (a: number | null, b: number | null) => (a == null || b == null || b <= 0 ? null : a / b);

export type CompareMetric = {
  id: string;
  label: string;
  group: CompareGroup;
  format: ValueFormat | "seconds";
  /** "down" = menor é melhor; null = sem vencedor (depende do plano de mídia). */
  better: "up" | "down" | null;
  /** Soma entre dias: em "Média/dia", divide pelos dias de veiculação. */
  additive: boolean;
  /** O investimento dá para recalcular a partir dela: some no link com investimento oculto. */
  spendDerived?: boolean;
  value: (s: Sums) => number | null;
};

const count = (id: string, label: string, group: CompareGroup, value: (s: Sums) => number | null): CompareMetric => ({ id, label, group, format: "int", better: "up", additive: true, value });
const rate = (id: string, label: string, group: CompareGroup, value: (s: Sums) => number | null): CompareMetric => ({ id, label, group, format: "pct", better: "up", additive: false, value });
const cost = (id: string, label: string, group: CompareGroup, value: (s: Sums) => number | null): CompareMetric => ({ id, label, group, format: "money", better: "down", additive: false, spendDerived: true, value });

export const COMPARE_METRICS: CompareMetric[] = [
  { id: "spend", label: "Investimento", group: "delivery", format: "money", better: null, additive: true, spendDerived: true, value: (s) => s.spend },
  count("impressions", "Impressões", "delivery", (s) => s.impressions),
  { id: "reach", label: "Alcance médio por dia", group: "delivery", format: "int", better: "up", additive: false, value: (s) => per(s.reachSum, s.reachDays) },
  { id: "frequency", label: "Frequência média por dia", group: "delivery", format: "decimal", better: null, additive: false, value: (s) => per(s.impressions, s.reachSum) },
  cost("cpm", "CPM", "delivery", (s) => (s.spend == null || s.impressions <= 0 ? null : (s.spend / s.impressions) * 1000)),

  count("clicks", "Cliques (todos)", "clicks", (s) => s.clicks),
  count("linkClicks", "Cliques no link", "clicks", (s) => s.linkClicks),
  rate("ctr", "CTR (todos)", "clicks", (s) => per(s.clicks, s.impressions)),
  rate("linkCtr", "CTR do link", "clicks", (s) => per(s.linkClicks, s.impressions)),
  cost("cpc", "CPC (todos)", "clicks", (s) => per(s.spend, s.clicks)),
  cost("cpcLink", "CPC do link", "clicks", (s) => per(s.spend, s.linkClicks)),
  count("conversions", "Compras", "clicks", (s) => s.conversions),
  cost("cpa", "Custo por compra", "clicks", (s) => per(s.spend, s.conversions)),
  { id: "value", label: "Valor de conversão", group: "clicks", format: "money", better: "up", additive: true, value: (s) => s.value },
  { id: "roas", label: "ROAS", group: "clicks", format: "ratio", better: "up", additive: false, spendDerived: true, value: (s) => per(s.value, s.spend) },
  rate("convRate", "Conversão do clique", "clicks", (s) => per(s.conversions, s.linkClicks)),
  count("leads", "Leads", "clicks", (s) => s.leads),
  cost("cpl", "Custo por lead", "clicks", (s) => per(s.spend, s.leads)),

  count("videoViews", "Reproduções de 3 s", "video", (s) => s.videoViews),
  count("thruplays", "ThruPlays", "video", (s) => s.thruplays),
  rate("hookRate", "Hook rate", "video", (s) => per(s.videoViews, s.impressions)),
  rate("holdRate", "Hold rate", "video", (s) => per(s.thruplays, s.videoViews)),
  cost("costPerThruplay", "Custo por ThruPlay", "video", (s) => (s.thruplays == null ? null : per(s.spend, s.thruplays))),
  count("p25", "Vídeo até 25%", "video", (s) => s.p25),
  count("p50", "Vídeo até 50%", "video", (s) => s.p50),
  count("p75", "Vídeo até 75%", "video", (s) => s.p75),
  count("p95", "Vídeo até 95%", "video", (s) => s.p95),
  count("p100", "Vídeo até 100%", "video", (s) => s.p100),
  { id: "avgWatch", label: "Tempo médio de reprodução", group: "video", format: "seconds", better: "up", additive: false, value: (s) => per(s.watchSeconds, s.videoViews) },
  count("profileVisits", "Visitas ao perfil", "video", (s) => s.profileVisits),

  count("engagement", "Engajamento com a publicação", "engagement", (s) => s.engagement),
  rate("engagementRate", "Taxa de engajamento", "engagement", (s) => per(s.engagement, s.impressions)),
  count("reactions", "Reações", "engagement", (s) => s.reactions),
  count("comments", "Comentários", "engagement", (s) => s.comments),
  count("shares", "Compartilhamentos", "engagement", (s) => s.shares),
  count("saves", "Salvamentos", "engagement", (s) => s.saves),
  cost("costPerEngagement", "Custo por engajamento", "engagement", (s) => (s.engagement == null ? null : per(s.spend, s.engagement))),
];

export const metricById = (id: string) => COMPARE_METRICS.find((m) => m.id === id);

/** Dias com entrega, em ordem: o "Dia 1" é o primeiro deles dentro do período. */
export const deliveryDays = (ad: Pick<CompareAd, "days">): Day[] => ad.days.filter((d) => d.impressions > 0).sort((a, b) => a.date.localeCompare(b.date));

/** Valor da métrica: em "Média/dia", o que se soma é dividido pelos dias de veiculação. */
export function metricValue(metric: CompareMetric, sums: Sums, mode: CompareMode): number | null {
  const v = metric.value(sums);
  if (v == null) return null;
  if (mode === "total" || !metric.additive) return v;
  return sums.days > 0 ? v / sums.days : null;
}

export type Best = { best: number | null; winners: number[] };

/** Melhor valor da linha. Sem vencedor: métrica sem direção, menos de 2 com dado, ou todos iguais. */
export function bestOf(values: readonly (number | null)[], better: CompareMetric["better"]): Best {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!better || present.length < 2 || present.every((v) => v === present[0])) return { best: null, winners: [] };
  const best = better === "up" ? Math.max(...present) : Math.min(...present);
  return { best, winners: values.flatMap((v, i) => (v === best ? [i] : [])) };
}

/** Quanto o valor está longe do melhor: −0,38 = 38% abaixo. null no próprio melhor ou com melhor zero. */
export function diffVsBest(value: number | null, best: number | null): number | null {
  if (value == null || best == null || best === 0 || value === best) return null;
  return (value - best) / Math.abs(best);
}

/** "−38% vs melhor" (o sinal é o da diferença, com o traço de menos de verdade). */
export function diffLabel(diff: number): string {
  const pct = Math.round(Math.abs(diff) * 100);
  return `${diff < 0 ? "−" : "+"}${pct}% vs melhor`;
}

export function formatMetric(metric: CompareMetric, value: number | null, currency: string, mode: CompareMode = "total"): string {
  if (value == null) return "—";
  if (metric.format === "seconds") return `${decimal(value, 1)} s`;
  // média por dia de uma contagem pequena: arredondar para inteiro esconderia a diferença
  if (metric.format === "int" && mode === "day" && metric.additive && value < 100) return decimal(value, 1);
  if (metric.format === "int") return int(value);
  return formatValue(value, metric.format, currency);
}

// ---- anúncios escolhidos ------------------------------------------------------------------------

export type AdStats = {
  ad: CompareAd;
  objective: ObjectiveKey;
  objectiveLabel: string;
  /** Dias de veiculação no período. */
  activeDays: number;
  sums: Sums;
  /** A mesma regra da galeria, dividindo pelos dias de veiculação. */
  fatigue: ReturnType<typeof fatigueOf>;
};

export function adStats(ad: CompareAd): AdStats {
  const days = deliveryDays(ad);
  const mid = Math.floor(days.length / 2);
  const objective = objectiveKey(ad.objective);
  return {
    ad,
    objective,
    objectiveLabel: OBJECTIVE_LABEL[objective],
    activeDays: days.length,
    sums: sumsOf(days),
    fatigue: days.length >= 2 ? fatigueOf(days.slice(0, mid) as never, days.slice(mid) as never) : null,
  };
}

/** Objetivos distintos entre os escolhidos; mais de um dispara o aviso. */
export const objectivesOf = (stats: readonly AdStats[]): ObjectiveKey[] => [...new Set(stats.map((s) => s.objective))];
export const objectivesDiffer = (stats: readonly AdStats[]) => objectivesOf(stats).length > 1;

/** Aviso em linguagem simples, ou null quando os objetivos são iguais. */
export function objectiveWarning(stats: readonly AdStats[], hideSpend = false): string | null {
  if (!objectivesDiffer(stats)) return null;
  const names = objectivesOf(stats)
    .map((o) => OBJECTIVE_LABEL[o])
    .join(" × ");
  const metrics = hideSpend ? "CTR, taxas e resultados" : "CPL, CTR, CPM e custo por resultado";
  return `Estes anúncios têm objetivos diferentes (${names}). Cada objetivo busca uma ação diferente, então ${metrics} não são diretamente comparáveis. Use esta comparação para contexto, não para eleger um vencedor.`;
}

export type TableCell = { value: number | null; text: string; isBest: boolean; diff: number | null };
export type TableRow = { metric: CompareMetric; cells: TableCell[] };
export type TableGroup = { group: CompareGroup; label: string; rows: TableRow[] };

/** A tabela: só métricas com dado em algum dos anúncios e só grupos com alguma linha. */
export function compareTable(stats: readonly AdStats[], mode: CompareMode, opts: { hideSpend?: boolean; currency?: string } = {}): TableGroup[] {
  const currency = opts.currency ?? "BRL";
  return COMPARE_GROUPS.flatMap((group) => {
    const rows = COMPARE_METRICS.filter((m) => m.group === group && !(opts.hideSpend && m.spendDerived)).flatMap((metric) => {
      const values = stats.map((s) => metricValue(metric, s.sums, mode));
      if (values.every((v) => v == null)) return [];
      const { best, winners } = bestOf(values, metric.better);
      const cells = values.map((value, i) => ({ value, text: formatMetric(metric, value, currency, mode), isBest: winners.includes(i), diff: winners.includes(i) ? null : diffVsBest(value, best) }));
      return [{ metric, cells }];
    });
    return rows.length ? [{ group, label: COMPARE_GROUP_LABEL[group], rows }] : [];
  });
}

/** A métrica que resume cada objetivo (sem investimento, a melhor que sobra). */
const KEY_METRIC: Record<ObjectiveKey, { open: string; hidden: string }> = {
  sales: { open: "cpa", hidden: "conversions" },
  leads: { open: "cpl", hidden: "leads" },
  engagement: { open: "costPerEngagement", hidden: "engagementRate" },
  traffic: { open: "cpcLink", hidden: "linkCtr" },
  awareness: { open: "cpm", hidden: "reach" },
  other: { open: "ctr", hidden: "ctr" },
};

export type ObjectiveHighlight = {
  objective: ObjectiveKey;
  label: string;
  metric: CompareMetric;
  /** Índice do anúncio melhor neste objetivo. Com um anúncio só, é ele. */
  winner: number | null;
  /** Só um anúncio tem este objetivo: não houve disputa. */
  alone: boolean;
  text: string;
};

/** "Destaque por objetivo": quem foi melhor na métrica-chave do objetivo de cada campanha. */
export function objectiveHighlights(stats: readonly AdStats[], mode: CompareMode, opts: { hideSpend?: boolean; currency?: string } = {}): ObjectiveHighlight[] {
  const currency = opts.currency ?? "BRL";
  return objectivesOf(stats).flatMap((objective) => {
    const metric = metricById(opts.hideSpend ? KEY_METRIC[objective].hidden : KEY_METRIC[objective].open);
    if (!metric) return [];
    const indexes = stats.flatMap((s, i) => (s.objective === objective ? [i] : []));
    const values = indexes.map((i) => metricValue(metric, stats[i].sums, mode));
    if (values.every((v) => v == null)) return [];
    const alone = indexes.length === 1;
    const local = alone ? (values[0] == null ? [] : [0]) : bestOf(values, metric.better).winners;
    const winner = local.length === 1 ? indexes[local[0]] : null;
    const value = winner == null ? null : metricValue(metric, stats[winner].sums, mode);
    return [{ objective, label: OBJECTIVE_LABEL[objective], metric, winner, alone, text: formatMetric(metric, value, currency, mode) }];
  });
}

// ---- evolução por dia de veiculação --------------------------------------------------------------

export type Evolution = {
  /** Mais de 30 dias: cada ponto é um bloco de 5 dias. */
  blocked: boolean;
  labels: string[];
  /** Uma série por anúncio, alinhadas pelo dia de veiculação (não pela data). */
  series: (number | null)[][];
};

export const usesBlocks = (ads: readonly Pick<CompareAd, "days">[]) => ads.some((a) => deliveryDays(a).length > BLOCK_AFTER_DAYS);

export function evolution(ads: readonly Pick<CompareAd, "days">[], metric: CompareMetric): Evolution {
  const perAd = ads.map(deliveryDays);
  const longest = Math.max(0, ...perAd.map((d) => d.length));
  const blocked = longest > BLOCK_AFTER_DAYS;
  const size = blocked ? BLOCK_DAYS : 1;
  const points = Math.ceil(longest / size);
  const labels = Array.from({ length: points }, (_, i) => (blocked ? `Dias ${i * size + 1}–${Math.min((i + 1) * size, longest)}` : `Dia ${i + 1}`));
  const series = perAd.map((days) =>
    Array.from({ length: points }, (_, i) => {
      const part = days.slice(i * size, (i + 1) * size);
      if (!part.length) return null;
      // bloco: o que se soma vira média por dia do bloco (o último bloco pode ser menor)
      return metricValue(metric, sumsOf(part), blocked ? "day" : "total");
    }),
  );
  return { blocked, labels, series };
}

export const EVOLUTION_BLOCK_NOTE = `Mais de ${BLOCK_AFTER_DAYS} dias de veiculação: cada ponto é um bloco de ${BLOCK_DAYS} dias. Contagens aparecem como média por dia do bloco; taxas e custos são calculados sobre o bloco inteiro.`;
