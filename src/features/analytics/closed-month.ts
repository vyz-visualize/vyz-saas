// "Mês anterior fechado" (relatório do Lavanda): o mês passado inteiro contra o mês antes dele.
// O período do dashboard sempre termina ontem, então o atalho pede um período personalizado que
// cobre do dia 1 do mês passado até ontem (e, no anterior, o mês antes dele) e marca o mês
// passado como trecho de dias. A comparação mês a mês sai das linhas diárias pela data.

import { addDays, dayNumber } from "@/features/sync/dates";
import type { DayRow } from "@/features/metrics/source";
import { MAX_CUSTOM_DAYS } from "./ranges";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export type DayRange = { from: string; to: string };

export type ClosedMonth = {
  /** O mês passado, do dia 1 ao último. */
  month: DayRange;
  /** O mês antes dele (a comparação). */
  before: DayRange;
  /** "outubro de 2026". */
  label: string;
  /** "setembro". */
  beforeLabel: string;
  /** Dias do período personalizado que cobre os dois meses (o atual vai até ontem). */
  periodDays: number;
  /** Cabe no limite do período personalizado? */
  available: boolean;
};

const firstOf = (iso: string) => `${iso.slice(0, 8)}01`;
const monthName = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1] ?? "";
const span = (r: DayRange) => dayNumber(r.to) - dayNumber(r.from) + 1;

export function closedMonth(today: string): ClosedMonth {
  const yesterday = addDays(today, -1);
  // o mês fechado: o último que terminou até ontem (no dia 1, o de ontem já fechou)
  const lastDay = addDays(firstOf(today), -1);
  const month = { from: firstOf(lastDay), to: lastDay };
  const beforeTo = addDays(month.from, -1);
  const before = { from: firstOf(beforeTo), to: beforeTo };
  // o atual cobre do dia 1 do mês fechado até ontem; o atual e o anterior juntos (2 × o tamanho) chegam ao dia 1 do mês antes
  const periodDays = Math.max(dayNumber(yesterday) - dayNumber(month.from) + 1, Math.ceil((dayNumber(yesterday) - dayNumber(before.from) + 1) / 2));
  return { month, before, label: `${monthName(month.from)} de ${month.from.slice(0, 4)}`, beforeLabel: monthName(before.from), periodDays, available: periodDays <= MAX_CUSTOM_DAYS };
}

/** O trecho é o mês fechado? (o relatório troca a comparação para o mês antes dele) */
export const isClosedMonth = (cm: ClosedMonth, days: DayRange | null | undefined) => !!days && days.from === cm.month.from && days.to === cm.month.to;

/** As linhas diárias de um intervalo (pela data: hoje − ago). */
export function rowsIn(rows: readonly DayRow[], today: string, r: DayRange): DayRow[] {
  return rows.filter((d) => {
    const date = addDays(today, -d.ago);
    return date >= r.from && date <= r.to;
  });
}

/** Todos os dias do intervalo estão nas linhas? (sem isso, a comparação não é do mês inteiro) */
export const coversRange = (rows: readonly DayRow[], today: string, r: DayRange) => rowsIn(rows, today, r).length === span(r);
