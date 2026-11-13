import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SharePage } from "@/features/share/SharePage";
import { hasRole } from "@/features/workspace/session";
import { requireWorkspace } from "@/server/auth/workspace";
import { getShareCenter } from "@/server/share/queries";

export const metadata: Metadata = { title: "Compartilhar" };

export default function Page() {
  return (
    <Suspense fallback={<ShareSkeleton />}>
      <Compartilhar />
    </Suspense>
  );
}

function ShareSkeleton() {
  const block = "animate-pulse bg-surface-2 motion-reduce:animate-none";
  return (
    <div className="space-y-6 lg:space-y-8" aria-busy="true" aria-label="Carregando">
      <div className="space-y-3">
        <div className={`h-8 w-80 max-w-full rounded-control ${block}`} />
        <div className={`h-4 w-72 max-w-full rounded-control ${block}`} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-28 rounded-card ${block}`} />
        ))}
      </div>
      <div className={`h-11 w-72 max-w-full rounded-control ${block}`} />
      <div className={`h-64 rounded-card ${block}`} />
    </div>
  );
}

// connection(): a situação dos links (expirado ou não) depende da hora atual.
async function Compartilhar() {
  await connection();
  const session = await requireWorkspace({ next: "/painel/compartilhar" });
  const center = await getShareCenter();
  return <SharePage center={center} now={new Date().toISOString()} timeZone={session.workspace.timezone || "America/Sao_Paulo"} canEdit={hasRole(session.role, "member")} />;
}
