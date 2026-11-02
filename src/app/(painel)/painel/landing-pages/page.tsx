import type { Metadata } from "next";
import { Suspense } from "react";
import { LandingList } from "@/features/landing-pages/LandingList";
import { WelcomeModal } from "@/features/workspace/WelcomeModal";
import { hasRole } from "@/features/workspace/session";
import { requireWorkspace } from "@/server/auth/workspace";
import { listLandingPages } from "@/server/landing-pages/queries";

export const metadata: Metadata = { title: "Landing pages" };

export default function Page() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Lista />
    </Suspense>
  );
}

async function Lista() {
  const session = await requireWorkspace({ next: "/painel/landing-pages" });
  const pages = await listLandingPages();
  return (
    <>
      {session.workspace.product === "lp" && <WelcomeModal />}
      <LandingList
        pages={pages}
        published={pages.filter((p) => p.status === "published").length}
        limit={session.access.entitlements?.maxLandingPages ?? 0}
        canEdit={hasRole(session.role, "member")}
      />
    </>
  );
}

function ListSkeleton() {
  return (
    <div
      className="space-y-8"
      aria-busy="true"
      aria-label="Carregando as landing pages"
    >
      <div className="h-10 w-72 max-w-full animate-pulse rounded-control bg-card motion-reduce:animate-none" />
      <div className="h-16 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-64 animate-pulse rounded-card bg-card motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}
