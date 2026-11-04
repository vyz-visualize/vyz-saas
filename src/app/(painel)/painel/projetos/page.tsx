import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProjectsPage } from "@/features/projects/ProjectsPage";
import { requireWorkspace } from "@/server/auth/workspace";
import { getProjectsState } from "@/server/projects/queries";

export const metadata: Metadata = { title: "Projetos" };

export default function Page() {
  return (
    <Suspense fallback={<ProjectsSkeleton />}>
      <Projetos />
    </Suspense>
  );
}

async function Projetos() {
  await connection();
  await requireWorkspace({ next: "/painel/projetos" });
  return <ProjectsPage state={await getProjectsState()} />;
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando os projetos">
      <div className="h-10 w-72 max-w-full animate-pulse rounded-control bg-card motion-reduce:animate-none" />
      <div className="h-20 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-36 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
        <div className="h-36 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
      </div>
    </div>
  );
}
