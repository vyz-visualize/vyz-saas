// Rascunho do dashboard, igual no "Novo dashboard" (NewDashboardFlow) e no editor
// (editor/DashboardEditor): o que vem do banco, o que vai para o servidor e os
// conversores dos campos em reais.

import type { PageId } from "@/features/templates/types";
import type { DashboardDetail } from "./model";
import type { DashboardFields } from "./schema";

/** Campos comuns aos dois rascunhos (sem as metas por métrica, que só o editor tem). */
export type DraftBase = Omit<DashboardFields, "pages" | "metricGoals"> & { pages: PageId[] };

/** Centavos → texto em reais, sem centavos ("" quando zero). */
export const reais = (cents: number) => (cents ? String(Math.round(cents / 100)) : "");
/** Texto em reais ("1.500,50") → centavos. */
export const toCents = (v: string) => Math.round((Number(v.replace(/\./g, "").replace(",", ".")) || 0) * 100);
/** ROAS de equilíbrio (1 ÷ margem), com vírgula. */
export const breakEvenRoas = (margin: number) => (1 / margin).toFixed(1).replace(".", ",");

/** O rascunho a partir do dashboard salvo. */
export function draftBaseFrom(d: DashboardDetail): DraftBase {
  return {
    name: d.name,
    client: d.client,
    goal: d.settings.goal,
    budget: d.settings.budget,
    margin: d.margin,
    period: d.settings.period,
    customDays: d.settings.customDays,
    attribution: d.settings.attribution,
    pages: d.pages,
    accountIds: d.sources.map((s) => s.id),
    brandColor: d.brand?.color || null,
    hideVyz: !!d.brand?.hideVyz,
  };
}

/** O que vai para createDashboard / updateDashboard. Sem marca própria, cor e "ocultar VYZ" não vão. */
export function fieldsFromDraft(draft: DraftBase, opts: { fallbackName: string; pickAccounts: boolean; whiteLabel: boolean }): Omit<DashboardFields, "metricGoals"> {
  return {
    name: draft.name.trim() || opts.fallbackName,
    client: draft.client.trim(),
    goal: draft.goal,
    budget: draft.budget,
    margin: draft.margin,
    period: draft.period,
    customDays: draft.customDays,
    attribution: draft.attribution,
    pages: draft.pages,
    accountIds: opts.pickAccounts ? draft.accountIds : [],
    brandColor: opts.whiteLabel ? draft.brandColor : null,
    hideVyz: opts.whiteLabel ? draft.hideVyz : false,
  };
}
