// Comparativo de criativos: tudo que é conta, sem tela. Puro e testado.
// Regras:
//   * dia de veiculação = dia com impressões dentro do período selecionado;
//   * "Média/dia" só divide o que se soma (contagens e investimento). Taxas e
//     custos são iguais nos dois modos, porque já são soma ÷ soma;
//   * alcance é sempre média diária: somar dias não dá pessoas únicas;
//   * o melhor valor só existe com 2 anúncios ou mais com dado e valores diferentes.

import { decimal, int, pct } from "@/lib/format";
import { fatigueOf } from "../aggregate";
import { formatValue } from "../format";
import type { CompareAd } from "../types";
import { COMPARE_METRICS, metricById, sumsOf, type CompareGroup, type CompareMetric, type Sums } from "./metrics";
import { OBJECTIVE_LABEL, objectiveKey, type ObjectiveKey } from "./objectives";

export type CompareMode = "day" | "total";
export type { CompareGroup } from "./metrics";
type Day = CompareAd["days"][number];

export { COMPARE_METRICS, metricById, sumsOf, type CompareMetric, type Sums } from "./metrics";

export const COMPARE_GROUP_LABEL: Record<CompareGroup, string> = {
  delivery: "Entrega e alcance",
  clicks: "Cliques e conversão",
  video: "Vídeo e perfil",
  engagement: "Engajamento",
};
export const COMPARE_GROUPS: CompareGroup[] = ["delivery", "clicks", "video", "engagement"];

export const BLOCK_DAYS = 5;
export const BLOCK_AFTER_DAYS = 30;

/** "VID · UGC provador 15s" → "UGC provador 15s". */
export const shortName = (name: string) => name.replace(/^[A-Z]{2,4} · /, "");

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

/** Volumes começam em 0. Taxas, custos e médias se ajustam aos valores, para a variação aparecer. */
export const axisFromZero = (metric: Pick<CompareMetric, "additive" | "format">) => metric.additive || metric.format === "int";

const AXIS_MARGIN = 0.12;

/** Faixa do eixo Y do gráfico de evolução. Nunca abaixo de 0. */
export function chartRange(values: readonly (number | null)[], metric: Pick<CompareMetric, "additive" | "format">): { min: number; max: number } {
  const present = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (!present.length) return { min: 0, max: 1 };
  const lo = Math.min(...present);
  const hi = Math.max(...present);
  if (axisFromZero(metric)) return { min: 0, max: hi > 0 ? hi : 1 };
  const margin = hi > lo ? (hi - lo) * AXIS_MARGIN : Math.abs(hi) * AXIS_MARGIN || 1;
  return { min: Math.max(0, lo - margin), max: hi + margin };
}

/** Casas decimais que o passo do eixo pede: sem isso, 1,15 e 1,20 viram dois "1,2". */
function stepDigits(step: number): number {
  for (let d = 0; d <= 4; d++) {
    const scaled = step * 10 ** d;
    if (Math.abs(scaled - Math.round(scaled)) < 1e-6) return d;
  }
  return 4;
}

/** Rótulo do eixo Y, com a precisão do passo. */
export function axisLabel(metric: CompareMetric, value: number, step: number, currency: string): string {
  const d = stepDigits(step);
  switch (metric.format) {
    case "pct":
      return pct(value, stepDigits(step * 100));
    case "money":
      return formatValue(value, "money", currency);
    case "seconds":
      return `${decimal(value, d)} s`;
    case "int":
      return d ? decimal(value, d) : int(value);
    default:
      return decimal(value, d);
  }
}

/** Os anúncios que já abrem escolhidos: os de maior investimento (sem investimento à vista, os de mais impressões). */
export function defaultAds(pool: readonly CompareAd[], count = 2): string[] {
  const total = (ad: CompareAd, pick: (d: Day) => number | null) => ad.days.reduce((acc, d) => acc + Number(pick(d) ?? 0), 0);
  return [...pool]
    .sort((a, b) => total(b, (d) => d.spend) - total(a, (d) => d.spend) || total(b, (d) => d.impressions) - total(a, (d) => d.impressions))
    .slice(0, count)
    .map((a) => a.id);
}

export const EVOLUTION_BLOCK_NOTE = `Mais de ${BLOCK_AFTER_DAYS} dias de veiculação: cada ponto é um bloco de ${BLOCK_DAYS} dias. Contagens aparecem como média por dia do bloco; taxas e custos são calculados sobre o bloco inteiro.`;
