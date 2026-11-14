import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { NO_GUIDES, PANEL_TOUR_GUIDE, tourPending } from "@/features/onboarding/guides";
import { AppShell } from "@/features/workspace/AppShell";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceProvider";
import { SHOW_LANDING_PAGES } from "@/lib/flags";
import { requireWorkspace } from "@/server/auth/workspace";
import { isMockBilling } from "@/server/env";
import { isAdminEmail } from "@/server/admin/report";
import { getMyGuides } from "@/server/guides/queries";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s · Painel VYZ" },
  description: SHOW_LANDING_PAGES ? "Dashboards e landing pages para gestores de tráfego." : "Dashboards para gestores de tráfego.",
};

/** Área do painel: app shell próprio, sem Lenis, intro nem motion pesado. */
export default function PainelLayout({ children }: LayoutProps<"/painel">) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <PainelSession>{children}</PainelSession>
    </Suspense>
  );
}

// A sessão é dado da requisição: fica dentro do Suspense (Cache Components).
// Cada página confere o que precisa (assinatura ativa, papel); aqui só o
// mínimo: estar logado, ter workspace e, com assinatura ativa, ter concluído
// o onboarding.
async function PainelSession({ children }: { children: React.ReactNode }) {
  const session = await requireWorkspace({ access: false, onboarding: false, next: "/painel" });
  if (session.access.hasAccess && session.workspace.onboardingStep !== "done") redirect("/comecar");
  // tour do painel (onde fica cada coisa): uma vez por pessoa, depois do primeiro acesso, no Dash
  const guides = session.access.hasAccess && session.workspace.product === "dash" ? await getMyGuides(session.user.id) : NO_GUIDES;
  return (
    <WorkspaceProvider session={session}>
      <AppShell simulatedBilling={isMockBilling()} isAdmin={isAdminEmail(session.user.email)} tour={tourPending(guides, PANEL_TOUR_GUIDE)}>
        {children}
      </AppShell>
    </WorkspaceProvider>
  );
}

function ShellFallback() {
  return (
    <div data-ui="app" className="min-h-dvh bg-bg md:flex md:h-dvh md:overflow-hidden md:bg-[var(--frame)]" aria-busy="true">
      <div className="hidden h-dvh w-[252px] shrink-0 sb-closed:w-[76px] md:block" />
      <div className="min-h-dvh flex-1 bg-bg md:my-2 md:mr-2 md:h-[calc(100dvh-16px)] md:min-h-0 md:rounded-[20px]">
        <div className="space-y-4 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8 2xl:px-10">
          <div className="h-8 w-56 animate-pulse rounded-control bg-surface-2 motion-reduce:animate-none" />
          <div className="h-40 animate-pulse rounded-card bg-surface-2 motion-reduce:animate-none" />
        </div>
      </div>
    </div>
  );
}
