"use client";

// Com ?tour=1, imita a tela do dashboard no painel: a barra de foco (onde entram Editar,
// Compartilhar e Exportar), o mascote flutuante do "Pergunte ao VYZ" e o tour, que aqui
// não grava nada.

import type { PlatformId } from "@/features/accounts/platforms";
import { TooltipProvider } from "@/components/ui/Tooltip";
import { AgentFab } from "@/features/agent/AgentEntry";
import { AgentProvider } from "@/features/agent/AgentProvider";
import type { DashboardSpec } from "@/features/dashboards/DashboardBody";
import { SampleDashboard } from "@/features/dashboards/SampleDashboard";
import type { Dataset } from "@/features/metrics/source";
import { DashboardTour } from "@/features/onboarding/DashboardTour";
import type { PageId } from "@/features/templates/types";
import { FOCUS_ACTIONS_ID } from "@/features/workspace/focus";

export function RealHarness({ dashboard, dataset, linkedPlatforms, page, tour = false }: { dashboard: DashboardSpec & { id: string }; dataset: Dataset; linkedPlatforms: PlatformId[]; page?: string; tour?: boolean }) {
  const body = <SampleDashboard dashboard={dashboard} realData={dataset} linkedPlatforms={linkedPlatforms} initialPage={page as PageId | undefined} canEdit={tour} backHref={tour ? "/painel/dashboards" : undefined} />;
  if (!tour)
    return <div className="min-h-dvh bg-bg p-4 lg:p-8">{body}</div>;
  return (
    <TooltipProvider>
    <AgentProvider>
      <div className="shell-content min-h-dvh bg-[var(--panel)] md:h-dvh md:overflow-y-auto">
        <header className="focus-header sticky top-0 z-30 border-b border-line bg-[var(--panel)]">
          <div className="focus-bar flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <span className="text-[13.5px] text-fg-2">Dashboards</span>
            <div id={FOCUS_ACTIONS_ID} data-actions-slot className="flex min-w-10 flex-1 items-center justify-end" />
          </div>
        </header>
        <main className="focus-main px-4 pt-6 pb-28 sm:px-6">{body}</main>
      </div>
      <AgentFab />
      <DashboardTour onFinish={async () => ({ ok: true, data: undefined })} />
    </AgentProvider>
    </TooltipProvider>
  );
}
