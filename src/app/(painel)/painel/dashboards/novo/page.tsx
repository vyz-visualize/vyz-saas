import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/kit";
import { NewDashboardFlow } from "@/features/dashboards/NewDashboardFlow";
import { requireWorkspace } from "@/server/auth/workspace";
import { listDashboards, listSourceOptions } from "@/server/dashboards/queries";

export const metadata: Metadata = { title: "Novo dashboard" };

export default function Page({ searchParams }: PageProps<"/painel/dashboards/novo">) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Dashboards" title="Novo dashboard" />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-card bg-card motion-reduce:animate-none" aria-busy="true" aria-label="Carregando" />}>
        <Novo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Criar é de member para cima (viewer vê 404); contas e uso vêm do banco.
async function Novo({ searchParams }: { searchParams: PageProps<"/painel/dashboards/novo">["searchParams"] }) {
  await connection();
  const session = await requireWorkspace({ minRole: "member", next: "/painel/dashboards/novo" });
  const [sources, dashboards, query] = await Promise.all([listSourceOptions(), listDashboards(), searchParams]);
  const template = typeof query.template === "string" ? query.template : null;
  return (
    <NewDashboardFlow
      sources={sources}
      tier={session.access.tier ?? "base"}
      pagesTier={session.access.entitlements?.pages ?? "base"}
      whiteLabel={!!session.access.entitlements?.whiteLabel}
      used={dashboards.length}
      limit={session.access.entitlements?.maxDashboards ?? 0}
      initialTemplate={template}
      voice={!!session.access.entitlements?.agentVoice}
    />
  );
}
