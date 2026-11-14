import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import type { PlatformId } from "@/features/accounts/platforms";
import { DashboardEditor } from "@/features/dashboards/editor/DashboardEditor";
import { canArrangeLayout } from "@/features/dashboards/layout/model";
import { datasetFromWarehouse } from "@/features/metrics/warehouse-dataset";
import { anyDashboardTemplate } from "@/features/templates/live";
import { hasRole } from "@/features/workspace/session";
import { loadTemplateWarehouse } from "@/server/analytics/queries";
import { requireWorkspace } from "@/server/auth/workspace";
import { getDashboard, listSourceOptions } from "@/server/dashboards/queries";

export const metadata: Metadata = { title: "Editar dashboard" };

export default function Page({ params }: PageProps<"/painel/dashboards/[id]/editar">) {
  return (
    <Suspense fallback={<div className="h-[70dvh] animate-pulse rounded-card bg-card motion-reduce:animate-none" aria-busy="true" aria-label="Carregando" />}>
      <Editar params={params} />
    </Suspense>
  );
}

async function Editar({ params }: { params: PageProps<"/painel/dashboards/[id]/editar">["params"] }) {
  await connection();
  const { id } = await params;
  const session = await requireWorkspace({ minRole: "member", next: `/painel/dashboards/${id}/editar` });
  const [dashboard, sources] = await Promise.all([getDashboard(id), listSourceOptions()]);
  if (!dashboard)
    return (
      <EmptyState
        title="Dashboard não encontrado"
        text="Ele pode ter sido apagado ou ser de outra organização."
        action={
          <Link href="/painel/dashboards" className={btn.small}>
            Ver meus dashboards
          </Link>
        }
      />
    );
  // a prévia usa os números das contas já ligadas (trocar as contas no editor mostra a amostra até salvar)
  const template = anyDashboardTemplate(dashboard.templateId);
  const { period, customDays } = dashboard.settings;
  const warehouse = template ? await loadTemplateWarehouse(dashboard.id, { platforms: template.sources, period, customDays }) : null;
  const realData =
    warehouse && template
      ? datasetFromWarehouse(
          warehouse.sets,
          { profile: template.profile, today: warehouse.today, current: warehouse.current, previous: warehouse.previous, goal: dashboard.settings.goal || undefined, margin: dashboard.settings.margin || undefined, budget: dashboard.settings.budget || undefined },
          warehouse.analytics,
        )
      : undefined;
  const ws = session.workspace;
  // o workspace (cliente) do dashboard com logo própria: a prévia usa a dele
  const project = dashboard.projectId ? session.projects?.find((p) => p.id === dashboard.projectId) : undefined;
  return (
    <DashboardEditor
      dashboard={dashboard}
      sources={sources}
      tier={session.access.tier ?? "base"}
      pagesTier={session.access.entitlements?.pages ?? "base"}
      whiteLabel={!!session.access.entitlements?.whiteLabel}
      canArrange={canArrangeLayout(session.access.tier)}
      workspaceBrand={{ color: ws.brandColor, logoUrl: ws.brandLogoUrl ?? null, hideVyz: !!ws.hideVyzBrand, canEdit: hasRole(session.role, "admin") }}
      clientLogo={project?.logoUrl ? { url: project.logoUrl, workspace: project.name, href: `/painel/workspaces/${project.id}/ajustes` } : null}
      preview={{
        realData,
        linkedPlatforms: warehouse ? ([...new Set(warehouse.accounts.map((a) => a.platform))] as PlatformId[]) : undefined,
        sourceExtras:
          warehouse && template?.composed && (warehouse.analytics.length || warehouse.organic.all)
            ? { current: warehouse.current, previous: warehouse.previous, currency: "BRL", analytics: warehouse.analytics, organic: warehouse.organic }
            : undefined,
      }}
    />
  );
}
