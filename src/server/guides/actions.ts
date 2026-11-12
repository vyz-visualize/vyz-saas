"use server";

// Grava os guias da pessoa (user_guides): concluir ou pular o tour e adiar um
// lembrete de conexão. É estado da interface de cada pessoa, não dado do
// workspace: fica fora do histórico (ver history/coverage.test.ts). Sem a
// tabela no banco, não quebra nada: só não grava.

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { isMissingTable, nudgeGuide, snoozeUntil, TOUR_GUIDE, type GuideStatus } from "@/features/onboarding/guides";
import { CORE_PROVIDER_IDS } from "@/features/integrations/providers";
import { getSessionUser } from "@/server/auth/session";
import { appError, toActionError, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

async function saveGuide(guide: string, status: GuideStatus, snoozedUntil: string | null): Promise<ActionResult> {
  try {
    const user = await getSessionUser();
    if (!user) throw appError("auth:required");
    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("user_guides")
      .upsert({ user_id: user.id, guide, status, snoozed_until: snoozedUntil }, { onConflict: "user_id,guide" });
    if (error && !isMissingTable(error)) throw appError("unknown", error.message);
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Tour do primeiro dashboard: concluído ou pulado (não volta). */
export async function finishTour(how: "done" | "skipped"): Promise<ActionResult> {
  if (how !== "done" && how !== "skipped") return toActionError(appError("validation"));
  return saveGuide(TOUR_GUIDE, how, null);
}

/** "Agora não" num lembrete de conexão: volta em 3 dias. */
export async function snoozeNudge(provider: string): Promise<ActionResult> {
  const parsed = z.enum(CORE_PROVIDER_IDS as unknown as [string, ...string[]]).safeParse(provider);
  if (!parsed.success) return toActionError(appError("validation"));
  return saveGuide(nudgeGuide(parsed.data as (typeof CORE_PROVIDER_IDS)[number]), "snoozed", snoozeUntil(new Date()));
}
