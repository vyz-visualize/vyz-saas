// GET /api/v1/dashboards/:id?periodo=30d[&campanha=ID,ID]: dados do
// dashboard live, já agregados no servidor (mesmo carregador e mesmos
// filtros do site; o app só desenha), com as análises automáticas.

import { z } from "zod";
import { parseFilters } from "@/features/analytics/filters";
import { dashboardInsights } from "@/features/insights/insights";
import { loadLiveDashboard } from "@/server/analytics/queries";
import { apiJson, bearerSession, unauthorized } from "@/server/auth/bearer";
import { AppError } from "@/server/supabase/errors";

const Period = z.enum(["7d", "30d", "mes", "custom"]).catch("30d");

export async function GET(request: Request, ctx: RouteContext<"/api/v1/dashboards/[id]">) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return apiJson({ error: { code: "validation", message: "Dashboard inválido." } }, 400);
  const url = new URL(request.url);
  const period = Period.parse(url.searchParams.get("periodo") ?? "30d");
  try {
    const data = await loadLiveDashboard(id, { period, db: session.db, filters: parseFilters(url.searchParams) });
    const insights = dashboardInsights(data);
    return apiJson({ dashboard: data, insights });
  } catch (err) {
    if (err instanceof AppError) return apiJson({ error: err.toAction() }, err.code === "dashboard:not_found" ? 404 : 400);
    console.error("[vyz] api v1 dashboard", err);
    return apiJson({ error: { code: "unknown", message: "Não foi possível carregar o dashboard." } }, 500);
  }
}
