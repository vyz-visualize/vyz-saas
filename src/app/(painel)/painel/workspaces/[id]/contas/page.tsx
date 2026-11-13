import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { WorkspaceAccounts } from "@/features/projects/workspace/WorkspaceAccounts";
import { PageSkeleton } from "@/features/workspace/PageSkeleton";
import { requireWorkspace } from "@/server/auth/workspace";
import { getProjectAccounts, getProjectSummary } from "@/server/projects/detail";

export const metadata: Metadata = { title: "Contas do workspace" };

export default function Page({ params }: PageProps<"/painel/workspaces/[id]/contas">) {
  return (
    <Suspense fallback={<PageSkeleton label="Carregando as contas" blocks={[16, 44, 32]} />}>
      <View params={params} />
    </Suspense>
  );
}

async function View({ params }: Pick<PageProps<"/painel/workspaces/[id]/contas">, "params">) {
  await connection();
  const { id } = await params;
  await requireWorkspace({ next: `/painel/workspaces/${id}/contas` });
  const [summary, data] = await Promise.all([getProjectSummary(id), getProjectAccounts(id)]);
  if (!summary) notFound();
  return <WorkspaceAccounts data={data} projectId={id} projectName={summary.name} />;
}
