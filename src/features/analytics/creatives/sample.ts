// Página de Criativos nos dashboards de amostra: só nos modelos que usam a Meta
// (TikTok, YouTube e só Google mantêm o widget do modelo). Roda no servidor e passa
// pelo mesmo corte por plano dos dashboards com dados reais. Os anúncios são
// escalados para fechar com o modelo (scale.ts): com a parte da Meta nos modelos
// com outras plataformas de anúncios, e com os cards nos que só têm Meta.

import { datasetFor } from "@/features/dashboards/data";
import { byPlatform, currentTotals } from "@/features/metrics/compute";
import type { Dataset } from "@/features/metrics/source";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { periodDays, type DashboardSettings, type PeriodId } from "@/features/workspace/types";
import { aggregateDashboard, redactSpend } from "../aggregate";
import { sampleRows } from "../preview";
import type { CreativesData, MetaView } from "../types";
import { cutCreatives, type CreativesAccess } from "./access";
import { scaleAdRows, type ModelTotals } from "./scale";

export const usesCreativesPage = (t: Pick<DashboardTemplate, "sources" | "dataMode">, pages: readonly PageId[]) => t.dataMode !== "live" && t.sources.includes("meta") && pages.includes("criativos");

export type SampleSpec = { name: string; client: string; settings: DashboardSettings };

/**
 * O que os anúncios da Meta precisam somar. Só Meta: os totais dos cards. Com outras
 * plataformas: a parte da Meta, a mesma do "Meta 1.574" do card. O modelo não divide
 * receita por plataforma: ela vai na proporção das compras que cada uma atribuiu.
 */
export function metaTotals(ds: Dataset): ModelTotals {
  const cur = currentTotals(ds);
  const parts = byPlatform(ds);
  const meta = parts.find((p) => p.id === "meta");
  if (parts.length <= 1 || !meta) return cur;
  const attributed = parts.reduce((total, p) => total + p.conv, 0);
  return { spend: meta.spend, impressions: meta.impressions, clicks: meta.clicks, conversions: meta.conv, revenue: attributed > 0 ? (cur.revenue * meta.conv) / attributed : 0, frequency: cur.frequency };
}

export function sampleCreatives(t: DashboardTemplate, spec: SampleSpec, pages: readonly PageId[], access: CreativesAccess, opts: { period: PeriodId; customDays: number; hideSpend?: boolean; today?: string }): CreativesData | undefined {
  if (!usesCreativesPage(t, pages)) return undefined;
  // o mesmo conjunto que os cards usam: nome, cliente, modelo e dias do período
  const ds = datasetFor({ templateId: t.id, name: spec.name, client: spec.client, settings: spec.settings }, periodDays({ period: opts.period, customDays: opts.customDays }));
  const cur = currentTotals(ds);
  const rows = scaleAdRows(sampleRows("meta", { period: opts.period, customDays: opts.customDays, today: opts.today }), metaTotals(ds));
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
