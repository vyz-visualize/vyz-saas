// POST /api/dashboards/:id/atualizar
// Atualização ao abrir: o painel chama quando os números do dashboard têm mais de 6 h.
// Sincroniza as contas atrasadas dele (no máximo uma vez por conta, 3 por vez) e responde
// quando termina, para a tela trocar os números. Rota e não Server Action: as ações do
// Next rodam uma de cada vez, e uma sincronização longa travaria as outras (salvar, filtrar).

import { z } from "zod";
import { authorize } from "@/server/auth/workspace";
import { AppError } from "@/server/supabase/errors";
import { refreshDashboardOnOpen } from "@/server/sync/on-open";

export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request, ctx: RouteContext<"/api/dashboards/[id]/atualizar">) {
  // só o próprio painel: outro site não dispara sincronização com o cookie da pessoa
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return Response.json({ ok: false, error: "forbidden" }, { status: 403, headers: NO_STORE });
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return Response.json({ ok: false, error: "validation" }, { status: 400, headers: NO_STORE });
  try {
    const session = await authorize("viewer");
    const summary = await refreshDashboardOnOpen(id, session);
    return Response.json({ ok: summary.ok, synced: summary.synced, failed: summary.failed, rateLimited: summary.rateLimited, due: summary.due, lastSyncedAt: summary.lastSyncedAt }, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof AppError) return Response.json({ ok: false, error: err.code }, { status: err.code === "auth:required" ? 401 : 403, headers: NO_STORE });
    console.error("[vyz] atualização ao abrir", err instanceof Error ? err.message : err);
    return Response.json({ ok: false, error: "unknown" }, { status: 500, headers: NO_STORE });
  }
}
