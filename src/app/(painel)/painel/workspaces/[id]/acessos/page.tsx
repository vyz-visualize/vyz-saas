import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { WorkspaceAccess } from "@/features/projects/workspace/WorkspaceAccess";
import { PageSkeleton } from "@/features/workspace/PageSkeleton";
import { requireWorkspace } from "@/server/auth/workspace";
import { getProjectClientActivity } from "@/server/projects/client-activity";
import { getProjectSummary } from "@/server/projects/detail";

export const metadata: Metadata = { title: "Acessos do cliente" };

export default function Page({ params }: PageProps<"/painel/workspaces/[id]/acessos">) {
  return (
    <Suspense fallback={<PageSkeleton label="Carregando os acessos" blocks={[24, 16, 48]} />}>
      <View params={params} />
    </Suspense>
  );
}

async function View({ params }: Pick<PageProps<"/painel/workspaces/[id]/acessos">, "params">) {
  await connection();
  const { id } = await params;
  await requireWorkspace({ next: `/painel/workspaces/${id}/acessos` });
  const summary = await getProjectSummary(id);
  if (!summary) notFound();
  const data = await getProjectClientActivity(id);
  return <WorkspaceAccess data={data} projectId={id} projectName={summary.name} />;
}
