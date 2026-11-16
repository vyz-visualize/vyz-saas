"use server";

// "Recomeçar teste": só para as contas de teste (isTestAccount). Apaga os
// workspaces que a pessoa criou (assinatura, faturas, contas, dashboards) e os
// pedidos dela, mas mantém o login (e-mail ou Google). Volta para os planos do
// site, pronta para assinar de novo.
// Com a Stripe ligada (checkout simulado, CHECKOUT_SIMULATED_EMAILS), apaga SÓ as
// organizações de teste (assinatura mock com metadata.teste): a de verdade fica.

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/supabase/cookies";
import { getSessionUser } from "@/server/auth/session";
import { isTestAccount, serverEnv } from "@/server/env";
import { testWorkspaceIds } from "./simulated";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";

export async function resetTestAccount(): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user) throw appError("auth:required");
    if (!isTestAccount(user.email)) throw appError("forbidden", "Só contas de teste podem recomeçar.");
    const admin = createAdminSupabase({ actorId: user.id });
    const created = unwrap(await admin.from("workspaces").select("id").eq("created_by", user.id)) ?? [];
    // cobrança real ligada: só as organizações de teste
    const tests = serverEnv().BILLING_PROVIDER === "mock" ? null : new Set(await testWorkspaceIds(admin, user.id));
    const owned = tests ? created.filter((w) => tests.has(w.id)) : created;
    for (const w of owned) {
      // registros financeiros seguram o workspace (on delete restrict): em teste, saem antes
      unwrap(await admin.from("payment_transactions").delete().eq("workspace_id", w.id));
      unwrap(await admin.from("invoices").delete().eq("workspace_id", w.id));
      unwrap(await admin.from("workspaces").delete().eq("id", w.id));
    }
    // pedidos: com a Stripe ligada, só os simulados (os de verdade ficam no histórico)
    unwrap(tests ? await admin.from("checkout_sessions").delete().eq("user_id", user.id).eq("provider", "mock") : await admin.from("checkout_sessions").delete().eq("user_id", user.id));
    (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
    console.info("[vyz] conta de teste recomeçada", user.id, owned.length);
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect("/?teste=1#planos");
}
