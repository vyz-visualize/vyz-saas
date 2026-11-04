// Dashboard com dados reais (Meta Ads · E-commerce, Google Ads · E-commerce).
// Server Component: confere o acesso e lê o armazém (src/server/analytics),
// depois entrega tudo pronto ao componente cliente. Trocar de aba não consulta
// de novo; trocar o período é navegação (quem monta passa o período novo).
//
// Monte dentro de <Suspense fallback={<LiveDashboardSkeleton />}> (lê cookies).

import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import type { PageId } from "@/features/templates/types";
import type { PeriodId } from "@/features/workspace/types";
import { loadLiveDashboard } from "@/server/analytics/queries";
import { saveDashboardMetricPrefs } from "@/server/dashboards/actions";
import { AppError } from "@/server/supabase/errors";
import type { DB } from "@/server/supabase/server";
import type { CreativesAccess } from "./creatives/access";
import type { DashFilters } from "./filters";
import { FilterableLiveDashboard } from "./FilterableLiveDashboard";
import { LiveDashboardError } from "./LiveDashboardView";
import type { LiveDashboardData } from "./types";

export type LiveDashboardProps = {
  /** dashboards.id (uuid). Precisa ser visível pelo RLS de quem pede (ou pelo `db` passado). */
  dashboardId: string;
  /** Período: "7d" | "30d" | "mes" | "custom" (sempre terminando ontem, no fuso da conta). */
  period: PeriodId;
  /** Dias do período personalizado (3 a 60; padrão 14). Ignorado nos outros períodos. */
  customDays?: number;
  /** Páginas do dashboard, na ordem (dashboard_pages). As que a plataforma não tem são ignoradas; vazio = todas. */
  pageIds: readonly PageId[];
  /** Esconde os valores de investimento (link compartilhado): saem do servidor já sem eles. */
  hideSpend?: boolean;
  /** Aba aberta no início (padrão: a primeira). */
  initialPage?: PageId;
  /** Botões no topo, à direita do título (editar, compartilhar, exportar). */
  actions?: ReactNode;
  /** Controles abaixo das abas (seletor de período, que navega com o período novo). */
  toolbar?: ReactNode;
  /** Logo à esquerda do título. */
  logo?: ReactNode;
  /** Página de Criativos: plano, aba e anúncios da URL. */
  creatives?: CreativesAccess;
  /** Métricas escolhidas neste dashboard (valem também no link e no PDF). */
  metricPrefs?: unknown;
  /** Mostra o botão "Personalizar". */
  canCustomize?: boolean;
  /** Dashboard interativo: os filtros da URL. Valem também no link compartilhado. */
  filters?: DashFilters;
  /** Cliente que confere o acesso. Padrão: sessão (RLS). Link público: admin, DEPOIS de validar o token. */
  db?: DB;
};

export async function LiveDashboard({ dashboardId, period, customDays, pageIds, hideSpend, initialPage, actions, toolbar, logo, metricPrefs, canCustomize, creatives, filters, db }: LiveDashboardProps) {
  let data: LiveDashboardData;
  try {
    data = await loadLiveDashboard(dashboardId, { period, customDays, hideSpend, db, creatives, filters });
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AppError) return <LiveDashboardError message={err.message} />;
    console.error("[analytics] falha ao carregar o dashboard", dashboardId, err);
    return <LiveDashboardError message="Tente de novo em alguns instantes. Se continuar, fale com o suporte." />;
  }
  return <FilterableLiveDashboard data={data} pageIds={pageIds} initialPage={initialPage} actions={actions} toolbar={toolbar} logo={logo} metricPrefs={metricPrefs} canCustomize={canCustomize} saveMetrics={canCustomize ? saveDashboardMetricPrefs : undefined} />;
}

export { LiveDashboardSkeleton } from "./ui";
