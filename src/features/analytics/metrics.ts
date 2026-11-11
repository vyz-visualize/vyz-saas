// Ponte entre os KPIs dos dashboards live e as métricas do assistente VYZ:
// o card ganha data-vyz-metric e o contexto do assistente lista os mesmos
// ids, para o "Mostrar no painel" achar o card. Só entram KPIs com a mesma
// conta do armazém (CTR do link e frequência média ficam de fora).

import type { MetricId } from "@/features/metrics/definitions";
import type { LivePlatform } from "./types";

const BY_PLATFORM: Record<LivePlatform, Partial<Record<string, MetricId>>> = {
  meta: { spend: "spend", revenue: "revenue", roas: "roas", purchases: "conversions", cpa: "cpa", ticket: "ticket", cpm: "cpm" },
  google: { spend: "spend", value: "revenue", roas: "roas", conversions: "conversions", cpa: "cpa", ctr: "ctr", cpc: "cpc" },
  import: { spend: "spend", value: "revenue", roas: "roas", conversions: "conversions", cpa: "cpa", ctr: "ctr", cpc: "cpc", cpm: "cpm" },
};

/** Métrica do assistente que corresponde a um KPI live (undefined = sem par). */
export const kpiMetric = (platform: LivePlatform, kpiId: string): MetricId | undefined => BY_PLATFORM[platform][kpiId];

/** Métricas que os cards de KPI live de uma plataforma marcam. */
export const liveKpiMetrics = (platform: LivePlatform): MetricId[] => Object.values(BY_PLATFORM[platform]).filter((m): m is MetricId => !!m);
