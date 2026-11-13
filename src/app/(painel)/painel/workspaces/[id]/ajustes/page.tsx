import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { WorkspaceSettings } from "@/features/projects/workspace/WorkspaceSettings";
import { PageSkeleton } from "@/features/workspace/PageSkeleton";
import { requireWorkspace } from "@/server/auth/workspace";
import { getProjectSummary } from "@/server/projects/detail";

export const metadata: Metadata = { title: "Ajustes do workspace" };

export default function Page({ params }: PageProps<"/painel/workspaces/[id]/ajustes">) {
  return (
    <Suspense fallback={<PageSkeleton label="Carregando os ajustes" blocks={[30, 24]} />}>
      <View params={params} />
    </Suspense>
  );
}

async function View({ params }: Pick<PageProps<"/painel/workspaces/[id]/ajustes">, "params">) {
  await connection();
  const { id } = await params;
  const session = await requireWorkspace({ next: `/painel/workspaces/${id}/ajustes` });
  const summary = await getProjectSummary(id);
  if (!summary) notFound();
  return <WorkspaceSettings summary={summary} timeZone={session.workspace.timezone || "America/Sao_Paulo"} />;
}
