// POST /api/v1/workspaces/:id/optimizations/:runId/undo: desfaz uma mudança
// aplicada numa plataforma (volta ao valor de antes). Papel de editor.

import { z } from "zod";
import { hasRole } from "@/features/workspace/session";
import { apiJson, bearerSession, unauthorized } from "@/server/auth/bearer";
import { bearerWorkspace } from "@/server/auth/bearer-workspace";
import { undoFor } from "@/server/optimize/service";
import { AppError } from "@/server/supabase/errors";

const fail = (code: string, message: string, status: number) => apiJson({ error: { code, message } }, status);
const STATUS: Record<string, number> = {
  validation: 400,
  forbidden: 403,
  "optimization:not_found": 404,
};

export async function POST(request: Request, ctx: RouteContext<"/api/v1/workspaces/[workspaceId]/optimizations/[runId]/undo">) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const { workspaceId, runId } = await ctx.params;
  if (!z.uuid().safeParse(workspaceId).success) return fail("validation", "Workspace inválido.", 400);
  if (!z.uuid().safeParse(runId).success) return fail("optimization:not_found", "Mudança não encontrada.", 404);
  try {
    const ws = await bearerWorkspace(session, workspaceId);
    if (!ws || ws.workspace.id !== workspaceId) return fail("forbidden", "Você não tem acesso a esta organização.", 403);
    if (!hasRole(ws.role, "member")) return fail("forbidden", "Seu acesso é só de leitura.", 403);
    const run = await undoFor(workspaceId, session.userId, runId);
    return apiJson({ run });
  } catch (err) {
    if (err instanceof AppError && STATUS[err.code]) return fail(err.code, err.message, STATUS[err.code]);
    console.error("[vyz] api v1 desfazer otimização", err);
    return fail("unknown", "Não foi possível desfazer a mudança.", 500);
  }
}
