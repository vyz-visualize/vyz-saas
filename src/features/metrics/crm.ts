// CRM no dashboard: as linhas de crm_daily (reais ou da amostra) viram os totais da
// página do CRM e as etapas do Dataset (widget "crm"). Valores das linhas em reais;
// o Dataset trabalha em centavos.

import { CRM_TOTAL, type CrmDay } from "@/features/sync/crm";
import { addDays, diffDays } from "@/features/sync/dates";
import type { CrmStage } from "./source";

/** Linha do CRM como o dashboard lê (a mesma da sincronização). */
export type CrmRow = CrmDay;

export type CrmTotals = {
  leads: number;
  deals: number;
  /** Valor dos negócios criados no período. */
  value: number;
  won: number;
  wonValue: number;
  lost: number;
  /** Etapas abertas, na ordem do CRM, somadas entre contas. */
  stages: { stage: string; order: number; deals: number; value: number }[];
  /** Por dia do período, do mais antigo ao mais novo. */
  leadsSeries: number[];
  wonSeries: number[];
};

const inRange = (d: string, r: { from: string; to: string }) => d >= r.from && d <= r.to;

export function crmTotals(rows: readonly CrmRow[], range: { from: string; to: string }): CrmTotals {
  const days = Math.max(0, diffDays(range.from, range.to) + 1);
  const leadsSeries = new Array<number>(days).fill(0);
  const wonSeries = new Array<number>(days).fill(0);
  const out: CrmTotals = { leads: 0, deals: 0, value: 0, won: 0, wonValue: 0, lost: 0, stages: [], leadsSeries, wonSeries };
  const stages = new Map<string, CrmTotals["stages"][number]>();
  for (const r of rows) {
    if (!inRange(r.date, range)) continue;
    if (r.stage === CRM_TOTAL) {
      out.leads += r.leads;
      out.deals += r.deals;
      out.value += r.value;
      out.won += r.won;
      out.wonValue += r.wonValue;
      out.lost += r.lost;
      const i = diffDays(range.from, r.date);
      leadsSeries[i] += r.leads;
      wonSeries[i] += r.won;
      continue;
    }
    const s = stages.get(r.stage) ?? { stage: r.stage, order: r.stageOrder, deals: 0, value: 0 };
    s.deals += r.deals;
    s.value += r.value;
    s.order = Math.min(s.order, r.stageOrder);
    stages.set(r.stage, s);
  }
  out.stages = [...stages.values()].sort((a, b) => a.order - b.order || a.stage.localeCompare(b.stage));
  return out;
}

/** Datas do período (para os gráficos diários). */
export const crmDates = (range: { from: string; to: string }) => Array.from({ length: Math.max(0, diffDays(range.from, range.to) + 1) }, (_, i) => addDays(range.from, i));

/**
 * Etapas para o widget "crm" (funil do lead à venda): Leads, as etapas abertas na
 * ordem do CRM e Ganhos (com a receita). Valores em centavos. Sem dado nenhum, vazio.
 */
export function crmStagesForDataset(rows: readonly CrmRow[], range: { from: string; to: string } | undefined): CrmStage[] {
  if (!range || !rows.length) return [];
  const t = crmTotals(rows, range);
  if (!t.leads && !t.deals && !t.won) return [];
  const cents = (v: number) => Math.round(v * 100);
  return [
    { stage: "Leads", count: t.leads || t.deals, value: 0 },
    ...t.stages.map((s) => ({ stage: s.stage, count: s.deals, value: cents(s.value) })),
    { stage: "Ganhos", count: t.won, value: cents(t.wonValue) },
  ];
}
