import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { parseCreativesQuery } from "@/features/analytics/creatives/query";
import { sampleCreatives } from "@/features/analytics/creatives/sample";
import { LiveDashboard, LiveDashboardSkeleton } from "@/features/analytics/LiveDashboard";
import { brandVars } from "@/features/dashboards/brand";
import { DashboardActions } from "@/features/dashboards/DashboardActions";
import { periodFromQuery } from "@/features/dashboards/model";
import { BrandMark } from "@/features/dashboards/DashboardBody";
import { PeriodNav } from "@/features/dashboards/PeriodNav";
import { SampleDashboard } from "@/features/dashboards/SampleDashboard";
import { anyDashboardTemplate } from "@/features/templates/live";
import { hasRole } from "@/features/workspace/session";
import { requireWorkspace } from "@/server/auth/workspace";
import { getDashboard } from "@/server/dashboards/queries";
import { logActivity } from "@/server/history/log";

export const metadata: Metadata = { title: "Dashboard" };

export default function Page({ params, searchParams }: PageProps<"/painel/dashboards/[id]">) {
  return (
    <Suspense fallback={<LiveDashboardSkeleton />}>
      <Ver params={params} searchParams={searchParams} />
    </Suspense>
  );
}

// Sessão, banco e ?periodo= são dados da requisição. Trocar o período navega
// (?periodo=…&dias=…) e o servidor desenha de novo; os números vêm do cache por conta.
async function Ver({ params, searchParams }: Pick<PageProps<"/painel/dashboards/[id]">, "params" | "searchParams">) {
  await connection();
  const { id } = await params;
  const session = await requireWorkspace({ next: `/painel/dashboards/${id}` });
  const [d, query] = await Promise.all([getDashboard(id), searchParams]);
  if (!d)
    return (
      <EmptyState
        title="Dashboard não encontrado"
        text="Ele pode ter sido apagado ou ser de outro workspace."
        action={
          <Link href="/painel/dashboards" className={btn.small}>
            Ver meus dashboards
          </Link>
        }
      />
    );

  const { period, customDays } = periodFromQuery(query, d.settings);
  await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "dashboard.viewed", entityType: "dashboard", entityId: d.id, metadata: { period, live: d.live } });
  const canEdit = hasRole(session.role, "member");
  const ws = session.workspace;
  const whiteLabel = !!session.access.entitlements?.whiteLabel;
  const color = whiteLabel ? d.brand?.color || ws.brandColor : null;
  const brand = whiteLabel ? { color: color ?? "", logo: ws.brandLogoUrl ?? undefined, hideVyz: ws.hideVyzBrand || !!d.brand?.hideVyz } : undefined;
  const q = parseCreativesQuery(query);
  const access = { tier: session.access.tier, tab: q.tab, ads: q.ads, upsell: true };
  const actions = canEdit ? <DashboardActions dashboard={{ id: d.id, name: d.name, live: d.live }} period={period} pages={d.pages.length} /> : undefined;

  if (d.live) {
    return (
      <div style={brandVars(color)}>
        <Suspense key={`${period}:${customDays}`} fallback={<LiveDashboardSkeleton />}>
          <LiveDashboard dashboardId={d.id} period={period} customDays={customDays} pageIds={d.pages} initialPage={q.page} creatives={access} metricPrefs={d.metricPrefs} canCustomize={canEdit} actions={actions} toolbar={<PeriodNav period={period} customDays={customDays} />} logo={<BrandMark brand={brand} />} />
        </Suspense>
      </div>
    );
  }

  const template = anyDashboardTemplate(d.templateId);
  return (
    <SampleDashboard
      dashboard={{ id: d.id, templateId: d.templateId, name: d.name, client: d.client, pages: d.pages, settings: { ...d.settings, period, customDays }, metricPrefs: d.metricPrefs }}
      brand={brand}
      canEdit={canEdit}
      assemble={query.novo === "1"}
      initialPage={q.page}
      creatives={template ? sampleCreatives(template, { name: d.name, client: d.client, settings: d.settings }, d.pages, access, { period, customDays }) : undefined}
    />
  );
}
