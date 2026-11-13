import "server-only";

// Dados da tela de consentimento simulada (/integracoes/simulacao/<provedor>).
// Só existe no modo simulado. Confere o state antes de mostrar os botões (a
// rota de volta confere de novo e é quem decide).

import { notFound } from "next/navigation";
import { isStateToken, randomToken, sha256Hex } from "@/features/integrations/oauth";
import type { ProviderId } from "@/features/integrations/providers";
import { RETURN_DEFAULT, storedReturnPath } from "@/features/integrations/results";
import { requireSessionUser } from "@/server/auth/session";
import { isMockIntegrations } from "@/server/env";
import { createAdminSupabase } from "@/server/supabase/admin";
import { createServerSupabase } from "@/server/supabase/server";

export type MockConsentView =
  | { ok: true; state: string; code: string; workspaceName: string; expiresAt: string; timeZone: string }
  | { ok: false; reason: "invalid" | "expired" | "used"; back: string };

export async function loadMockConsent(provider: ProviderId, rawState: string | string[] | undefined): Promise<MockConsentView> {
  if (!isMockIntegrations()) notFound();
  const user = await requireSessionUser(`/integracoes/simulacao/${provider}`);
  const state = Array.isArray(rawState) ? rawState[0] : rawState;
  if (!isStateToken(state)) return { ok: false, reason: "invalid", back: RETURN_DEFAULT };

  // oauth_states não tem política para usuários: leitura com a chave de serviço,
  // filtrada pelo usuário logado e pelo provedor.
  const { data } = await createAdminSupabase()
    .from("oauth_states")
    .select("workspace_id, user_id, provider, redirect_path, expires_at, consumed_at")
    .eq("state_hash", await sha256Hex(state))
    .maybeSingle();
  if (!data || data.user_id !== user.id || data.provider !== provider) return { ok: false, reason: "invalid", back: RETURN_DEFAULT };
  const back = storedReturnPath(data.redirect_path);
  if (data.consumed_at) return { ok: false, reason: "used", back };
  if (Date.parse(data.expires_at) <= Date.now()) return { ok: false, reason: "expired", back };

  const supabase = await createServerSupabase();
  const { data: ws } = await supabase.from("workspaces").select("name, timezone").eq("id", data.workspace_id).maybeSingle();
  return {
    ok: true,
    state,
    // O "código de autorização" do provedor simulado (a troca confere o formato).
    code: `mock_${randomToken(24)}`,
    workspaceName: ws?.name ?? "sua organização",
    expiresAt: data.expires_at,
    timeZone: ws?.timezone ?? "America/Sao_Paulo",
  };
}
