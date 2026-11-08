import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/features/workspace/AppShell";
import { WorkspaceProvider } from "@/features/workspace/WorkspaceProvider";
import { SHOW_LANDING_PAGES } from "@/lib/flags";
import { requireWorkspace } from "@/server/auth/workspace";
import { isMockBilling } from "@/server/env";
import { isAdminEmail } from "@/server/admin/report";

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
  return (
    <WorkspaceProvider session={session}>
      <AppShell simulatedBilling={isMockBilling()} isAdmin={isAdminEmail(session.user.email)}>{children}</AppShell>
    </WorkspaceProvider>
  );
}

function ShellFallback() {
  return (
    <div className="min-h-dvh bg-[var(--sidebar)] md:flex md:h-dvh md:overflow-hidden" aria-busy="true">
      <div className="hidden h-dvh w-[260px] shrink-0 md:block" />
      <div className="min-h-dvh flex-1 bg-[var(--panel)] md:my-3 md:mr-3 md:h-[calc(100dvh-24px)] md:min-h-0 md:rounded-[24px]">
        <div className="mx-auto max-w-[1280px] space-y-4 px-4 pt-20 sm:px-6">
          <div className="h-8 w-56 animate-pulse rounded-control bg-card" />
          <div className="h-40 animate-pulse rounded-card bg-card" />
        </div>
      </div>
    </div>
  );
}
