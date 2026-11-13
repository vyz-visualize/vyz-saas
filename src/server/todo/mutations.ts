import "server-only";

// Gravação de tarefas, usada pelas Server Actions do painel e pela API do app.
// Valida a entrada, aplica a trava do plano (campos do plano completo) e
// marca edited_at: tarefa automática editada por alguém não fecha sozinha.

import { z } from "zod";
import { availableIn } from "@/features/pricing/entitlements";
import { TASK_PRIORITIES, TASK_STAGES, TASK_STATUSES, type TaskDTO } from "@/features/todo/types";
import { appError, unwrap } from "@/server/supabase/errors";
import type { DB } from "@/server/supabase/server";
import { TASK_COLUMNS, toTaskDTO } from "./queries";

const DateStr = z.iso.date();

export const TaskPatch = z
  .object({
    title: z.string().trim().min(1, "Dê um título à tarefa.").max(200, "Até 200 caracteres."),
    detail: z.string().trim().max(4000).nullable(),
    status: z.enum(TASK_STATUSES),
    stage: z.enum(TASK_STAGES),
    priority: z.enum(TASK_PRIORITIES),
    dueDate: DateStr.nullable(),
    startDate: DateStr.nullable(),
    assignees: z.array(z.uuid()).max(20),
    groupId: z.uuid().nullable(),
    projectId: z.uuid().nullable(),
  })
  .partial()
  .strict();
export type TaskPatchInput = z.infer<typeof TaskPatch>;

export const TaskCreate = TaskPatch.extend({ title: z.string().trim().min(1, "Dê um título à tarefa.").max(200, "Até 200 caracteres.") });
export type TaskCreateInput = z.infer<typeof TaskCreate>;

const FULL_ONLY = ["assignees", "startDate", "groupId"] as const;

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw appError("validation", issue?.message, issue?.path[0] ? { [String(issue.path[0])]: issue.message } : undefined);
  }
  return r.data;
}

function checkPlan(patch: TaskPatchInput, level: "basic" | "full") {
  if (level === "full") return;
  for (const k of FULL_ONLY) {
    const v = patch[k];
    if (v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)) throw appError("forbidden", availableIn("avancado"));
  }
}

async function checkAssignees(db: DB, workspaceId: string, ids: string[] | undefined) {
  if (!ids?.length) return;
  const rows = unwrap(await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).in("user_id", ids));
  if ((rows ?? []).length !== new Set(ids).size) throw appError("validation", "Responsável fora da organização.");
}

function toColumns(p: TaskPatchInput) {
  const cols: Record<string, unknown> = {};
  if (p.title !== undefined) cols.title = p.title;
  if (p.detail !== undefined) cols.detail = p.detail || null;
  if (p.status !== undefined) {
    cols.status = p.status;
    cols.completed_at = p.status === "concluido" || p.status === "cancelado" ? new Date().toISOString() : null;
  }
  if (p.stage !== undefined) cols.stage = p.stage;
  if (p.priority !== undefined) cols.priority = p.priority;
  if (p.dueDate !== undefined) cols.due_date = p.dueDate;
  if (p.startDate !== undefined) cols.start_date = p.startDate;
  if (p.assignees !== undefined) cols.assignees = [...new Set(p.assignees)];
  if (p.groupId !== undefined) cols.group_id = p.groupId;
  if (p.projectId !== undefined) cols.project_id = p.projectId;
  return cols;
}

function checkRange(start: string | null | undefined, due: string | null | undefined) {
  if (start && due && start > due) throw appError("validation", "O início precisa vir antes do prazo.", { startDate: "O início precisa vir antes do prazo." });
}

export async function updateTaskRow(db: DB, workspaceId: string, taskId: string, input: unknown, level: "basic" | "full"): Promise<TaskDTO> {
  if (!z.uuid().safeParse(taskId).success) throw appError("task:not_found", "Tarefa não encontrada.");
  const patch = parse(TaskPatch, input);
  checkPlan(patch, level);
  await checkAssignees(db, workspaceId, patch.assignees);
  if (patch.startDate !== undefined || patch.dueDate !== undefined) {
    const cur = unwrap(await db.from("tasks").select("start_date, due_date").eq("id", taskId).eq("workspace_id", workspaceId).maybeSingle());
    if (!cur) throw appError("task:not_found", "Tarefa não encontrada.");
    checkRange(patch.startDate !== undefined ? patch.startDate : cur.start_date, patch.dueDate !== undefined ? patch.dueDate : cur.due_date);
  }
  const now = new Date().toISOString();
  const cols = { ...toColumns(patch), edited_at: now };
  const rows = unwrap(await db.from("tasks").update(cols).eq("id", taskId).eq("workspace_id", workspaceId).select(TASK_COLUMNS));
  if (!rows?.length) throw appError("task:not_found", "Tarefa não encontrada.");
  // abrir ou editar tira o selo "Novo"
  await db.from("tasks").update({ seen_at: now }).eq("id", taskId).is("seen_at", null);
  return toTaskDTO({ ...(rows[0] as unknown as Parameters<typeof toTaskDTO>[0]), seen_at: now });
}

export async function createTaskRow(db: DB, workspaceId: string, userId: string, input: unknown, level: "basic" | "full"): Promise<TaskDTO> {
  const p = parse(TaskCreate, input);
  checkPlan(p, level);
  checkRange(p.startDate, p.dueDate);
  await checkAssignees(db, workspaceId, p.assignees);
  const row = unwrap(
    await db
      .from("tasks")
      .insert({ ...(toColumns(p) as object), title: p.title, workspace_id: workspaceId, created_by: userId, source: "manual", seen_at: new Date().toISOString() })
      .select(TASK_COLUMNS)
      .single(),
  );
  return toTaskDTO(row as unknown as Parameters<typeof toTaskDTO>[0]);
}
