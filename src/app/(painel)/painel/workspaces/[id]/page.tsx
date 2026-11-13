import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProjectDetailPage } from "@/features/projects/ProjectDetailPage";
import { PageSkeleton } from "@/features/workspace/PageSkeleton";
import { requireWorkspace } from "@/server/auth/workspace";
import { getProjectDetail } from "@/server/projects/detail";

export const metadata: Metadata = { title: "Workspace" };

export default function Page({ params }: PageProps<"/painel/workspaces/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton label="Carregando o workspace" blocks={[24, 44, 60]} />}>
      <Workspace params={params} />
    </Suspense>
  );
}

// Quem não acessa este workspace (ou ele não existe) recebe 404.
async function Workspace({ params }: Pick<PageProps<"/painel/workspaces/[id]">, "params">) {
  await connection();
  const { id } = await params;
  await requireWorkspace({ next: `/painel/workspaces/${id}` });
  const detail = await getProjectDetail(id);
  if (!detail) notFound();
  return <ProjectDetailPage detail={detail} />;
}
