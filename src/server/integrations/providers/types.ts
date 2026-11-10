import "server-only";

// Contrato de um provedor de login (OAuth) de plataforma (anúncios, GA4 e
// CRMs). Implementações: mock (simulada, sem credenciais) e uma real por
// provedor em providers/<id>.ts.

import type { ProviderId } from "@/features/integrations/providers";
import type { ConnectErrorCode } from "@/features/integrations/results";
import type { AdAccountStatus } from "@/features/integrations/types";
import type { Json } from "@/lib/supabase/database.types";

export type OAuthTokens = {
  accessToken: string;
  refreshToken?: string;
  /** ISO. Sem valor = não expira (ex.: token de usuário do sistema do Meta). */
  expiresAt?: string;
  scopes: string[];
};

export type ProviderProfile = { id: string; name: string; email?: string };

/**
 * Conta vista pelo login: uma linha de p_accounts em public.integration_connect.
 * IDs no formato do cadastro manual (Meta: act_<dígitos>; Google: 123-456-7890),
 * para a conta conectada casar com a cadastrada pelo ID.
 */
export type DiscoveredAccount = {
  platform_id: string;
  external_id: string;
  name: string;
  currency?: string;
  timezone?: string;
  status?: AdAccountStatus;
  business_external_id?: string | null;
  business_name?: string | null;
  manager_external_id?: string | null;
  metadata?: { [key: string]: Json | undefined };
};

export interface OAuthProvider {
  readonly id: ProviderId;
  /** Simulado (INTEGRATIONS_MODE=mock). */
  readonly isMock: boolean;
  /** Exige PKCE (S256) no início do login. */
  readonly usesPkce: boolean;
  /** Para onde mandar o usuário dar o consentimento. */
  authorizeUrl(input: { state: string; codeChallenge?: string; redirectUri: string }): string;
  exchangeCode(input: { code: string; codeVerifier?: string; redirectUri: string; /** Parâmetros do retorno (ex.: referer do Kommo). */ params?: URLSearchParams }): Promise<OAuthTokens>;
  fetchProfile(accessToken: string): Promise<ProviderProfile>;
  listAccounts(accessToken: string): Promise<DiscoveredAccount[]>;
  /** Novo access token a partir do refresh token (Google). */
  refresh?(refreshToken: string): Promise<OAuthTokens>;
  /** Revoga o acesso no provedor ao desconectar (melhor esforço). */
  revoke?(tokens: { accessToken: string; refreshToken: string | null }): Promise<void>;
}

/**
 * Falha do provedor. `code` vai para a URL de volta (?erro=); a mensagem só
 * para o log do servidor e nunca leva token, código de autorização ou URL.
 */
export class ProviderError extends Error {
  constructor(
    readonly code: ConnectErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
