// DELETE /api/v1/account: exclusão da própria conta, pedida no app (exigência
// da Apple). Passa a propriedade dos workspaces a outro membro (ou encerra a
// assinatura de quem está sozinho), tira o usuário de tudo e o apaga no Auth.
// Faturas e transações ficam (obrigação fiscal), sem vínculo com a pessoa.

import type { DeleteAccountResponse } from "@vyz/shared";
import { apiJson, bearerSession, unauthorized, apiError } from "@/server/auth/bearer";
import { logAuthEvent } from "@/server/history/log";
import { createAdminSupabase } from "@/server/supabase/admin";

export async function DELETE(request: Request) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const admin = createAdminSupabase({ actorId: session.userId });
  const prepared = await admin.rpc("prepare_account_deletion", { p_user_id: session.userId });
  if (prepared.error) {
    console.error("[vyz] preparar exclusão de conta", prepared.error);
    return apiError("unknown", "Não foi possível excluir a conta agora. Tente de novo.", 500);
  }
  const deleted = await admin.auth.admin.deleteUser(session.userId);
  if (deleted.error) {
    console.error("[vyz] excluir conta", deleted.error);
    return apiError("unknown", "Não foi possível excluir a conta agora. Tente de novo.", 500);
  }
  await logAuthEvent({ event: "sign_out", userId: null, email: session.email, method: "admin", metadata: { account_deleted: true, ...((prepared.data as Record<string, number>) ?? {}) } });
  const body: DeleteAccountResponse = { deleted: true };
  return apiJson(body);
}
