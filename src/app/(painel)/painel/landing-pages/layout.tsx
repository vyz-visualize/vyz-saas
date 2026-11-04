import { Suspense } from "react";
import { LandingComingSoon } from "@/features/landing-pages/ComingSoon";
import { PageSkeleton } from "@/features/workspace/PageSkeleton";
import { landingPagesEnabledFor, SHOW_LANDING_PAGES } from "@/lib/flags";
import { requireWorkspace } from "@/server/auth/workspace";
import { isOnLandingWaitlist } from "@/server/landing-pages/queries";

/** Com a flag desligada, tudo em /painel/landing-pages/* vira a página "em breve", menos para quem já é do produto LP. */
export default function LandingPagesLayout({ children }: LayoutProps<"/painel/landing-pages">) {
  if (SHOW_LANDING_PAGES) return children;
  return (
    <Suspense fallback={<PageSkeleton label="Carregando" blocks={[22, 64, 40]} />}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

// Sessão e banco são dados da requisição: dentro do Suspense.
async function Gate({ children }: { children: React.ReactNode }) {
  const session = await requireWorkspace({ access: false, next: "/painel/landing-pages" });
  if (landingPagesEnabledFor(session.workspace.product)) return children;
  return <LandingComingSoon joined={await isOnLandingWaitlist(session)} />;
}
