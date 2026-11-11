import "server-only";

// Provedor simulado (INTEGRATIONS_MODE=mock): o "login" é a tela
// /integracoes/simulacao/<provedor>, que devolve um código mock_. Perfil e
// contas fixos (features/integrations/mock-data.ts); os tokens são aleatórios e
// seguem o mesmo caminho dos reais (Vault).

import { MOCK_ACCOUNTS, MOCK_PROFILES } from "@/features/integrations/mock-data";
import { randomToken } from "@/features/integrations/oauth";
import { providerScopes, type ProviderId } from "@/features/integrations/providers";
import { ProviderError, type DiscoveredAccount, type OAuthProvider, type OAuthTokens } from "./types";

const MOCK_CODE = /^mock_[A-Za-z0-9_-]{16,128}$/;
const HOUR = 60 * 60 * 1000;

// Como os reais: Meta devolve token de 60 dias sem refresh; Google, 1 h com refresh.
function tokens(id: ProviderId): OAuthTokens {
  const google = id === "google";
  return {
    accessToken: `mock_at_${randomToken()}`,
    refreshToken: google ? `mock_rt_${randomToken()}` : undefined,
    expiresAt: new Date(Date.now() + (google ? HOUR : 60 * 24 * HOUR)).toISOString(),
    scopes: providerScopes(id),
  };
}

function accounts(id: ProviderId): DiscoveredAccount[] {
  return MOCK_ACCOUNTS[id].map((a) => ({
    platform_id: a.platform ?? id,
    external_id: a.externalId,
    name: a.name,
    currency: a.currency,
    timezone: a.timezone,
    status: "active",
    business_external_id: a.business?.id ?? null,
    business_name: a.business?.name ?? null,
    manager_external_id: a.manager?.id ?? null,
    metadata: { source: "mock", manager_name: a.manager?.name ?? null },
  }));
}

const isMockToken = (token: string) => token.startsWith("mock_at_");

export function mockProvider(id: ProviderId): OAuthProvider {
  return {
    id,
    isMock: true,
    usesPkce: id === "google",
    authorizeUrl({ state, redirectUri }) {
      const url = new URL(`/integracoes/simulacao/${id}`, new URL(redirectUri).origin);
      url.searchParams.set("state", state);
      return url.toString();
    },
    async exchangeCode({ code, codeVerifier }) {
      if (!MOCK_CODE.test(code)) throw new ProviderError("troca_falhou", "mock: código fora do formato");
      if (id === "google" && !codeVerifier) throw new ProviderError("troca_falhou", "mock: PKCE ausente");
      return tokens(id);
    },
    async fetchProfile(accessToken) {
      if (!isMockToken(accessToken)) throw new ProviderError("troca_falhou", "mock: token desconhecido");
      return { ...MOCK_PROFILES[id] };
    },
    async listAccounts(accessToken) {
      if (!isMockToken(accessToken)) throw new ProviderError("troca_falhou", "mock: token desconhecido");
      return accounts(id);
    },
    async refresh() {
      if (id !== "google") throw new ProviderError("troca_falhou", "mock: só o Google renova token");
      const next = tokens(id);
      return { ...next, refreshToken: undefined };
    },
    async revoke() {},
  };
}
