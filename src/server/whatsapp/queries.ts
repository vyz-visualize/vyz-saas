import "server-only";

// Dados da página WhatsApp do painel: a inscrição do usuário no workspace
// aberto e as últimas mensagens (pelo cliente do usuário: RLS).

import type { WorkspaceSession } from "@/features/workspace/session";
import { isMockWhatsapp } from "@/server/env";
import { createServerSupabase } from "@/server/supabase/server";

export type WhatsappMessageView = { id: string; direction: string; kind: string; status: string; body: string | null; error: string | null; createdAt: string };
export type WhatsappPageData = {
  subscription: { phone: string; verified: boolean; reports: string[]; paused: boolean; optedOut: boolean; optedInAt: string | null } | null;
  messages: WhatsappMessageView[];
  simulated: boolean;
};

export async function getWhatsappData(session: WorkspaceSession): Promise<WhatsappPageData> {
  const supabase = await createServerSupabase();
  const { data: sub } = await supabase.from("whatsapp_subscriptions").select("*").eq("workspace_id", session.workspace.id).eq("user_id", session.user.id).maybeSingle();
  const { data: messages } = sub
    ? await supabase.from("whatsapp_messages").select("id, direction, kind, status, body, error, created_at").eq("subscription_id", sub.id).order("created_at", { ascending: false }).limit(15)
    : { data: [] };
  return {
    subscription: sub ? { phone: sub.phone, verified: !!sub.verified_at, reports: sub.reports, paused: sub.paused, optedOut: !!sub.opted_out_at, optedInAt: sub.opted_in_at } : null,
    messages: (messages ?? []).map((m) => ({ id: m.id, direction: m.direction, kind: m.kind, status: m.status, body: m.body, error: m.error, createdAt: m.created_at })),
    simulated: isMockWhatsapp(),
  };
}
