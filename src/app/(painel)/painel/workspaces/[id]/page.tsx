import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Highlights, HighlightsSkeleton, Overview } from "@/features/projects/workspace/Overview";
import { PageSkeleton } from "@/features/workspace/PageSkeleton";
import { requireWorkspace } from "@/server/auth/workspace";
import { getProjectHighlights, getProjectOverview, getProjectSummary } from "@/server/projects/detail";

export const metadata: Metadata = { title: "Workspace" };

export default function Page({ params }: PageProps<"/painel/workspaces/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton label="Carregando a visão geral" blocks={[30, 28, 60]} />}>
      <View params={params} />
    </Suspense>
  );
}

async function View({ params }: Pick<PageProps<"/painel/workspaces/[id]">, "params">) {
  await connection();
  const { id } = await params;
  await requireWorkspace({ next: `/painel/workspaces/${id}` });
  const [summary, overview] = await Promise.all([getProjectSummary(id), getProjectOverview(id)]);
  if (!summary) notFound();
  return (
    <Overview
      summary={summary}
      overview={overview}
      highlights={
        // os destaques leem os dashboards com dados reais: chegam depois, sem segurar a página
        <Suspense fallback={<HighlightsSkeleton />}>
          <HighlightsLoader id={id} />
        </Suspense>
      }
    />
  );
}

async function HighlightsLoader({ id }: { id: string }) {
  return <Highlights data={await getProjectHighlights(id)} projectId={id} />;
}
