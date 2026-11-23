// Contas dos blocos exclusivos dos visuais (Pulso, Lavanda, Noturno, Areia, Fachada). Puro, para
// testar. Só dado real: o que depende de verba ou meta do dashboard volta null (o bloco mostra o
// convite) e nada é estimado sem dizer.

import type { Campaign, Creative, Dataset, DayRow, Product } from "@/features/metrics/source";

// ---- Previsão (tendência + dia da semana; o resíduo dá a faixa e os dias fora do padrão) ----

export type Forecast = {
  hist: number[];
  fit: number[];
  future: number[];
  lo: number[];
  hi: number[];
  sd: number;
  anomalies: number[];
};

/** Regressão linear com efeito do dia da semana; resíduo dá a faixa. */
export function forecast(values: number[], horizon: number): Forecast {
  const n = values.length;
  const xs = values.map((_, i) => i);
  const mx = (n - 1) / 2;
  const my = values.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1;
  const slope =
    xs.reduce((a, x, i) => a + (x - mx) * (values[i] - my), 0) / sxx;
  const trend = (x: number) => my + slope * (x - mx);
  const season = Array.from({ length: 7 }, (_, d) => {
    const r = values
      .map((v, i) => [i, v - trend(i)] as const)
      .filter(([i]) => i % 7 === d);
    return r.length ? r.reduce((a, [, v]) => a + v, 0) / r.length : 0;
  });
  const fit = xs.map((x) => trend(x) + season[x % 7]);
  const res = values.map((v, i) => v - fit[i]);
  const sd = Math.sqrt(res.reduce((a, r) => a + r * r, 0) / Math.max(1, n - 2));
  const future = Array.from({ length: horizon }, (_, h) =>
    Math.max(0, trend(n + h) + season[(n + h) % 7]),
  );
  const band = (h: number) =>
    1.96 * sd * Math.sqrt(1 + 1 / n + (n + h - mx) ** 2 / sxx);
  return {
    hist: values,
    fit,
    future,
    lo: future.map((v, h) => Math.max(0, v - band(h))),
    hi: future.map((v, h) => v + band(h)),
    sd,
    anomalies: res
      .map((r, i) => (Math.abs(r) > 2 * sd ? i : -1))
      .filter((i) => i >= 0),
  };
}

const sum = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);
/** Dias do mais antigo para o mais recente (ago: 0 = hoje). */
const chrono = (rows: readonly DayRow[]) => [...rows].sort((a, b) => b.ago - a.ago);

// ---- Ritmo da verba no mês (Pulso) --------------------------------------------------------------

export type Pacing = {
  /** Gasto acumulado no mês, dia a dia (do dia 1 até hoje). */
  actual: number[];
  /** Linha ideal: verba ÷ dias do mês × dia, do dia 1 ao último. */
  ideal: number[];
  /** Onde o mês fecha no ritmo dos últimos 7 dias. */
  projected: number;
  monthly: number;
  spent: number;
  day: number;
  daysInMonth: number;
  status: "estoura" | "sobra" | "no ritmo";
};

/** Sem verba do mês definida: null (o bloco mostra o convite). */
export function pacing(ds: Pick<Dataset, "budget" | "current" | "previous">): Pacing | null {
  const { monthly, spent, day, daysInMonth } = ds.budget;
  if (!(monthly > 0) || day < 1 || daysInMonth < 1) return null;
  // os dias do mês até hoje (o período atual e o anterior juntos cobrem o mês)
  const all = new Map<number, number>();
  for (const d of [...ds.previous, ...ds.current]) if (d.ago < day) all.set(d.ago, d.spend);
  const daily = Array.from({ length: day }, (_, i) => all.get(day - 1 - i) ?? 0);
  const actual: number[] = [];
  daily.reduce((acc, v) => (actual.push(acc + v), acc + v), 0);
  const last7 = daily.slice(-7);
  const rate = last7.length ? sum(last7) / last7.length : 0;
  const projected = spent + rate * (daysInMonth - day);
  const ideal = Array.from({ length: daysInMonth }, (_, i) => (monthly * (i + 1)) / daysInMonth);
  const status = projected > monthly * 1.05 ? "estoura" : projected < monthly * 0.9 ? "sobra" : "no ritmo";
  return { actual, ideal, projected, monthly, spent, day, daysInMonth, status };
}

// ---- Onde o mês fecha (Noturno) ------------------------------------------------------------------

export type MonthClose = {
  /** Acumulado do mês até hoje, dia a dia. */
  done: number[];
  /** Acumulado previsto do dia seguinte ao fim do mês, com a faixa de confiança (95%). */
  future: number[];
  lo: number[];
  hi: number[];
  total: number;
  totalLo: number;
  totalHi: number;
};

/** Até hoje (o que já foi no mês) + o previsto até o fim do mês pela tendência com o dia da semana. */
export function monthClose(rows: readonly DayRow[], pick: (d: DayRow) => number, budget: { day: number; daysInMonth: number }): MonthClose | null {
  const days = chrono(rows);
  if (days.length < 14 || budget.day < 1) return null;
  const left = Math.max(0, budget.daysInMonth - budget.day);
  const f = forecast(days.map(pick), Math.max(1, left));
  const month = days.filter((d) => d.ago < budget.day).map(pick);
  const done: number[] = [];
  month.reduce((acc, v) => (done.push(acc + v), acc + v), 0);
  const base = done.at(-1) ?? 0;
  const cum = (xs: number[]) => xs.slice(0, left).reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? base) + v], []);
  const future = cum(f.future);
  const lo = cum(f.lo);
  const hi = cum(f.hi);
  return { done, future, lo, hi, total: future.at(-1) ?? base, totalLo: lo.at(-1) ?? base, totalHi: hi.at(-1) ?? base };
}

// ---- Precisa de ação hoje (Pulso) ----------------------------------------------------------------

export type ActionItem = {
  campaign: Campaign;
  reason: "sem resultado" | "custo subindo";
  /** O texto curto do motivo. */
  detail: string;
  /** Investimento dos últimos 7 dias (o minigráfico). */
  spark: number[];
  /** Quanto pesa: o gasto em risco nos últimos 3 dias. */
  weight: number;
};

/** Como a campanha está nos últimos dias (o status da tabela do Pulso). */
export type CampaignStatus = {
  status: "sem resultado" | "custo subindo" | "sem gasto" | "normal";
  /** O texto curto do motivo (vazio no normal). */
  detail: string;
  /** Resultado dos últimos 7 dias (o minigráfico). */
  spark: number[];
  /** Investimento dos últimos 7 dias. */
  spendSpark: number[];
  /** O gasto em risco nos últimos 3 dias. */
  weight: number;
};

/**
 * Status de uma campanha pelo dia a dia dela (as plataformas não mandam o liga/desliga):
 *   - sem gasto: nada investido nos últimos 3 dias;
 *   - sem resultado: gastou nos últimos 3 dias o custo de pelo menos um resultado médio, sem resultado;
 *   - custo subindo: custo por resultado dos últimos 3 dias 30% acima dos 7 dias antes deles;
 *   - normal: o resto. Sem o dia a dia (menos de 7 dias), null.
 */
export function campaignStatus(c: Campaign, avgCost: number): CampaignStatus | null {
  const d = c.daily;
  if (!d || d.spend.length < 7) return null;
  const n = d.spend.length;
  const s3 = sum(d.spend.slice(n - 3));
  const c3 = sum(d.conversions.slice(n - 3));
  const sBefore = sum(d.spend.slice(Math.max(0, n - 10), n - 3));
  const cBefore = sum(d.conversions.slice(Math.max(0, n - 10), n - 3));
  const base = { spark: d.conversions.slice(n - 7), spendSpark: d.spend.slice(n - 7), weight: s3 };
  if (s3 <= 0) return { ...base, status: "sem gasto", detail: "sem investimento nos últimos 3 dias" };
  if (c3 === 0 && avgCost > 0 && s3 >= avgCost) return { ...base, status: "sem resultado", detail: "gastou nos últimos 3 dias sem resultado" };
  if (c3 > 0 && cBefore > 0) {
    const now = s3 / c3;
    const before = sBefore / cBefore;
    if (before > 0 && now > before * 1.3) return { ...base, status: "custo subindo", detail: `custo por resultado ${Math.round((now / before - 1) * 100)}% acima da semana anterior` };
  }
  return { ...base, status: "normal", detail: "" };
}

/**
 * Campanhas que pedem ação: gastaram nos últimos 3 dias o custo de pelo menos um resultado médio
 * sem nenhum resultado, ou com o custo por resultado 30% acima da semana anterior a esses 3 dias.
 */
export function actionToday(campaigns: readonly Campaign[], avgCost: number, limit = 5): ActionItem[] {
  const out: ActionItem[] = [];
  for (const c of campaigns) {
    const s = campaignStatus(c, avgCost);
    if (s && (s.status === "sem resultado" || s.status === "custo subindo")) out.push({ campaign: c, reason: s.status, detail: s.detail, spark: s.spendSpark, weight: s.weight });
  }
  return out.sort((a, b) => b.weight - a.weight).slice(0, limit);
}

// ---- Criativo cansando (Pulso) -------------------------------------------------------------------

export type TiredCreative = { creative: Creative; ctr: number; avgCtr: number };

/** Frequência a partir da qual o mesmo público já viu o anúncio vezes demais. */
export const TIRED_FREQUENCY = 3;

/**
 * Criativos cansando: frequência de 3 ou mais no período e CTR abaixo da média dos criativos.
 * Os mais repetidos primeiro. Sem frequência (outras plataformas), não entram.
 */
export function tiredCreatives(creatives: readonly Creative[], limit = 5): TiredCreative[] {
  const seen = creatives.filter((c) => c.impressions > 0);
  const impressions = sum(seen.map((c) => c.impressions));
  if (!impressions) return [];
  const avgCtr = sum(seen.map((c) => c.clicks)) / impressions;
  return seen
    .filter((c) => c.frequency >= TIRED_FREQUENCY && c.clicks / c.impressions < avgCtr)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit)
    .map((c) => ({ creative: c, ctr: c.clicks / c.impressions, avgCtr }));
}

// ---- Ontem contra a média de 7 dias (Pulso) ------------------------------------------------------

export type DayCheck = { value: number; mean: number; lo: number; hi: number; status: "acima" | "abaixo" | "normal" };

/** Ontem (ago 1) contra os 7 dias antes dele: a média e a faixa do normal (mínimo e máximo). */
export function yesterdayVsWeek(rows: readonly DayRow[], pick: (d: DayRow) => number): DayCheck | null {
  const y = rows.find((d) => d.ago === 1);
  const week = rows.filter((d) => d.ago >= 2 && d.ago <= 8).map(pick);
  if (!y || week.length < 4) return null;
  const value = pick(y);
  const mean = sum(week) / week.length;
  const lo = Math.min(...week);
  const hi = Math.max(...week);
  return { value, mean, lo, hi, status: value > hi ? "acima" : value < lo ? "abaixo" : "normal" };
}

// ---- Picos e quedas explicados (Pulso, Noturno) ----------------------------------------------------

export type DayNote = { index: number; ago: number; value: number; expected: number; /** (valor − esperado) ÷ esperado */ change: number };

/** Dias fora do padrão (resíduo acima de 2 desvios da tendência com efeito do dia da semana), os maiores primeiro. */
export function dayNotes(rows: readonly DayRow[], pick: (d: DayRow) => number, limit = 3): DayNote[] {
  const days = chrono(rows);
  if (days.length < 14) return [];
  const values = days.map(pick);
  const f = forecast(values, 1);
  return f.anomalies
    .map((i) => ({ index: i, ago: days[i].ago, value: values[i], expected: Math.max(0, f.fit[i]), change: f.fit[i] > 0 ? values[i] / f.fit[i] - 1 : 0 }))
    // os últimos 3 dias ainda estão em maturação (e hoje está pela metade): não viram "fora do padrão"
    .filter((n) => n.expected > 0 && n.ago >= 3)
    .sort((a, b) => Math.abs(b.value - b.expected) - Math.abs(a.value - a.expected))
    .slice(0, limit)
    .sort((a, b) => a.index - b.index);
}

// ---- Ranking com subiu/desceu (Pulso, Areia, Noturno) -----------------------------------------------

export type Mover<T> = { item: T; value: number; prev: number; rank: number; /** posições ganhas (+) ou perdidas (−); null = nova no ranking */ moved: number | null };

/** Ranking pelo valor atual, com a posição no período anterior. */
export function movers<T>(items: readonly T[], now: (t: T) => number, before: (t: T) => number | null, limit = 5): Mover<T>[] {
  const cur = [...items].filter((t) => now(t) > 0).sort((a, b) => now(b) - now(a));
  const prevOrder = [...items].filter((t) => (before(t) ?? 0) > 0).sort((a, b) => (before(b) ?? 0) - (before(a) ?? 0));
  return cur.slice(0, limit).map((t, i) => {
    const p = prevOrder.indexOf(t);
    return { item: t, value: now(t), prev: before(t) ?? 0, rank: i + 1, moved: p < 0 ? null : p - i };
  });
}

export const campaignMovers = (campaigns: readonly Campaign[], key: "conversions" | "revenue", limit = 5) =>
  campaigns.some((c) => c.prev) ? movers(campaigns, (c) => c[key], (c) => (c.prev ? c.prev[key] : null), limit) : [];

export const productMovers = (products: readonly Product[], limit = 5) =>
  products.some((p) => p.prev) ? movers(products, (p) => p.revenue, (p) => (p.prev ? p.prev.revenue : null), limit) : [];

// ---- Cascata da variação (Lavanda) ------------------------------------------------------------------

export type WaterfallStep = { label: string; delta: number };
export type Waterfall = { start: number; end: number; steps: WaterfallStep[] };

/** O passo que fecha a cascata no total do dashboard (o que as campanhas não somam, ou somam em dobro). */
export const ADJUST_LABEL = "Ajuste ao total";

/**
 * Do total do período anterior ao atual: quanto cada campanha somou ou tirou (as maiores; o resto
 * em "Outras"). Com `totals` (os do dashboard, os mesmos dos cards e do comparativo), a cascata
 * começa e termina neles; a diferença para a soma das campanhas vira o passo "Ajuste ao total"
 * (conversão fora das campanhas listadas ou contada por duas plataformas).
 */
export function waterfall(campaigns: readonly Campaign[], key: "conversions" | "revenue", top = 4, totals?: { start: number; end: number }): Waterfall | null {
  if (!campaigns.some((c) => c.prev)) return null;
  const rows = campaigns.map((c) => ({ label: c.name, delta: c[key] - (c.prev?.[key] ?? 0) })).filter((r) => r.delta !== 0);
  const start = totals?.start ?? sum(campaigns.map((c) => c.prev?.[key] ?? 0));
  const end = totals?.end ?? sum(campaigns.map((c) => c[key]));
  if (start === 0 && end === 0) return null;
  const sorted = [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const big = sorted.slice(0, top);
  const rest = sum(sorted.slice(top).map((r) => r.delta));
  const steps = rest !== 0 ? [...big, { label: "Outras campanhas", delta: rest }] : big;
  const adjust = end - start - sum(steps.map((st) => st.delta));
  return { start, end, steps: Math.abs(adjust) >= 1 ? [...steps, { label: ADJUST_LABEL, delta: adjust }] : steps };
}

/**
 * Divide o total do dashboard (o do card) entre as plataformas, na proporção do que cada uma
 * atribui a si. Cada plataforma conta a conversão que reivindica: juntas, podem passar do total.
 * Devolve as partes (que somam o total) e quanto as plataformas atribuem juntas.
 */
export function sharesOfTotal<T extends { value: number }>(parts: readonly T[], total: number): { items: (T & { value: number; attributed: number })[]; attributed: number } {
  const attributed = sum(parts.map((p) => p.value));
  if (attributed <= 0 || total <= 0) return { items: parts.map((p) => ({ ...p, attributed: p.value })), attributed };
  // maior resto: as partes inteiras somam exatamente o total
  const raw = parts.map((p) => (p.value / attributed) * total);
  const floor = raw.map(Math.floor);
  let left = Math.round(total) - sum(floor);
  const order = raw.map((v, i) => [v - floor[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floor[i] += 1;
    left -= 1;
  }
  return { items: parts.map((p, i) => ({ ...p, value: floor[i], attributed: p.value })), attributed };
}

// ---- Destaques do mês (Lavanda) ---------------------------------------------------------------------

/** O melhor dia do período (mais resultado; empate, o mais recente). */
export function bestDay(rows: readonly DayRow[], pick: (d: DayRow) => number): DayRow | null {
  let best: DayRow | null = null;
  for (const d of rows) if (pick(d) > 0 && (!best || pick(d) > pick(best) || (pick(d) === pick(best) && d.ago < best.ago))) best = d;
  return best;
}

// ---- Mapa de calor dia da semana × hora (Noturno, Areia) --------------------------------------------

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** O pico (dia da semana e hora) e o maior valor da grade. null = sem dado. */
export function heatPeak(grid: readonly (readonly number[])[] | undefined): { day: number; hour: number; max: number; total: number } | null {
  if (!grid?.length) return null;
  let best = { day: 0, hour: 0, max: 0 };
  let total = 0;
  grid.forEach((row, d) =>
    row.forEach((v, h) => {
      total += v;
      if (v > best.max) best = { day: d, hour: h, max: v };
    }),
  );
  return best.max > 0 ? { ...best, total } : null;
}

/** Por hora do dia (soma dos dias da semana). */
export const byHour = (grid: readonly (readonly number[])[]) => Array.from({ length: 24 }, (_, h) => sum(grid.map((row) => row[h] ?? 0)));

// ---- Funil do CRM com a taxa de passagem (Areia) ----------------------------------------------------

/** Cada etapa com a parte que passou da anterior (a primeira, 100%). */
export function stagePass(stages: readonly { stage: string; count: number }[]): { stage: string; count: number; pass: number | null }[] {
  return stages.map((s, i) => ({ ...s, pass: i === 0 ? null : stages[i - 1].count > 0 ? s.count / stages[i - 1].count : null }));
}

// ---- Mapa do Brasil em quadrados (Fachada) ----------------------------------------------------------

/** Um quadrado por estado, na posição aproximada do mapa (linha, coluna). */
export const BR_TILES: Record<string, [number, number]> = {
  RR: [0, 2], AP: [0, 4],
  AM: [1, 1], PA: [1, 3], MA: [1, 4], CE: [1, 5], RN: [1, 6],
  AC: [2, 0], RO: [2, 1], TO: [2, 3], PI: [2, 4], PB: [2, 6], PE: [2, 5],
  MT: [3, 2], GO: [3, 3], BA: [3, 4], SE: [3, 6], AL: [3, 5],
  MS: [4, 2], DF: [4, 3], MG: [4, 4], ES: [4, 5],
  PR: [5, 3], SP: [5, 4], RJ: [5, 5],
  SC: [6, 3],
  RS: [7, 3],
};

/** Parte de cada estado no total (os que vieram na quebra por estado). */
export function stateShares(rows: readonly { key: string; conversions: number }[] | undefined): Map<string, number> {
  const out = new Map<string, number>();
  if (!rows?.length) return out;
  const by = new Map<string, number>();
  for (const r of rows) by.set(r.key.toUpperCase(), (by.get(r.key.toUpperCase()) ?? 0) + r.conversions);
  const total = sum([...by.values()]);
  if (total <= 0) return out;
  for (const [k, v] of by) if (BR_TILES[k]) out.set(k, v / total);
  return out;
}
