// PATCH /api/v1/workspaces/:id/tasks/:taskId: muda status, prioridade, etapa,
// prazo ou título de uma tarefa pelo app. Mesmas regras do painel (papel de
// editor, campos do plano completo travados nos demais planos).

import { z } from "zod";
import { situationOf, todayIn } from "@/features/todo/logic";
import { hasRole } from "@/features/workspace/session";
import { apiJson, bearerSession, unauthorized, apiError } from "@/server/auth/bearer";
import { bearerWorkspace } from "@/server/auth/bearer-workspace";
import { AppError } from "@/server/supabase/errors";
import { updateTaskRow } from "@/server/todo/mutations";
import { todoLevel } from "@/server/todo/queries";

const STATUS: Record<string, number> = { validation: 400, forbidden: 403, "task:not_found": 404 };

export async function PATCH(request: Request, ctx: RouteContext<"/api/v1/workspaces/[workspaceId]/tasks/[taskId]">) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const { workspaceId, taskId } = await ctx.params;
  if (!z.uuid().safeParse(workspaceId).success) return apiError("validation", "Workspace inválido.", 400);
  if (!z.uuid().safeParse(taskId).success) return apiError("task:not_found", "Tarefa não encontrada.", 404);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError("validation", "Envie os campos da tarefa.", 400);
  try {
    const ws = await bearerWorkspace(session, workspaceId);
    if (!ws || ws.workspace.id !== workspaceId) return apiError("forbidden", "Você não tem acesso a esta organização.", 403);
    if (!hasRole(ws.role, "member")) return apiError("forbidden", "Seu acesso é só de leitura.", 403);
    if (!ws.access.hasAccess) return apiError("plan:inactive", "O plano desta organização está inativo.", 402);
    const task = await updateTaskRow(session.db, workspaceId, taskId, body, todoLevel(ws));
    const today = todayIn(ws.workspace.timezone || "America/Sao_Paulo");
    return apiJson({ task: { ...task, situation: situationOf(task, today) } });
  } catch (err) {
    if (err instanceof AppError && STATUS[err.code]) return apiError(err.code, err.message, STATUS[err.code]);
    console.error("[vyz] api v1 task patch", err);
    return apiError("unknown", "Não foi possível salvar a tarefa.", 500);
  }
}
