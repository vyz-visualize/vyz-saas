// GET /api/v1/workspaces/:id/dashboards: dashboards do workspace (RLS do usuário).

import { z } from "zod";
import { apiJson, bearerSession, unauthorized, apiError } from "@/server/auth/bearer";

export async function GET(request: Request, ctx: RouteContext<"/api/v1/workspaces/[workspaceId]/dashboards">) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const { workspaceId } = await ctx.params;
  if (!z.uuid().safeParse(workspaceId).success) return apiError("validation", "Workspace inválido.", 400);
  const { data, error } = await session.db
    .from("dashboards")
    .select("id, name, client_name, template_id, period, updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) return apiError("unknown", "Não foi possível carregar os dashboards.", 500);
  return apiJson({
    dashboards: data.map((d) => ({ id: d.id, name: d.name, clientName: d.client_name, templateId: d.template_id, period: d.period, updatedAt: d.updated_at })),
  });
}
