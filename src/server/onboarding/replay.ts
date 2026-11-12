"use server";

// "Refazer primeiro acesso": volta o onboarding do workspace aberto ao começo,
// sem apagar nada (projetos, contas, dashboards e assinatura ficam). Só para
// os e-mails de ONBOARDING_REPLAY_EMAILS e só para admin do workspace. Roda com
// a sessão da pessoa (RLS): só mexe no workspace aberto e nos guias dela.

import { redirect, unstable_rethrow } from "next/navigation";
import { isMissingTable } from "@/features/onboarding/guides";
import { authorize } from "@/server/auth/workspace";
import { canReplayOnboarding } from "@/server/env";
import { logActivity } from "@/server/history/log";
import { appError, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

export async function replayFirstAccess(): Promise<ActionResult> {
  try {
    const session = await authorize("admin");
    if (!canReplayOnboarding(session.user.email)) throw appError("forbidden", "Refazer o primeiro acesso não está liberado para esta conta.");
    const supabase = await createServerSupabase();
    unwrap(await supabase.from("workspaces").update({ onboarding_step: "business", onboarding_completed_at: null }).eq("id", session.workspace.id));
    // tour e lembretes voltam também; sem a tabela no banco (migration ainda não aplicada), segue sem eles
    const guides = await supabase.from("user_guides").delete().eq("user_id", session.user.id);
    if (guides.error && !isMissingTable(guides.error)) throw appError("unknown", guides.error.message);
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "onboarding.replayed", metadata: { guides_reset: !guides.error } });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect("/comecar");
}
