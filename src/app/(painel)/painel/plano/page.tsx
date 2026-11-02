import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/workspace/PageSkeleton";
import { PlanPage } from "@/features/workspace/PlanPage";
import { hasRole } from "@/features/workspace/session";
import { requireWorkspace } from "@/server/auth/workspace";
import { getBillingOverview } from "@/server/billing/queries";
import { listAdAccounts } from "@/server/integrations/queries";

export const metadata: Metadata = { title: "Plano" };

export default function Page({ searchParams }: PageProps<"/painel/plano">) {
  return (
    <Suspense fallback={<PageSkeleton label="Carregando o plano" blocks={[40, 56, 64]} />}>
      <Plano searchParams={searchParams} />
    </Suspense>
  );
}

// Sem assinatura ativa a página ainda abre (é daqui que se assina de novo) e
// sem exigir o onboarding (ele mesmo exige plano).
async function Plano({ searchParams }: { searchParams: PageProps<"/painel/plano">["searchParams"] }) {
  const session = await requireWorkspace({ access: false, onboarding: false, next: "/painel/plano" });
  const [overview, accounts, query] = await Promise.all([hasRole(session.role, "admin") ? getBillingOverview() : null, listAdAccounts(), searchParams]);
  const usage = {
    billableAccounts: session.usage.billableAccounts,
    dashboards: session.usage.dashboards,
    publishedLandingPages: session.usage.publishedLandingPages,
    enabledPlatforms: [...new Set(accounts.filter((a) => a.isEnabled).map((a) => a.platformId))],
  };
  const unlock = query.liberar === "base" || query.liberar === "pro" || query.liberar === "avancado" ? query.liberar : null;
  return <PlanPage overview={overview} usage={usage} now={new Date().toISOString()} inactive={query.status === "inativo"} unlock={unlock} />;
}
