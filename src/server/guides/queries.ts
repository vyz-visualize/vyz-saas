import "server-only";

// Guias da pessoa logada (user_guides), com o RLS dela. Se a tabela ainda não
// existe no banco (migration não aplicada), devolve "indisponível": nada de
// tour nem lembrete, e o resto da tela segue normal.

import { isMissingTable, NO_GUIDES, type GuideRow, type GuidesState } from "@/features/onboarding/guides";
import { createServerSupabase } from "@/server/supabase/server";

export async function getMyGuides(userId: string): Promise<GuidesState> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("user_guides").select("guide, status, snoozed_until").eq("user_id", userId);
  if (error) {
    if (!isMissingTable(error)) console.error("[vyz] guias", error.message);
    return NO_GUIDES;
  }
  const rows: GuideRow[] = (data ?? []).map((r) => ({ guide: r.guide, status: r.status as GuideRow["status"], snoozedUntil: r.snoozed_until }));
  return { available: true, rows };
}
