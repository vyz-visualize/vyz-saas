// CRM no formato do armazém: o que a sincronização grava em crm_daily.
// Vale para o gerador simulado e para as APIs do RD Station CRM, HubSpot, Pipedrive e Kommo.
//
// Convenções: datas "YYYY-MM-DD" no fuso da conta; uma linha por dia e etapa.
// A etapa TOTAL ("*") guarda o dia: leads novos, negócios criados, ganhos e perdidos
// (pela data de fechamento) e a receita ganha. As outras etapas guardam os negócios
// criados no dia que estão abertos nelas hoje, e o valor deles.

import { localDate } from "./dates";

export const CRM_PLATFORMS = ["rdstation", "hubspot", "pipedrive", "kommo"] as const;
export type CrmPlatform = (typeof CRM_PLATFORMS)[number];
export const isCrmSyncPlatform = (value: unknown): value is CrmPlatform => (CRM_PLATFORMS as readonly unknown[]).includes(value);

/** Etapa que guarda o total do dia. */
export const CRM_TOTAL = "*";

export type CrmDay = {
  date: string;
  stage: string;
  /** Ordem da etapa no funil do CRM (0 no total). */
  stageOrder: number;
  deals: number;
  /** Valor dos negócios, na moeda da conta. */
  value: number;
  won: number;
  wonValue: number;
  lost: number;
  leads: number;
};

export type CrmDataset = {
  platform: CrmPlatform;
  accountExternalId: string;
  range: { from: string; to: string };
  daily: CrmDay[];
};

/** Linha para o banco (snake_case), sem os ids internos. */
export const crmDayRow = (d: CrmDay) => ({
  date: d.date,
  stage: d.stage.trim().slice(0, 120) || "(sem etapa)",
  stage_order: Math.round(Number.isFinite(d.stageOrder) ? d.stageOrder : 0),
  deals: Math.max(0, Math.round(d.deals)),
  value: Math.max(0, Math.round(d.value * 100) / 100),
  won: Math.max(0, Math.round(d.won)),
  won_value: Math.max(0, Math.round(d.wonValue * 100) / 100),
  lost: Math.max(0, Math.round(d.lost)),
  leads: Math.max(0, Math.round(d.leads)),
});

// ---- montagem a partir dos registros do CRM --------------------------------------------------

export type CrmDealStatus = "open" | "won" | "lost";

/** Um negócio como vem de qualquer CRM, já normalizado. Datas como instantes (Date) ou null. */
export type CrmDealInput = {
  createdAt: Date | null;
  closedAt: Date | null;
  status: CrmDealStatus;
  stage: string;
  stageOrder: number;
  value: number;
};

const emptyDay = (date: string, stage: string, stageOrder: number): CrmDay => ({ date, stage, stageOrder, deals: 0, value: 0, won: 0, wonValue: 0, lost: 0, leads: 0 });

/**
 * Dias do CRM no intervalo: leads (contatos criados) e negócios (criados, e
 * ganhos ou perdidos pela data de fechamento) viram as linhas de crm_daily.
 * O que cai fora do intervalo fica de fora. Negócios repetidos (um fechado no
 * período que também foi criado nele) devem vir uma vez só.
 */
export function buildCrmDays(input: { range: { from: string; to: string }; timeZone: string; leads: readonly (Date | null)[]; deals: readonly CrmDealInput[] }): CrmDay[] {
  const { range, timeZone } = input;
  const day = (d: Date | null) => {
    if (!d || Number.isNaN(d.getTime())) return null;
    const iso = localDate(d, timeZone);
    return iso >= range.from && iso <= range.to ? iso : null;
  };
  const rows = new Map<string, CrmDay>();
  const at = (date: string, stage: string, order: number) => {
    const key = `${date}|${stage}`;
    let r = rows.get(key);
    if (!r) rows.set(key, (r = emptyDay(date, stage, order)));
    return r;
  };
  for (const l of input.leads) {
    const d = day(l);
    if (d) at(d, CRM_TOTAL, 0).leads += 1;
  }
  for (const deal of input.deals) {
    const value = Number.isFinite(deal.value) && deal.value > 0 ? deal.value : 0;
    const created = day(deal.createdAt);
    if (created) {
      const total = at(created, CRM_TOTAL, 0);
      total.deals += 1;
      total.value += value;
      if (deal.status === "open") {
        const s = at(created, deal.stage.trim().slice(0, 120) || "(sem etapa)", deal.stageOrder);
        s.deals += 1;
        s.value += value;
      }
    }
    if (deal.status !== "open") {
      const closed = day(deal.closedAt);
      if (!closed) continue;
      const total = at(closed, CRM_TOTAL, 0);
      if (deal.status === "won") {
        total.won += 1;
        total.wonValue += value;
      } else total.lost += 1;
    }
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date) || a.stageOrder - b.stageOrder || a.stage.localeCompare(b.stage));
}

/** Número de um campo que pode vir como texto ("1500.50"), número ou nulo. */
export const crmNumber = (v: unknown) => {
  const x = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(x) ? x : 0;
};

/** Instante de um campo de data: ISO, "YYYY-MM-DD HH:MM:SS" (UTC) ou segundos/milissegundos Unix. */
export function crmInstant(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v);
  if (typeof v !== "string") return null;
  const s = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(v) ? `${v.replace(" ", "T")}Z` : /^\d+$/.test(v) ? Number(v) : v;
  const d = new Date(typeof s === "number" ? (s < 1e12 ? s * 1000 : s) : s);
  return Number.isNaN(d.getTime()) ? null : d;
}
