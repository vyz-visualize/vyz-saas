"use server";

// Lista de espera das landing pages. Passa pelo RLS de quem está logado: cada
// usuário só cria e lê a própria inscrição, e o e-mail vem do banco (gatilho).

import { normalizeUseCase, WAITLIST_USE_CASE_MAX } from "@/features/landing-pages/waitlist";
import { landingPagesEnabledFor } from "@/lib/flags";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { authorize } from "@/server/auth/workspace";
import { appError, fromPostgrest, toActionError, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";
import { logActivity } from "@/server/history/log";

/** Inscreve quem está logado. Já inscrito não é erro: a tela só mostra "Você está na lista". */
export async function joinLandingWaitlist(rawUseCase: unknown): Promise<ActionResult<{ already: boolean }>> {
  try {
    const useCase = normalizeUseCase(rawUseCase);
    if (useCase === "invalid") throw appError("validation", `Use até ${WAITLIST_USE_CASE_MAX} caracteres.`);
    const session = await authorize("viewer", { access: false });
    if (landingPagesEnabledFor(session.workspace.product)) throw appError("forbidden", "A lista de espera não está aberta para este workspace.");

    const supabase = await createServerSupabase();
    // o e-mail é preenchido pelo gatilho do banco, por isso fica de fora daqui
    const row = { workspace_id: session.workspace.id, user_id: session.user.id, use_case: useCase } as TablesInsert<"landing_waitlist">;
    const { error } = await supabase.from("landing_waitlist").insert(row);
    if (error?.code === "23505") return { ok: true, data: { already: true } };
    if (error) throw fromPostgrest(error);
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "landing.waitlist_joined", metadata: { has_use_case: !!useCase } });
    return { ok: true, data: { already: false } };
  } catch (err) {
    return toActionError(err);
  }
}

/** Conta uma visita à página "em breve". É só medição: se falhar, a página segue normal. */
export async function recordLandingWaitlistVisit(): Promise<void> {
  try {
    const session = await authorize("viewer", { access: false });
    if (landingPagesEnabledFor(session.workspace.product)) return;
    const supabase = await createServerSupabase();
    const { error } = await supabase.from("landing_waitlist_visits").insert({ workspace_id: session.workspace.id });
    if (error) console.error("[lista de espera] visita não registrada", error.code);
  } catch (err) {
    console.error("[lista de espera] visita não registrada", err);
  }
}
