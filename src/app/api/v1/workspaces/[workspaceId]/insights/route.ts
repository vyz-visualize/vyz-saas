// GET /api/v1/workspaces/:id/insights?periodo=7d: as análises automáticas de
// todos os dashboards live do workspace (feed "Análises" do app).

import { z } from "zod";
import { apiJson, bearerSession, unauthorized } from "@/server/auth/bearer";
import { loadWorkspaceInsights } from "@/server/insights/load";

const Period = z.enum(["7d", "30d", "mes"]).catch("7d");

export async function GET(request: Request, ctx: RouteContext<"/api/v1/workspaces/[workspaceId]/insights">) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const { workspaceId } = await ctx.params;
  if (!z.uuid().safeParse(workspaceId).success) return apiJson({ error: { code: "validation", message: "Workspace inválido." } }, 400);
  const period = Period.parse(new URL(request.url).searchParams.get("periodo") ?? "7d");
  try {
    const { insights, pulse } = await loadWorkspaceInsights(session.db, workspaceId, period);
    return apiJson({ period, insights, pulse });
  } catch (err) {
    console.error("[vyz] api v1 insights", err);
    return apiJson({ error: { code: "unknown", message: "Não foi possível carregar as análises." } }, 500);
  }
}
