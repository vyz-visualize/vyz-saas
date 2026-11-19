// POST /api/v1/workspaces/:id/store-plan: antes de assinar ou trocar o plano
// pela loja, o app diz qual workspace recebe a assinatura. Só o dono; o
// workspace não pode ter plano pago no cartão pelo site (o simulado pode: a
// assinatura da loja o substitui, ver syncStoreSubscription).

import { z } from "zod";
import { apiJson, bearerSession, unauthorized, apiError } from "@/server/auth/bearer";
import { STORE_REPLACEABLE } from "@/server/billing/store";
import { createAdminSupabase } from "@/server/supabase/admin";

export async function POST(request: Request, ctx: RouteContext<"/api/v1/workspaces/[workspaceId]/store-plan">) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const { workspaceId } = await ctx.params;
  if (!z.uuid().safeParse(workspaceId).success) return apiError("validation", "Workspace inválido.", 400);

  const [member, access] = await Promise.all([
    session.db.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", session.userId).maybeSingle(),
    session.db.from("workspace_access").select("subscription_id, provider").eq("workspace_id", workspaceId).maybeSingle(),
  ]);
  if (member.data?.role !== "owner") return apiError("forbidden", "Só o dono da organização pode mudar o plano.", 403);
  const provider = access.data?.subscription_id ? access.data.provider : null;
  // plano simulado do site (contas de teste, como a da revisão das lojas) passa para a
  // loja; plano pago no cartão não (o cliente pagaria duas vezes)
  if (provider && !STORE_REPLACEABLE.has(provider)) {
    return apiError("store:workspace_has_plan", "O plano desta organização é cobrado no cartão e não pode ser trocado pelo app.", 409);
  }

  // uma assinatura da loja por usuário: viva em outro workspace, troca lá
  const admin = createAdminSupabase();
  const live = await admin
    .from("subscriptions")
    .select("workspace_id")
    .eq("provider_subscription_id", `rc:${session.userId}`)
    .not("status", "in", "(canceled,incomplete_expired)")
    .maybeSingle();
  if (live.error) return apiError("unknown", "Não foi possível preparar a assinatura. Tente de novo.", 500);
  if (live.data && live.data.workspace_id !== workspaceId) {
    return apiError("store:other_workspace", "Sua assinatura do app já está em outra organização. Mude o plano por lá.", 409);
  }

  const { error } = await admin.from("store_customers").upsert({ user_id: session.userId, workspace_id: workspaceId, updated_at: new Date().toISOString() });
  if (error) return apiError("unknown", "Não foi possível preparar a assinatura. Tente de novo.", 500);
  return apiJson({ ok: true });
}
