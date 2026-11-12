// Catálogo completo dos modelos de dashboard (os modelos novos: visual + objetivo).
// Todos leem as contas reais ligadas ao dashboard; sem conta, mostram a amostra.

import { IMPORT_PLATFORMS } from "@/features/accounts/connection-modes";
import { CRM_PLATFORMS } from "@/features/sync/crm";
import type { DashboardTemplate } from "./types";
import { COMPOSED_TEMPLATES } from "./dashboards/composed";

/** Todos os modelos (é o que o banco conhece: npm run db:catalog). */
export const ALL_DASHBOARD_TEMPLATES: DashboardTemplate[] = COMPOSED_TEMPLATES;

export function anyDashboardTemplate(id: string): DashboardTemplate | undefined {
  return ALL_DASHBOARD_TEMPLATES.find((t) => t.id === id);
}

/** Plataformas que os modelos leem das contas reais (as outras ficam na amostra). */
export const REAL_DATA_PLATFORMS: readonly string[] = ["meta", "google", "ga4", "instagram", "facebook", ...IMPORT_PLATFORMS, ...CRM_PLATFORMS];

/** O modelo deixa escolher contas (todos os modelos novos usam Meta, Google, GA4 ou orgânico). */
export const usesAccounts = (t: Pick<DashboardTemplate, "sources">) => t.sources.some((s) => (REAL_DATA_PLATFORMS as readonly string[]).includes(s));
