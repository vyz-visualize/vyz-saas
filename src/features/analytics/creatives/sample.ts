// Página de Criativos nos dashboards de amostra: só nos modelos que usam a Meta
// (TikTok, YouTube e só Google mantêm o widget do modelo). Roda no servidor e passa
// pelo mesmo corte por plano dos dashboards com dados reais.

import type { DashboardTemplate, PageId } from "@/features/templates/types";
import type { PeriodId } from "@/features/workspace/types";
import { redactSpend } from "../aggregate";
import { sampleDashboardData } from "../preview";
import type { CreativesData, MetaView } from "../types";
import { cutCreatives, type CreativesAccess } from "./access";

export const usesCreativesPage = (t: Pick<DashboardTemplate, "sources" | "dataMode">, pages: readonly PageId[]) => t.dataMode !== "live" && t.sources.includes("meta") && pages.includes("criativos");

export function sampleCreatives(t: DashboardTemplate, pages: readonly PageId[], access: CreativesAccess, opts: { period: PeriodId; customDays: number; hideSpend?: boolean }): CreativesData | undefined {
  if (!usesCreativesPage(t, pages)) return undefined;
  const data = sampleDashboardData("meta-ecommerce", { period: opts.period, customDays: opts.customDays });
  if (!data) return undefined;
  const view = opts.hideSpend ? redactSpend(data.view as MetaView) : (data.view as MetaView);
  return cutCreatives(view, access, { hideSpend: !!opts.hideSpend, currency: data.currency }).creatives;
}
