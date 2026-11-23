import "server-only";

// Tokens das conexões. Ficam no Supabase Vault; leitura e gravação só pelas
// funções restritas ao service_role (connection_tokens_read/save). Quem chama
// autoriza antes. Nunca logue o retorno destas funções.

import type { ProviderId } from "@/features/integrations/providers";
import { isTokenConnection } from "@/features/integrations/token-connect";
import type { DB } from "@/server/supabase/server";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, fromPostgrest } from "@/server/supabase/errors";
import { markOwnAppToken } from "./meta-auth";
import { providerForConnection, ProviderError } from "./providers";

export type StoredTokens = { accessToken: string; refreshToken: string | null; expiresAt: string | null };

// Renova quando faltar menos que isto (a sincronização leva alguns minutos).
const REFRESH_MARGIN_MS = 10 * 60 * 1000;

/** O tipo gerado marca como obrigatórios argumentos que a função aceita nulos. */
export const nullable = <T>(v: T | null | undefined) => (v ?? null) as T;

export async function readConnectionTokens(connectionId: string, admin: DB = createAdminSupabase()): Promise<StoredTokens | null> {
  const { data, error } = await admin.rpc("connection_tokens_read", { p_connection_id: connectionId });
  if (error) throw fromPostgrest(error);
  const row = data?.[0];
  if (!row?.access_token) return null;
  return { accessToken: row.access_token, refreshToken: row.refresh_token ?? null, expiresAt: row.token_expires_at ?? null };
}

async function markConnection(admin: DB, connectionId: string, status: "expired" | "error", lastError: string) {
  const { error } = await admin.from("connections").update({ status, last_error: lastError }).eq("id", connectionId);
  if (error) console.error("[vyz] status da conexão", error.message);
}

/**
 * Access token válido de uma conexão, para a sincronização com a API real:
 * renova com o refresh token quando está para vencer (Google) e marca a
 * conexão como expirada quando não dá (a tela pede para reconectar).
 */
export async function getValidAccessToken(connectionId: string, opts: { actorId?: string | null } = {}): Promise<string> {
  const admin = createAdminSupabase({ actorId: opts.actorId });
  const { data: conn, error } = await admin.from("connections").select("id, provider, is_mock, scopes").eq("id", connectionId).maybeSingle();
  if (error) throw fromPostgrest(error);
  if (!conn) throw appError("integration:not_found");
  const tokens = await readConnectionTokens(connectionId, admin);
  if (!tokens) throw appError("integration:missing_token");
  // token colado pelo cliente (app dele): as chamadas ao Meta vão sem a prova do segredo do VYZ
  if (conn.provider === "meta" && isTokenConnection(conn.scopes)) markOwnAppToken(tokens.accessToken);

  const expiresAt = tokens.expiresAt ? Date.parse(tokens.expiresAt) : null;
  if (expiresAt === null || expiresAt - Date.now() > REFRESH_MARGIN_MS) return tokens.accessToken;

  const provider = providerForConnection({ provider: conn.provider as ProviderId, is_mock: conn.is_mock });
  if (!provider.refresh || !tokens.refreshToken) {
    if (expiresAt > Date.now()) return tokens.accessToken;
    await markConnection(admin, connectionId, "expired", "O acesso expirou. Reconecte para voltar a sincronizar.");
    throw appError("integration:expired", "A conexão expirou. Reconecte a conta para voltar a sincronizar.");
  }

  try {
    const next = await provider.refresh(tokens.refreshToken);
    const { error: saveError } = await admin.rpc("connection_tokens_save", {
      p_connection_id: connectionId,
      p_access_token: next.accessToken,
      p_refresh_token: nullable(next.refreshToken),
      p_token_expires_at: nullable(next.expiresAt),
    });
    if (saveError) throw fromPostgrest(saveError);
    return next.accessToken;
  } catch (err) {
    // Refresh recusado (revogado no provedor, senha trocada): só reconectando.
    if (err instanceof ProviderError && err.status && err.status < 500 && err.status !== 429) {
      await markConnection(admin, connectionId, "expired", "O provedor recusou a renovação do acesso. Reconecte a conta.");
      throw appError("integration:expired", "A conexão expirou. Reconecte a conta para voltar a sincronizar.");
    }
    throw err;
  }
}
