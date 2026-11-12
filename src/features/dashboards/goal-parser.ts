// Meta em texto livre, em português: "quero atingir um CPM de 6,50 na primeira semana",
// "CPL abaixo de 20 reais esse mês", "500 leads em dezembro". Sem IA: regras fixas,
// sempre a mesma resposta para o mesmo texto. A tela mostra a leitura para a pessoa
// confirmar antes de salvar.

import { metric, type MetricId } from "@/features/metrics/definitions";
import type { GoalDirection, GoalPeriod, MetricGoal } from "./goals";

export type GoalParse = { ok: true; goal: MetricGoal; /** Partes que a leitura supôs (sem período, sentido padrão...). */ assumed: string[] } | { ok: false; error: string };

/** minúsculas, sem acento, espaços simples. */
export function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Sinônimos, do mais longo para o mais curto: "custo por lead" vence "lead".
const SYNONYMS: [string, MetricId][] = [
  ["custo por lead qualificado", "cplq"],
  ["custo por lead", "cpl"],
  ["custo de lead", "cpl"],
  ["custo por cadastro", "cpl"],
  ["custo por venda", "cpa"],
  ["custo por compra", "cpa"],
  ["custo por aquisicao", "cpa"],
  ["custo por conversao", "cpa"],
  ["custo por resultado", "cpa"],
  ["custo de aquisicao", "cpa"],
  ["custo por clique", "cpc"],
  ["custo por mil", "cpm"],
  ["custo por visualizacao", "cpv"],
  ["taxa de cliques", "ctr"],
  ["taxa de clique", "ctr"],
  ["taxa de conversao", "convRate"],
  ["taxa de visualizacao", "viewRate"],
  ["retorno sobre o investimento em anuncios", "roas"],
  ["retorno sobre investimento", "roas"],
  ["retorno sobre o investimento", "roas"],
  ["ticket medio", "ticket"],
  ["leads qualificados", "qualified"],
  ["lead qualificado", "qualified"],
  ["visitas agendadas", "visits"],
  ["cplq", "cplq"],
  ["cpl", "cpl"],
  ["cpa", "cpa"],
  ["cpc", "cpc"],
  ["cpm", "cpm"],
  ["cpv", "cpv"],
  ["ctr", "ctr"],
  ["roas", "roas"],
  ["roi", "roas"],
  ["leads", "leads"],
  ["lead", "leads"],
  ["cadastros", "leads"],
  ["vendas", "conversions"],
  ["venda", "conversions"],
  ["compras", "conversions"],
  ["conversoes", "conversions"],
  ["conversao", "conversions"],
  ["matriculas", "conversions"],
  ["agendamentos", "conversions"],
  ["receita", "revenue"],
  ["faturamento", "revenue"],
  ["faturar", "revenue"],
  ["vender", "revenue"],
  ["investimento", "spend"],
  ["investir", "spend"],
  ["gasto", "spend"],
  ["gastar", "spend"],
  ["verba", "spend"],
  ["impressoes", "impressions"],
  ["cliques", "clicks"],
  ["sessoes", "sessions"],
  ["visualizacoes", "views"],
  ["views", "views"],
  ["ligacoes", "calls"],
  ["visitas", "visits"],
  ["frequencia", "frequency"],
];

const MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const word = (s: string) => new RegExp(`(^|[^a-z0-9])${s.replace(/ /g, "\\s+")}(?=$|[^a-z0-9])`);

// ---- datas (YYYY-MM-DD, sem fuso: só o calendário) --------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
};
const parts = (s: string) => s.split("-").map(Number) as [number, number, number];
const addDays = (s: string, n: number) => {
  const [y, m, d] = parts(s);
  return iso(y, m, d + n);
};
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const monthRange = (y: number, m: number): GoalPeriod => ({ kind: "custom", from: iso(y, m, 1), to: iso(y, m, lastDay(y, m)) });
/** Segunda-feira da semana do dia. */
const monday = (s: string) => {
  const [y, m, d] = parts(s);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(s, -((dow + 6) % 7));
};

type Found<T> = { value: T; start: number; end: number };

/** Período no texto; devolve onde estava para não virar número. */
function findPeriod(t: string, today: string): Found<GoalPeriod> | null {
  const [ty, tm] = parts(today);
  const at = (re: RegExp): RegExpExecArray | null => re.exec(t);
  const monthIdx = (name: string) => MONTHS.indexOf(name) + 1;
  const yearFor = (m: number, explicit?: string) => (explicit ? Number(explicit) : m < tm ? ty + 1 : ty);
  const monthNames = MONTHS.join("|");
  let r: RegExpExecArray | null;

  // primeira semana de <mês>
  if ((r = at(new RegExp(`(primeira|1a) semana (?:de|do mes de) (${monthNames})(?: de (\\d{4}))?`)))) {
    const m = monthIdx(r[2]);
    const y = yearFor(m, r[3]);
    return { value: { kind: "custom", from: iso(y, m, 1), to: iso(y, m, 7) }, start: r.index, end: r.index + r[0].length };
  }
  if ((r = at(/(primeira|1a) semana( do mes)?/))) return { value: { kind: "firstWeek" }, start: r.index, end: r.index + r[0].length };
  if ((r = at(/(?:n?es[st]a|n?esta) semana/))) {
    const from = monday(today);
    return { value: { kind: "custom", from, to: addDays(from, 6) }, start: r.index, end: r.index + r[0].length };
  }
  if ((r = at(/(?:na )?(?:proxima semana|semana que vem)/))) {
    const from = addDays(monday(today), 7);
    return { value: { kind: "custom", from, to: addDays(from, 6) }, start: r.index, end: r.index + r[0].length };
  }
  if ((r = at(/(?:no )?(?:proximo mes|mes que vem)/))) {
    const y = tm === 12 ? ty + 1 : ty;
    const m = tm === 12 ? 1 : tm + 1;
    return { value: monthRange(y, m), start: r.index, end: r.index + r[0].length };
  }
  if ((r = at(new RegExp(`(?:n?es[st]e|n?este|no|por) mes(?![a-z])(?! de (?:${monthNames}))|mensal(?:mente)?`)))) return { value: { kind: "month" }, start: r.index, end: r.index + r[0].length };
  // nos próximos N dias / em N dias
  if ((r = at(/(?:nos |em )?(?:proximos )?(\d{1,3}) dias/))) {
    const n = Math.max(1, Math.min(366, Number(r[1])));
    return { value: { kind: "custom", from: today, to: addDays(today, n - 1) }, start: r.index, end: r.index + r[0].length };
  }
  // até dd/mm(/aaaa) ou até o dia dd
  if ((r = at(/ate (?:o dia )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/))) {
    const d = Number(r[1]);
    const m = Number(r[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= lastDay(2024, m)) {
      let y = r[3] ? Number(r[3].length === 2 ? `20${r[3]}` : r[3]) : ty;
      let to = iso(y, m, Math.min(d, lastDay(y, m)));
      if (!r[3] && to < today) to = iso((y = ty + 1), m, Math.min(d, lastDay(y, m)));
      return { value: { kind: "custom", from: today <= to ? today : to, to }, start: r.index, end: r.index + r[0].length };
    }
  }
  if ((r = at(/ate o dia (\d{1,2})(?![\d/])/))) {
    const d = Number(r[1]);
    let y = ty;
    let m = tm;
    if (iso(y, m, d) < today) [y, m] = m === 12 ? [y + 1, 1] : [y, m + 1];
    const to = iso(y, m, Math.min(d, lastDay(y, m)));
    return { value: { kind: "custom", from: today, to }, start: r.index, end: r.index + r[0].length };
  }
  if ((r = at(/de (\d{1,2})\/(\d{1,2}) a (\d{1,2})\/(\d{1,2})/))) {
    const [d1, m1, d2, m2] = [r[1], r[2], r[3], r[4]].map(Number);
    if (m1 >= 1 && m1 <= 12 && m2 >= 1 && m2 <= 12) {
      const y1 = yearFor(m1);
      const from = iso(y1, m1, Math.min(d1, lastDay(y1, m1)));
      const y2 = m2 < m1 ? y1 + 1 : y1;
      const to = iso(y2, m2, Math.min(d2, lastDay(y2, m2)));
      return { value: { kind: "custom", from, to }, start: r.index, end: r.index + r[0].length };
    }
  }
  // em/de/no mês de <mês> (de aaaa)
  if ((r = at(new RegExp(`(?<![a-z])(?:(?:em|de|no mes de|para|ate o fim de|ate)\\s+)?(${monthNames})(?![a-z])(?:\\s+de\\s+(\\d{4}))?`)))) {
    const m = monthIdx(r[1]);
    return { value: monthRange(yearFor(m, r[2]), m), start: r.index, end: r.index + r[0].length };
  }
  return null;
}

// ---- números ---------------------------------------------------------------------------

type Num = { value: number; percent: boolean; money: boolean; start: number; end: number };

function findNumber(t: string): Num | null {
  const re = /(r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d+))?(?:\s*(mil|k|mi|milhao|milhoes)(?![a-z]))?(?:\s*(%|por cento|reais|real|centavos))?/g;
  let r: RegExpExecArray | null;
  while ((r = re.exec(t))) {
    if (!r[0].trim()) continue;
    const intPart = r[2].replace(/\./g, "");
    let value = Number(r[3] ? `${intPart}.${r[3]}` : intPart);
    // "6.50" com ponto e 2 casas é decimal; "1.500" é milhar (já tratado pelo grupo de milhar)
    const mult = r[4];
    if (mult === "mil" || mult === "k") value *= 1_000;
    else if (mult) value *= 1_000_000;
    if (r[5] === "centavos") value /= 100;
    return { value, percent: r[5] === "%" || r[5] === "por cento", money: !!r[1] || r[5] === "reais" || r[5] === "real" || r[5] === "centavos", start: r.index, end: r.index + r[0].length };
  }
  return null;
}

// ---- sentido ---------------------------------------------------------------------------

const MAX_WORDS = ["no maximo", "nao passar de", "nao passe de", "nao ultrapassar", "abaixo", "menor", "menos de", "menos que", "inferior", "maximo", "reduzir", "baixar", "diminuir", "teto", "ate"];
const MIN_WORDS = ["pelo menos", "no minimo", "acima", "maior", "mais de", "mais que", "superior", "minimo", "aumentar", "passar de", "ultrapassar"];

function findDirection(t: string): GoalDirection | null {
  // "pelo menos" contém "menos": as expressões de mínimo longas vêm primeiro
  const first = (words: string[]) => words.map((w) => word(w).exec(t)?.index ?? -1).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? -1;
  const longMin = first(["pelo menos", "no minimo", "nao menos que", "nao menos de"]);
  if (longMin >= 0) return "min";
  const mx = first(MAX_WORDS);
  const mn = first(MIN_WORDS);
  if (mx < 0 && mn < 0) return null;
  if (mn < 0) return "max";
  if (mx < 0) return "min";
  return mx < mn ? "max" : "min";
}

// ---- leitura -----------------------------------------------------------------------------

/** Lê a meta do texto. today = YYYY-MM-DD (o dia do workspace). */
export function parseGoalText(text: string, today: string): GoalParse {
  const raw = text.trim();
  if (!raw) return { ok: false, error: "Escreva a meta, por exemplo: CPL abaixo de 20 reais este mês." };
  const t0 = normalize(raw);

  // 1. métrica
  let metricId: MetricId | null = null;
  let mStart = -1;
  let mEnd = -1;
  for (const [syn, id] of SYNONYMS) {
    const r = word(syn).exec(t0);
    if (r) {
      metricId = id;
      mStart = r.index + r[1].length;
      mEnd = r.index + r[0].length;
      break;
    }
  }
  if (!metricId) return { ok: false, error: "Não reconheci a métrica. Use, por exemplo: CPM, CPC, CTR, CPL, CPA, ROAS, leads, vendas, receita ou investimento." };

  // 2. período (sai do texto antes de procurar o número)
  const assumed: string[] = [];
  const period = findPeriod(t0, today);
  const blank = (s: string, a: number, b: number) => s.slice(0, a) + " ".repeat(b - a) + s.slice(b);
  let t = blank(t0, mStart, mEnd);
  if (period) t = blank(t, period.start, period.end);
  else assumed.push("Sem período no texto: vale para este mês.");

  // 3. número
  const num = findNumber(t);
  if (!num) return { ok: false, error: "Não achei o valor da meta. Escreva o número, por exemplo: 6,50 ou 500." };

  const def = metric(metricId, "ecommerce");
  let value: number;
  if (def.format === "brl" || def.format === "brlCompact") value = Math.round(num.value * 100);
  else if (def.format === "pct") value = num.value / 100;
  else if (def.format === "int") value = Math.round(num.value);
  else value = num.value;
  if (!(value > 0)) return { ok: false, error: "A meta precisa ser maior que zero." };
  if (num.percent && def.format !== "pct") assumed.push(`O % foi ignorado: ${def.label} não é uma taxa.`);
  if (num.money && def.format !== "brl" && def.format !== "brlCompact") assumed.push(`${def.label} não é um valor em reais: li só o número.`);

  // 4. sentido: palavras do texto; "atingir", "bater" e sem palavra seguem o sentido da métrica
  let direction = findDirection(blank(t, num.start, num.end));
  if (!direction) {
    direction = def.better === "up" ? "min" : "max";
    if (def.better === "neutral") assumed.push(`Sem "no máximo" ou "pelo menos" no texto: li como teto de ${def.label.toLowerCase()}.`);
  }

  return { ok: true, goal: { metric: metricId, value, direction, period: period?.value ?? { kind: "month" }, text: raw.slice(0, 200) }, assumed };
}
