// Metas por métrica de um dashboard: qualquer KPI pode ter uma meta (valor, sentido
// e período). O valor fica na unidade da própria métrica, a mesma dos totais:
// centavos para dinheiro, fração para taxa (0,015 = 1,5%), número puro para volume.
// Funções puras, testadas. A meta de CPA antiga (goal_cents) segue à parte.

import { formatValue, metric, type MetricId, type Profile } from "@/features/metrics/definitions";
import { brl, decimal, int, pct } from "@/lib/format";

export type GoalDirection = "max" | "min";

export type GoalPeriod = { kind: "month" } | { kind: "firstWeek" } | { kind: "custom"; from: string; to: string };

export type MetricGoal = {
  metric: MetricId;
  value: number;
  direction: GoalDirection;
  period: GoalPeriod;
  /** O texto que a pessoa escreveu, quando veio do texto livre. */
  text?: string;
};

export const MAX_GOALS = 30;

export const GOAL_METRICS: MetricId[] = [
  "spend", "impressions", "clicks", "ctr", "cpc", "cpm", "conversions", "cpa", "revenue", "roas", "ticket", "leads", "cpl", "qualified", "cplq", "visits", "calls", "sessions", "convRate", "views", "cpv", "viewRate", "frequency",
];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parsePeriod(v: unknown): GoalPeriod | null {
  if (!v || typeof v !== "object") return null;
  const p = v as Record<string, unknown>;
  if (p.kind === "month" || p.kind === "firstWeek") return { kind: p.kind };
  if (p.kind === "custom" && typeof p.from === "string" && typeof p.to === "string" && ISO.test(p.from) && ISO.test(p.to) && p.from <= p.to) return { kind: "custom", from: p.from, to: p.to };
  return null;
}

/** Uma meta vinda de fora (banco ou navegador); null se não vale. */
export function parseGoal(v: unknown): MetricGoal | null {
  if (!v || typeof v !== "object") return null;
  const g = v as Record<string, unknown>;
  if (typeof g.metric !== "string" || !(GOAL_METRICS as string[]).includes(g.metric)) return null;
  if (typeof g.value !== "number" || !Number.isFinite(g.value) || g.value < 0 || g.value > 1e13) return null;
  if (g.direction !== "max" && g.direction !== "min") return null;
  const period = parsePeriod(g.period);
  if (!period) return null;
  const text = typeof g.text === "string" && g.text.trim() ? g.text.trim().slice(0, 200) : undefined;
  return { metric: g.metric as MetricId, value: g.value, direction: g.direction, period, ...(text ? { text } : {}) };
}

/** metric_goals do banco → lista limpa, uma meta por métrica (vale a última). */
export function parseMetricGoals(v: unknown): MetricGoal[] {
  if (!Array.isArray(v)) return [];
  const byMetric = new Map<MetricId, MetricGoal>();
  for (const item of v) {
    const g = parseGoal(item);
    if (g) byMetric.set(g.metric, g);
  }
  return [...byMetric.values()].slice(0, MAX_GOALS);
}

/** Troca (ou põe) a meta da métrica. */
export function withGoal(list: readonly MetricGoal[], goal: MetricGoal): MetricGoal[] {
  const i = list.findIndex((g) => g.metric === goal.metric);
  if (i < 0) return [...list, goal];
  const next = [...list];
  next[i] = goal;
  return next;
}

// ---- texto -----------------------------------------------------------------------------

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function periodLabel(p: GoalPeriod): string {
  if (p.kind === "month") return "este mês";
  if (p.kind === "firstWeek") return "primeira semana do mês";
  return p.from === p.to ? `em ${ddmm(p.from)}` : `de ${ddmm(p.from)} a ${ddmm(p.to)}`;
}

/** Valor da meta para ler: R$ 6,50 · 1,5% · 500 · 3,5. */
export function goalValueText(id: MetricId, value: number, profile: Profile = "ecommerce"): string {
  const f = metric(id, profile).format;
  if (f === "brl" || f === "brlCompact") return brl(value, { decimals: value % 100 !== 0 });
  if (f === "pct") return pct(value, value < 0.1 ? 2 : 1);
  if (f === "int") return int(value);
  return decimal(value, value % 1 === 0 ? 0 : 2);
}

/** "CPM no máximo R$ 6,50 · primeira semana do mês" */
export function describeGoal(g: MetricGoal, profile: Profile = "ecommerce"): string {
  const def = metric(g.metric, profile);
  return `${def.label} ${g.direction === "max" ? "no máximo" : "pelo menos"} ${goalValueText(g.metric, g.value, profile)} · ${periodLabel(g.period)}`;
}

// ---- progresso -------------------------------------------------------------------------

export type GoalStatus = { on: boolean; /** 0 a 1: quanto falta (1 = no alvo). */ progress: number; text: string };

/** Valor do período contra a meta: no alvo ou fora, e o quanto já foi. */
export function goalStatus(g: MetricGoal, current: number, profile: Profile = "ecommerce"): GoalStatus | null {
  if (!Number.isFinite(current)) return null;
  const target = goalValueText(g.metric, g.value, profile);
  if (g.direction === "max") {
    const on = current <= g.value;
    const progress = current <= 0 ? 1 : Math.min(1, g.value / current);
    return { on, progress, text: `${on ? "No alvo" : "Fora do alvo"} · máx. ${target}` };
  }
  const on = current >= g.value;
  const progress = g.value <= 0 ? 1 : Math.min(1, Math.max(0, current / g.value));
  return { on, progress, text: on ? `No alvo · mín. ${target}` : `${Math.round(progress * 100)}% da meta de ${target}` };
}

/** Valor atual formatado (para a confirmação no editor). */
export const currentText = (id: MetricId, v: number, profile: Profile) => formatValue(v, metric(id, profile).format);
