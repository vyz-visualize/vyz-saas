// POST /api/v1/workspaces/:id/tasks/:taskId/apply: aplica na plataforma a
// mudança proposta pela tarefa (botão Aplicar do app). Mesmas regras do painel:
// papel de editor e plano ativo; vale para todos os planos.

import { z } from "zod";
import { hasRole } from "@/features/workspace/session";
import { apiJson, bearerSession, unauthorized } from "@/server/auth/bearer";
import { bearerWorkspace } from "@/server/auth/bearer-workspace";
import { applyTaskFor } from "@/server/optimize/service";
import { AppError } from "@/server/supabase/errors";

const fail = (code: string, message: string, status: number) => apiJson({ error: { code, message } }, status);
const STATUS: Record<string, number> = {
  validation: 400,
  forbidden: 403,
  "task:not_found": 404,
};

export async function POST(request: Request, ctx: RouteContext<"/api/v1/workspaces/[workspaceId]/tasks/[taskId]/apply">) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const { workspaceId, taskId } = await ctx.params;
  if (!z.uuid().safeParse(workspaceId).success) return fail("validation", "Workspace inválido.", 400);
  if (!z.uuid().safeParse(taskId).success) return fail("task:not_found", "Tarefa não encontrada.", 404);
  try {
    const ws = await bearerWorkspace(session, workspaceId);
    if (!ws || ws.workspace.id !== workspaceId) return fail("forbidden", "Você não tem acesso a esta organização.", 403);
    if (!hasRole(ws.role, "member")) return fail("forbidden", "Seu acesso é só de leitura.", 403);
    if (!ws.access.hasAccess) return fail("plan:inactive", "O plano desta organização está inativo.", 402);
    const run = await applyTaskFor(session.db, workspaceId, session.userId, taskId);
    return apiJson({ run });
  } catch (err) {
    if (err instanceof AppError && STATUS[err.code]) return fail(err.code, err.message, STATUS[err.code]);
    console.error("[vyz] api v1 aplicar otimização", err);
    return fail("unknown", "Não foi possível aplicar a mudança.", 500);
  }
}
