import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { DashboardsList } from "@/features/dashboards/DashboardsList";
import { PageSkeleton } from "@/features/workspace/PageSkeleton";
import { requireWorkspace } from "@/server/auth/workspace";
import { getProjectDashboards, getProjectSummary } from "@/server/projects/detail";

export const metadata: Metadata = { title: "Dashboards do workspace" };

export default function Page({ params, searchParams }: PageProps<"/painel/workspaces/[id]/dashboards">) {
  return (
    <Suspense fallback={<PageSkeleton label="Carregando os dashboards" blocks={[16, 56]} />}>
      <View params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function View({ params, searchParams }: Pick<PageProps<"/painel/workspaces/[id]/dashboards">, "params" | "searchParams">) {
  await connection();
  const { id } = await params;
  await requireWorkspace({ next: `/painel/workspaces/${id}/dashboards` });
  const [summary, data, query] = await Promise.all([getProjectSummary(id), getProjectDashboards(id), searchParams]);
  if (!summary) notFound();
  return (
    <DashboardsList
      items={data.items}
      used={data.used}
      limit={data.limit}
      planLabel={data.planLabel}
      canEdit={data.canEdit}
      sources={data.sources}
      tier={data.tier}
      pagesTier={data.pagesTier}
      openNew={query.novo === "1"}
      hasProject
      brand={data.brand}
      workspaceName={summary.name}
    />
  );
}
