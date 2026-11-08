// GET /api/v1/workspaces/:id/tasks?abertas=1: o A Fazer do workspace para o
// app (as abertas primeiro, por prioridade e prazo), com a situação de cada
// uma. Gera as tarefas automáticas se a última geração já passou de horas.

import { z } from "zod";
import { situationOf, sortTasks, todayIn } from "@/features/todo/logic";
import { hasRole } from "@/features/workspace/session";
import { apiJson, bearerSession, unauthorized } from "@/server/auth/bearer";
import { bearerWorkspace } from "@/server/auth/bearer-workspace";
import { createAdminSupabase } from "@/server/supabase/admin";
import { maybeGenerateAutoTasks } from "@/server/todo/automation";
import { describeAction } from "@/features/optimize/actions";
import { listRuns } from "@/server/optimize/service";
import { listTasks, todoLevel } from "@/server/todo/queries";

const fail = (code: string, message: string, status: number) => apiJson({ error: { code, message } }, status);

export async function GET(request: Request, ctx: RouteContext<"/api/v1/workspaces/[workspaceId]/tasks">) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const { workspaceId } = await ctx.params;
  if (!z.uuid().safeParse(workspaceId).success) return fail("validation", "Workspace inválido.", 400);
  try {
    const ws = await bearerWorkspace(session, workspaceId);
    if (!ws || ws.workspace.id !== workspaceId) return fail("forbidden", "Você não tem acesso a este workspace.", 403);
    const timeZone = ws.workspace.timezone || "America/Sao_Paulo";
    if (ws.access.hasAccess) await maybeGenerateAutoTasks(createAdminSupabase(), workspaceId, timeZone);
    const openOnly = new URL(request.url).searchParams.get("abertas") === "1";
    const today = todayIn(timeZone);
    const tasks = sortTasks(await listTasks(session.db, workspaceId, { openOnly }));
    return apiJson({
      today,
      level: todoLevel(ws),
      canEdit: hasRole(ws.role, "member"),
      tasks: tasks.map((t) => ({ ...t, situation: situationOf(t, today), actionText: t.action ? describeAction(t.action) : null })),
      runs: await listRuns(session.db, workspaceId, 20),
    });
  } catch (err) {
    console.error("[vyz] api v1 tasks", err);
    return fail("unknown", "Não foi possível carregar as tarefas.", 500);
  }
}
