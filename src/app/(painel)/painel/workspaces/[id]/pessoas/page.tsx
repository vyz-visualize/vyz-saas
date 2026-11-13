import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { WorkspacePeople } from "@/features/projects/workspace/WorkspacePeople";
import { PageSkeleton } from "@/features/workspace/PageSkeleton";
import { requireWorkspace } from "@/server/auth/workspace";
import { getProjectPeople, getProjectSummary } from "@/server/projects/detail";

export const metadata: Metadata = { title: "Pessoas do workspace" };

export default function Page({ params }: PageProps<"/painel/workspaces/[id]/pessoas">) {
  return (
    <Suspense fallback={<PageSkeleton label="Carregando as pessoas" blocks={[16, 48]} />}>
      <View params={params} />
    </Suspense>
  );
}

async function View({ params }: Pick<PageProps<"/painel/workspaces/[id]/pessoas">, "params">) {
  await connection();
  const { id } = await params;
  await requireWorkspace({ next: `/painel/workspaces/${id}/pessoas` });
  const [summary, data] = await Promise.all([getProjectSummary(id), getProjectPeople(id)]);
  if (!summary) notFound();
  return <WorkspacePeople data={data} projectId={id} projectName={summary.name} />;
}
