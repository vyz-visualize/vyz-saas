import "server-only";

// Peças comuns aos logins OAuth 2.0 "padrão" (código de autorização + troca no
// servidor): credenciais por variável de ambiente, resposta de token e o
// formato das contas vistas pelo login. Usado pelos provedores além de Meta e
// Google (GA4, TikTok, LinkedIn, Mercado Livre e os CRMs).

import type { ProviderId } from "@/features/integrations/providers";
import { serverEnv, type ServerEnv } from "@/server/env";
import { ProviderError, type DiscoveredAccount, type OAuthTokens } from "./types";

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number | string;
  scope?: string | string[];
  token_type?: string;
};

type EnvKey = keyof ServerEnv;

/** Client id e secret de um provedor; sem eles a conexão avisa "não configurado". */
export function clientCredentials(provider: ProviderId, idKey: EnvKey, secretKey: EnvKey): { clientId: string; clientSecret: string } {
  const env = serverEnv();
  const clientId = env[idKey];
  const clientSecret = env[secretKey];
  if (typeof clientId !== "string" || !clientId || typeof clientSecret !== "string" || !clientSecret) {
    throw new ProviderError("nao_configurado", `${provider}: faltam ${String(idKey)} ou ${String(secretKey)}`);
  }
  return { clientId, clientSecret };
}

/** Resposta de token (RFC 6749) no formato do VYZ. */
export function toTokens(res: TokenResponse, fallbackScopes: string[] = []): OAuthTokens {
  if (!res?.access_token) throw new ProviderError("troca_falhou", "token ausente na resposta");
  const seconds = Number(res.expires_in);
  const scopes = Array.isArray(res.scope) ? res.scope : (res.scope ?? "").split(/[\s,]+/).filter(Boolean);
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token || undefined,
    expiresAt: Number.isFinite(seconds) && seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : undefined,
    scopes: scopes.length ? scopes : fallbackScopes,
  };
}

export const bearer = (token: string, extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${token}`, ...extra });

/** Conta vista pelo login, com os padrões do cadastro (BRL, São Paulo, ativa). */
export function account(platformId: string, externalId: string | number, name: string | undefined, extra: Partial<DiscoveredAccount> = {}): DiscoveredAccount {
  const id = String(externalId);
  return {
    platform_id: platformId,
    external_id: id.slice(0, 64),
    name: (name?.trim() || `Conta ${id}`).slice(0, 200),
    currency: extra.currency && /^[A-Z]{3}$/.test(extra.currency) ? extra.currency : "BRL",
    timezone: extra.timezone || "America/Sao_Paulo",
    status: extra.status ?? "active",
    business_external_id: extra.business_external_id ?? null,
    business_name: extra.business_name ?? null,
    manager_external_id: extra.manager_external_id ?? null,
    metadata: { source: platformId, ...(extra.metadata ?? {}) },
  };
}
