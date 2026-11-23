// O mês corrente, igual em todos os visuais e nos dois geradores (dados reais e de exemplo): o
// dia do mês e quantos dias ele tem, no fuso de São Paulo, e o gasto do mês até hoje somado dos
// próprios dias do dashboard. Antes o exemplo sorteava o dia (cada visual mostrava um).

import type { DayRow } from "./source";

/** Hoje em São Paulo (AAAA-MM-DD). */
export const todayInSaoPaulo = (now: Date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);

/** Dia do mês e dias no mês da data (sem a data: hoje em São Paulo). */
export function monthPosition(today?: string): { day: number; daysInMonth: number; month: string } {
  const iso = /^\d{4}-\d{2}-\d{2}/.test(today ?? "") ? today!.slice(0, 10) : todayInSaoPaulo();
  const [y, m, d] = iso.split("-").map(Number);
  return { day: d, daysInMonth: new Date(Date.UTC(y, m, 0)).getUTCDate(), month: iso.slice(0, 7) };
}

/** O gasto do mês até hoje: os dias do dashboard (atual e anterior) com ago < dia do mês. */
export function spentThisMonth(rows: readonly DayRow[], day: number): number {
  const seen = new Set<number>();
  let total = 0;
  for (const d of rows) {
    if (d.ago >= day || seen.has(d.ago)) continue;
    seen.add(d.ago);
    total += d.spend;
  }
  return total;
}
