import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProjectsPage } from "@/features/projects/ProjectsPage";
import { requireWorkspace } from "@/server/auth/workspace";
import { getProjectsState } from "@/server/projects/queries";

export const metadata: Metadata = { title: "Workspaces" };

export default function Page({ searchParams }: PageProps<"/painel/workspaces">) {
  return (
    <Suspense fallback={<ProjectsSkeleton />}>
      <Workspaces searchParams={searchParams} />
    </Suspense>
  );
}

async function Workspaces({ searchParams }: Pick<PageProps<"/painel/workspaces">, "searchParams">) {
  await connection();
  await requireWorkspace({ next: "/painel/workspaces" });
  const [state, query] = await Promise.all([getProjectsState(), searchParams]);
  return <ProjectsPage state={state} openNew={query.novo === "1"} />;
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando os workspaces">
      <div className="h-10 w-72 max-w-full animate-pulse rounded-control bg-card motion-reduce:animate-none" />
      <div className="h-20 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-36 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
        <div className="h-36 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
      </div>
    </div>
  );
}
