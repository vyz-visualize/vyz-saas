// Página de Criativos nos dashboards de amostra: só nos modelos que usam a Meta
// (TikTok, YouTube e só Google mantêm o widget do modelo). Roda no servidor e passa
// pelo mesmo corte por plano dos dashboards com dados reais. Os anúncios são
// escalados para fechar com os cards do modelo (scale.ts).

import { datasetFor } from "@/features/dashboards/data";
import { currentTotals } from "@/features/metrics/compute";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { periodDays, type DashboardSettings, type PeriodId } from "@/features/workspace/types";
import { aggregateDashboard, redactSpend } from "../aggregate";
import { sampleRows } from "../preview";
import type { CreativesData, MetaView } from "../types";
import { cutCreatives, type CreativesAccess } from "./access";
import { scaleAdRows } from "./scale";

export const usesCreativesPage = (t: Pick<DashboardTemplate, "sources" | "dataMode">, pages: readonly PageId[]) => t.dataMode !== "live" && t.sources.includes("meta") && pages.includes("criativos");

export type SampleSpec = { name: string; client: string; settings: DashboardSettings };

export function sampleCreatives(t: DashboardTemplate, spec: SampleSpec, pages: readonly PageId[], access: CreativesAccess, opts: { period: PeriodId; customDays: number; hideSpend?: boolean; today?: string }): CreativesData | undefined {
  if (!usesCreativesPage(t, pages)) return undefined;
  // o mesmo conjunto que os cards usam: nome, cliente, modelo e dias do período
  const ds = datasetFor({ templateId: t.id, name: spec.name, client: spec.client, settings: spec.settings }, periodDays({ period: opts.period, customDays: opts.customDays }));
  const cur = currentTotals(ds);
  const rows = scaleAdRows(sampleRows("meta", { period: opts.period, customDays: opts.customDays, today: opts.today }), cur);
  const aggregated = aggregateDashboard(rows, { breakEvenRoas: ds.breakEven }) as MetaView;
  const view = opts.hideSpend ? redactSpend(aggregated) : aggregated;
  const creatives = cutCreatives(view, access, { hideSpend: !!opts.hideSpend, currency: "BRL" }).creatives;
  if (!creatives || cur.revenue > 0) return creatives;
  // modelo sem receita (ex.: geração de leads): sem valor de conversão nem ROAS por anúncio
  return {
    ...creatives,
    gallery: creatives.gallery.map((c) => ({ ...c, roas: null })),
    compare: creatives.compare.map((a) => ({ ...a, days: a.days.map((d) => ({ ...d, conversionValue: null as unknown as number })) })),
  };
}
