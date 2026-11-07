import "server-only";

// Leitura do A Fazer (RLS de quem está logado). Ao abrir, gera as tarefas
// automáticas se a última geração já passou de algumas horas.

import { ENTITLEMENTS } from "@/features/pricing/entitlements";
import { todayIn } from "@/features/todo/logic";
import type { TaskDTO, TaskMember, TaskPriority, TaskSource, TaskStage, TaskStatus, TodoState } from "@/features/todo/types";
import { hasRole, type WorkspaceSession } from "@/features/workspace/session";
import { getWorkspaceSession } from "@/server/auth/workspace";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, unwrap } from "@/server/supabase/errors";
import { createServerSupabase, type DB } from "@/server/supabase/server";
import { maybeGenerateAutoTasks } from "./automation";

export const TASK_COLUMNS =
  "id, title, detail, status, stage, priority, start_date, due_date, assignees, group_id, project_id, dashboard_id, platform, source, auto_note, seen_at, created_at, completed_at, project:projects(name)";

type TaskRow = {
  id: string;
  title: string;
  detail: string | null;
  status: string;
  stage: string;
  priority: string;
  start_date: string | null;
  due_date: string | null;
  assignees: string[];
  group_id: string | null;
  project_id: string | null;
  dashboard_id: string | null;
  platform: string | null;
  source: string;
  auto_note: string | null;
  seen_at: string | null;
  created_at: string;
  completed_at: string | null;
  project: { name: string } | { name: string }[] | null;
};

export function toTaskDTO(r: TaskRow): TaskDTO {
  const project = Array.isArray(r.project) ? r.project[0] : r.project;
  return {
    id: r.id,
    title: r.title,
    detail: r.detail,
    status: r.status as TaskStatus,
    stage: r.stage as TaskStage,
    priority: r.priority as TaskPriority,
    startDate: r.start_date,
    dueDate: r.due_date,
    assignees: r.assignees ?? [],
    groupId: r.group_id,
    projectId: r.project_id,
    projectName: project?.name ?? null,
    dashboardId: r.dashboard_id,
    platform: r.platform,
    source: r.source as TaskSource,
    autoNote: r.auto_note,
    isNew: r.source === "insight" && !r.seen_at,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}

/** Tarefas do workspace (as mais novas primeiro, até 1000). */
export async function listTasks(db: DB, workspaceId: string, opts: { openOnly?: boolean } = {}): Promise<TaskDTO[]> {
  let q = db.from("tasks").select(TASK_COLUMNS).eq("workspace_id", workspaceId);
  if (opts.openOnly) q = q.in("status", ["planejado", "em_andamento"]);
  const rows = unwrap(await q.order("created_at", { ascending: false }).limit(1000));
  return (rows as unknown as TaskRow[]).map(toTaskDTO);
}

export const todoLevel = (session: WorkspaceSession): "basic" | "full" => (session.access.entitlements ?? ENTITLEMENTS[session.access.tier ?? "base"]).todo;

export async function getTodoState(): Promise<TodoState> {
  const session = await getWorkspaceSession();
  if (!session) throw appError("auth:required");
  const ws = session.workspace.id;
  const timeZone = session.workspace.timezone || "America/Sao_Paulo";
  const gen = session.access.hasAccess ? await maybeGenerateAutoTasks(createAdminSupabase(), ws, timeZone) : { created: 0, closed: 0 };

  const db = await createServerSupabase();
  const [tasks, groups, members, projects] = await Promise.all([
    listTasks(db, ws),
    db.from("task_groups").select("id, name").eq("workspace_id", ws).order("created_at").then(unwrap),
    db.from("workspace_members").select("user_id").eq("workspace_id", ws).order("created_at").then(unwrap),
    db.from("projects").select("id, name").eq("workspace_id", ws).is("archived_at", null).order("created_at").then(unwrap),
  ]);
  const ids = (members ?? []).map((m) => m.user_id);
  const people = ids.length ? ((await db.from("profiles").select("id, full_name, email, avatar_url").in("id", ids)).data ?? []) : [];
  const team: TaskMember[] = ids.map((id) => {
    const p = people.find((x) => x.id === id);
    return { userId: id, name: p?.full_name || p?.email || "Membro", avatarUrl: p?.avatar_url ?? null };
  });

  return {
    tasks,
    groups: groups ?? [],
    members: team,
    projects: projects ?? [],
    level: todoLevel(session),
    canEdit: hasRole(session.role, "member"),
    today: todayIn(timeZone),
    timeZone,
    justCreated: gen.created,
  };
}
