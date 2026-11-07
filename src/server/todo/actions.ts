"use server";

// Ações do A Fazer (Server Actions): criar, editar, apagar, marcar como vista,
// grupos e roteiros. Responsáveis, cronograma, grupos e roteiros são do plano
// completo (Avançado e Personalizado).

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { availableIn } from "@/features/pricing/entitlements";
import { PLAYBOOKS, playbookTasks, todayIn } from "@/features/todo/logic";
import type { TaskDTO } from "@/features/todo/types";
import { authorize } from "@/server/auth/workspace";
import { appError, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";
import { createTaskRow, updateTaskRow } from "./mutations";
import { todoLevel } from "./queries";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    refresh();
    return { ok: true, data };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

export async function createTask(input: unknown): Promise<ActionResult<TaskDTO>> {
  return run(async () => {
    const session = await authorize("member");
    return createTaskRow(await createServerSupabase(), session.workspace.id, session.user.id, input, todoLevel(session));
  });
}

export async function updateTask(taskId: string, patch: unknown): Promise<ActionResult<TaskDTO>> {
  return run(async () => {
    const session = await authorize("member");
    return updateTaskRow(await createServerSupabase(), session.workspace.id, taskId, patch, todoLevel(session));
  });
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  return run(async () => {
    if (!z.uuid().safeParse(taskId).success) throw appError("task:not_found", "Tarefa não encontrada.");
    const session = await authorize("member");
    const db = await createServerSupabase();
    const rows = unwrap(await db.from("tasks").delete().eq("id", taskId).eq("workspace_id", session.workspace.id).select("id"));
    if (!rows?.length) throw appError("task:not_found", "Tarefa não encontrada.");
    return undefined;
  });
}

/** Tira o selo "Novo" das tarefas abertas na tela (sem contar como edição). */
export async function markTasksSeen(ids: string[]): Promise<ActionResult> {
  try {
    const clean = z.array(z.uuid()).max(200).parse(ids);
    if (!clean.length) return { ok: true, data: undefined };
    const session = await authorize("viewer", { access: false });
    if (session.role === "viewer") return { ok: true, data: undefined };
    const db = await createServerSupabase();
    unwrap(await db.from("tasks").update({ seen_at: new Date().toISOString() }).eq("workspace_id", session.workspace.id).in("id", clean).is("seen_at", null));
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

const GroupName = z.string().trim().min(1, "Dê um nome ao grupo.").max(80, "Até 80 caracteres.");

export async function createTaskGroup(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  return run(async () => {
    const session = await authorize("member");
    if (todoLevel(session) !== "full") throw appError("forbidden", availableIn("avancado"));
    const r = GroupName.safeParse(name);
    if (!r.success) throw appError("validation", r.error.issues[0].message, { name: r.error.issues[0].message });
    const db = await createServerSupabase();
    return unwrap(await db.from("task_groups").insert({ workspace_id: session.workspace.id, name: r.data, created_by: session.user.id }).select("id, name").single())!;
  });
}

/** Aplica um roteiro pronto: cria um grupo com o nome dele e as tarefas com início e prazo. */
export async function applyPlaybook(playbookId: string, input: { start?: string; projectId?: string | null }): Promise<ActionResult<{ created: number; groupId: string }>> {
  return run(async () => {
    const session = await authorize("member");
    if (todoLevel(session) !== "full") throw appError("forbidden", availableIn("avancado"));
    const playbook = PLAYBOOKS.find((p) => p.id === playbookId);
    if (!playbook) throw appError("validation", "Roteiro não encontrado.");
    const start = z.iso.date().safeParse(input.start).success ? input.start! : todayIn(session.workspace.timezone || "America/Sao_Paulo");
    const projectId = input.projectId && z.uuid().safeParse(input.projectId).success ? input.projectId : null;
    const db = await createServerSupabase();
    const ws = session.workspace.id;
    let groupName = playbook.name;
    if (projectId) {
      const p = unwrap(await db.from("projects").select("name").eq("id", projectId).eq("workspace_id", ws).maybeSingle());
      if (p) groupName = `${playbook.name} · ${p.name}`.slice(0, 80);
    }
    const group = unwrap(await db.from("task_groups").insert({ workspace_id: ws, name: groupName, created_by: session.user.id }).select("id").single())!;
    const now = new Date().toISOString();
    const rows = playbookTasks(playbook, start).map((t) => ({
      workspace_id: ws,
      project_id: projectId,
      group_id: group.id,
      title: t.title,
      stage: t.stage,
      priority: t.priority,
      start_date: t.startDate,
      due_date: t.dueDate,
      source: "playbook",
      created_by: session.user.id,
      seen_at: now,
    }));
    unwrap(await db.from("tasks").insert(rows).select("id"));
    return { created: rows.length, groupId: group.id };
  });
}
