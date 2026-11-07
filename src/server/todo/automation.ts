import "server-only";

// Tarefas automáticas do A Fazer: cria uma tarefa por análise que pede ação
// (sem repetir: insight_key único entre as abertas) e fecha a tarefa aberta
// quando a análise some (a métrica voltou), se ninguém mexeu nela. Roda no
// agendador diário (cron/digest) e ao abrir o A Fazer, se a última geração
// passou de algumas horas. Usa o cliente recebido: o de serviço, depois de
// quem chamou ter conferido o acesso ao workspace.

import type { Insight } from "@/features/insights/insights";
import { reconcile, RECOVERED_NOTE, REOPEN_AFTER_DAYS, suggestTasks, type ExistingAutoTask, type InsightContext } from "@/features/todo/auto";
import { todayIn } from "@/features/todo/logic";
import type { TaskStatus } from "@/features/todo/types";
import { loadWorkspaceInsights, type DashboardPulse } from "@/server/insights/load";
import type { DB } from "@/server/supabase/server";

/** Intervalo mínimo entre gerações ao abrir a página. */
export const AUTO_TASKS_TTL_MS = 4 * 60 * 60 * 1000;

export type AutoTasksResult = { created: number; closed: number };

export async function generateAutoTasks(
  db: DB,
  workspaceId: string,
  opts: { timeZone?: string; loaded?: { insights: Insight[]; pulse: Pick<DashboardPulse, "id" | "platform">[] }; now?: Date } = {},
): Promise<AutoTasksResult> {
  const now = opts.now ?? new Date();
  const { insights, pulse } = opts.loaded ?? (await loadWorkspaceInsights(db, workspaceId, "7d", 12));
  const analyzed = new Set(pulse.map((p) => p.id));
  const platformOf = new Map(pulse.map((p) => [p.id, p.platform]));

  const dashIds = [...analyzed];
  const { data: dashes } = dashIds.length
    ? await db.from("dashboards").select("id, project_id, project:projects(name)").eq("workspace_id", workspaceId).in("id", dashIds)
    : { data: [] };
  const ctxMap = new Map<string, InsightContext>();
  for (const d of dashes ?? []) {
    const project = d.project as { name: string } | { name: string }[] | null;
    const name = Array.isArray(project) ? project[0]?.name : project?.name;
    ctxMap.set(d.id, { projectId: d.project_id, projectName: name ?? null, platform: platformOf.get(d.id) ?? null });
  }

  const today = todayIn(opts.timeZone ?? "America/Sao_Paulo", now);
  const suggestions = suggestTasks(insights, (id) => ctxMap.get(id) ?? { platform: platformOf.get(id) ?? null }, today);

  const cutoff = new Date(now.getTime() - REOPEN_AFTER_DAYS * 86_400_000).toISOString();
  const { data: rows, error } = await db
    .from("tasks")
    .select("id, insight_key, status, edited_at, created_at, completed_at, dashboard_id")
    .eq("workspace_id", workspaceId)
    .eq("source", "insight")
    .or(`status.in.(planejado,em_andamento),completed_at.gte.${cutoff},created_at.gte.${cutoff}`);
  if (error) throw error;
  const existing: ExistingAutoTask[] = (rows ?? []).map((r) => ({
    id: r.id,
    insightKey: r.insight_key ?? "",
    status: r.status as TaskStatus,
    editedAt: r.edited_at,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    dashboardId: r.dashboard_id,
  }));

  const plan = reconcile(suggestions, existing, analyzed, now);
  let created = 0;
  // uma por vez: a chave única das abertas barra corrida entre duas gerações
  for (const s of plan.create) {
    const { error: e } = await db.from("tasks").insert({
      workspace_id: workspaceId,
      project_id: s.projectId,
      dashboard_id: s.dashboardId,
      platform: s.platform,
      title: s.title,
      detail: s.detail,
      stage: s.stage,
      priority: s.priority,
      due_date: s.dueDate,
      source: "insight",
      insight_key: s.insightKey,
    });
    if (!e) created++;
    else if (e.code !== "23505") console.error("[vyz] a fazer: criar tarefa automática", e);
  }

  let closed = 0;
  if (plan.close.length) {
    const { data: done, error: e } = await db
      .from("tasks")
      .update({ status: "concluido", completed_at: now.toISOString(), auto_note: RECOVERED_NOTE })
      .eq("workspace_id", workspaceId)
      .in("id", plan.close)
      .is("edited_at", null)
      .in("status", ["planejado", "em_andamento"])
      .select("id");
    if (e) console.error("[vyz] a fazer: fechar tarefas", e);
    closed = done?.length ?? 0;
  }

  await db.from("task_automation_runs").upsert({ workspace_id: workspaceId, generated_at: now.toISOString(), created_count: created, closed_count: closed });
  return { created, closed };
}

/** Gera só se a última geração passou do intervalo. Nunca lança: a página abre mesmo se falhar. */
export async function maybeGenerateAutoTasks(db: DB, workspaceId: string, timeZone: string): Promise<AutoTasksResult> {
  try {
    const { data } = await db.from("task_automation_runs").select("generated_at").eq("workspace_id", workspaceId).maybeSingle();
    if (data && Date.now() - Date.parse(data.generated_at) < AUTO_TASKS_TTL_MS) return { created: 0, closed: 0 };
    // marca antes de gerar: duas aberturas seguidas não calculam duas vezes
    await db.from("task_automation_runs").upsert({ workspace_id: workspaceId, generated_at: new Date().toISOString() });
    return await generateAutoTasks(db, workspaceId, { timeZone });
  } catch (err) {
    console.error("[vyz] a fazer: geração automática", err);
    return { created: 0, closed: 0 };
  }
}
