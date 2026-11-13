import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { WorkspaceHeader } from "@/features/projects/workspace/WorkspaceHeader";
import { requireWorkspace } from "@/server/auth/workspace";
import { getProjectSummary } from "@/server/projects/detail";

// A tela de um workspace: o cabeçalho com as abas vale para todas elas. Quem não acessa o
// workspace (ou ele não existe, ou foi arquivado) recebe 404.
export default function Layout({ children, params }: LayoutProps<"/painel/workspaces/[id]">) {
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ params, children }: { params: LayoutProps<"/painel/workspaces/[id]">["params"]; children: React.ReactNode }) {
  await connection();
  const { id } = await params;
  const session = await requireWorkspace({ next: `/painel/workspaces/${id}` });
  const summary = await getProjectSummary(id);
  if (!summary) notFound();
  return (
    <>
      <WorkspaceHeader summary={summary} orgName={session.workspace.name} />
      {children}
    </>
  );
}

function HeaderSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando o workspace">
      <div className="flex items-center gap-4">
        <div className="size-14 animate-pulse rounded-[16px] bg-surface-2 motion-reduce:animate-none" />
        <div className="space-y-2">
          <div className="h-7 w-56 animate-pulse rounded-control bg-surface-2 motion-reduce:animate-none" />
          <div className="h-4 w-72 animate-pulse rounded-control bg-surface-2 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="h-11 animate-pulse rounded-control bg-surface-2 motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-card bg-surface-2 motion-reduce:animate-none" />
    </div>
  );
}
