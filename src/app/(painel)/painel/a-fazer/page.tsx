import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { TodoPage } from "@/features/todo/TodoPage";
import { requireWorkspace } from "@/server/auth/workspace";
import { getTodoState } from "@/server/todo/queries";

export const metadata: Metadata = { title: "A Fazer" };

export default function Page() {
  return (
    <Suspense fallback={<TodoSkeleton />}>
      <AFazer />
    </Suspense>
  );
}

async function AFazer() {
  await connection();
  await requireWorkspace({ next: "/painel/a-fazer" });
  return <TodoPage state={await getTodoState()} />;
}

function TodoSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando as tarefas">
      <div className="h-10 w-72 max-w-full animate-pulse rounded-control bg-card motion-reduce:animate-none" />
      <div className="h-14 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
    </div>
  );
}
