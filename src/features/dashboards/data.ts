import type { MetricId } from "@/features/metrics/definitions";
import { MockSource, type Dataset } from "@/features/metrics/source";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { PAGES } from "@/features/templates/pages";
import type { DashboardTemplate, PageId, PageLayout } from "@/features/templates/types";
import type { DashboardSettings } from "@/features/workspace/types";
import { GOOGLE_CATALOG, META_CATALOG, sampleCatalog, type CatalogMetric, type MetricScope } from "./metric-prefs";

export const DEFAULT_SETTINGS: DashboardSettings = {
  goal: 0,
  margin: 0.4,
  budget: 0,
  period: "30d",
  customDays: 14,
  attribution: "7c1v",
  currency: "BRL",
};

type Spec = { templateId: string; name: string; client: string; settings?: Partial<DashboardSettings> };

/** Dados de amostra de um dashboard: o mesmo nome + cliente + template gera sempre os mesmos números. */
export function datasetFor(spec: Spec, days: number): Dataset {
  const t = dashboardTemplate(spec.templateId) as DashboardTemplate;
  const s = { ...DEFAULT_SETTINGS, ...spec.settings };
  return MockSource.load({
    seed: `${spec.name}|${spec.client}|${spec.templateId}`,
    profile: t.profile,
    sources: t.sources,
    days,
    goal: s.goal || undefined,
    margin: s.margin || undefined,
    budget: s.budget || undefined,
  });
}

export function pageLayout(t: DashboardTemplate, page: PageId): PageLayout {
  return PAGES[page].build({ profile: t.profile, sources: t.sources });
}

/** Cards padrão de um dashboard de exemplo: os de todas as páginas dele, sem repetir. */
export function sampleDefaultKpis(t: DashboardTemplate, pages: readonly PageId[]): MetricId[] {
  return [...new Set(pages.flatMap((p) => pageLayout(t, p).kpis.map((k) => k.metric)))];
}

/** Catálogo e chave de um dashboard: plataforma nos templates com dados reais, "sample" nos de exemplo. */
export function catalogForTemplate(t: DashboardTemplate, pages: readonly PageId[]): { scope: MetricScope; metrics: CatalogMetric[]; pageKpis?: MetricId[][] } {
  if (t.dataMode === "live") return t.sources.includes("google") ? { scope: "google", metrics: GOOGLE_CATALOG } : { scope: "meta", metrics: META_CATALOG };
  return { scope: "sample", metrics: sampleCatalog(t.profile, sampleDefaultKpis(t, pages)), pageKpis: pages.map((p) => pageLayout(t, p).kpis.map((k) => k.metric)) };
}
