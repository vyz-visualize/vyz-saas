import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { DashboardsList } from "@/features/dashboards/DashboardsList";
import { TIER_LABEL } from "@/features/pricing/entitlements";
import { hasRole } from "@/features/workspace/session";
import { requireWorkspace } from "@/server/auth/workspace";
import { listDashboards, listSourceOptions } from "@/server/dashboards/queries";

export const metadata: Metadata = { title: "Dashboards" };

export default function Page({ searchParams }: PageProps<"/painel/dashboards">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Lista searchParams={searchParams} />
    </Suspense>
  );
}

// Sessão e banco são dados da requisição: dentro do Suspense.
async function Lista({ searchParams }: Pick<PageProps<"/painel/dashboards">, "searchParams">) {
  await connection();
  const session = await requireWorkspace({ next: "/painel/dashboards" });
  const [items, sources, query] = await Promise.all([listDashboards(), listSourceOptions(), searchParams]);
  const tier = session.access.tier ?? "base";
  return (
    <DashboardsList
      items={items}
      limit={session.access.entitlements?.maxDashboards ?? 0}
      planLabel={TIER_LABEL[tier]}
      canEdit={hasRole(session.role, "member")}
      sources={sources}
      tier={tier}
      pagesTier={session.access.entitlements?.pages ?? "base"}
      openNew={query.novo === "1"}
    />
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando os dashboards">
      <div className="h-16 w-72 max-w-full animate-pulse rounded-control bg-card motion-reduce:animate-none" />
      <div className="h-16 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
