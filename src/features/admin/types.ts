// Painel interno: formato dos números (puro, serve à página, ao e-mail e aos testes).

/** Resultado de uma fonte: os dados, ou o motivo de não ter (sem quebrar o resto). */
export type Source<T> = { ok: true; data: T } | { ok: false; reason: string };

/** Valor por moeda (as lojas pagam em moedas diferentes). */
export type Money = Record<string, number>;

export type UsersBlock = {
  total: number;
  new7: number;
  new30: number;
  newPrev7: number;
  active7: number;
  active30: number;
  workspacesWithPlan: number;
  /** Cadastros por dia (últimos 30 dias). */
  signupsByDay: { date: string; n: number }[];
  /** Coortes semanais: % que voltou a entrar depois da 1ª semana. */
  cohorts: { week: string; size: number; returned: number }[];
};

export type Ga4Block = {
  active1: number;
  active7: number;
  active28: number;
  newUsers28: number;
  sessions28: number;
  topSources: { source: string; users: number }[];
  /** Retenção por coorte semanal (semana 0 a 4, em % da semana 0). */
  cohorts: { week: string; size: number; weeks: number[] }[];
};

export type RevenueBlock = {
  /** MRR (assinaturas normalizadas para 1 mês). */
  mrr: Money;
  subscribers: number;
  /** Receita dos últimos 30 dias. */
  revenue30: Money;
  /** Cancelamentos nos últimos 30 dias. */
  churned30: number;
  /** Churn em % (cancelados / ativos no início), quando dá para calcular. */
  churnRate: number | null;
  refunds30: Money;
  refundCount30: number;
  trials?: number;
  note?: string;
};

export type AdminReport = {
  generatedAt: string;
  users: Source<UsersBlock>;
  ga4: Source<Ga4Block>;
  stripe: Source<RevenueBlock>;
  appStore: Source<RevenueBlock>;
  googlePlay: Source<RevenueBlock>;
  revenueCat: Source<RevenueBlock>;
};

export const addMoney = (a: Money, cur: string, v: number): Money => ({ ...a, [cur]: Math.round(((a[cur] ?? 0) + v) * 100) / 100 });

export function moneyText(m: Money | undefined): string {
  const entries = Object.entries(m ?? {}).filter(([, v]) => Math.abs(v) >= 0.005);
  if (!entries.length) return "R$ 0,00";
  return entries
    .sort(([a], [b]) => (a === "BRL" ? -1 : b === "BRL" ? 1 : a.localeCompare(b)))
    .map(([c, v]) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: c }).format(v))
    .join(" + ");
}

export const pct = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(digits).replace(".", ",")}%`);
export const int = (v: number | null | undefined) => (v == null ? "—" : new Intl.NumberFormat("pt-BR").format(v));

/** Variação em % (null sem base). */
export const delta = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : null);

/** Meses de uma duração da loja ("1 Month", "1 Year", "P1M", "P1Y", "month", "year"). */
export function monthsOf(duration: string | null | undefined): number {
  const d = (duration ?? "").toLowerCase();
  const n = Number(d.match(/\d+/)?.[0] ?? 1) || 1;
  if (/y|ano/.test(d)) return 12 * n;
  if (/w|semana/.test(d)) return n / 4.345;
  if (/d|dia/.test(d) && !/m/.test(d)) return n / 30.4;
  return n;
}

/** Lê um TSV/CSV simples (com aspas) em objetos pela linha de cabeçalho. */
export function parseTable(text: string, sep: "\t" | ","): Record<string, string>[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const split = (l: string) => {
    if (sep === "\t") return l.split("\t");
    const out: string[] = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') {
        if (q && l[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if (ch === "," && !q) {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const head = split(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((l) => {
    const cells = split(l);
    return Object.fromEntries(head.map((h, i) => [h, (cells[i] ?? "").trim()]));
  });
}
