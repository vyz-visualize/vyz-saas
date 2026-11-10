import "server-only";

// HubSpot: OAuth 2.0 de app público + CRM API (leitura). Escrito pela
// documentação oficial, AINDA NÃO EXECUTADO. Para ligar: app público no
// portal de desenvolvedor com os escopos abaixo e
// <site>/api/integrations/hubspot/callback como redirect. Variáveis:
// HUBSPOT_CLIENT_ID e HUBSPOT_CLIENT_SECRET. Token de 30 min com refresh.
// Docs: developers.hubspot.com/docs/api/oauth-quickstart-guide.

import { fetchJson, form } from "./http";
import { account, clientCredentials, toTokens, type TokenResponse } from "./oauth2";
import type { OAuthProvider } from "./types";

const AUTH_URL = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
export const HUBSPOT_SCOPES = ["oauth", "crm.objects.contacts.read", "crm.objects.deals.read", "crm.schemas.deals.read"];

type TokenInfo = { hub_id: number; hub_domain?: string; user?: string; user_id?: number; scopes?: string[] };

const creds = () => clientCredentials("hubspot", "HUBSPOT_CLIENT_ID", "HUBSPOT_CLIENT_SECRET");
const info = (token: string) => fetchJson<TokenInfo>(`https://api.hubapi.com/oauth/v1/access-tokens/${encodeURIComponent(token)}`, { label: "HubSpot: dados do token" });

export function hubspotProvider(): OAuthProvider {
  return {
    id: "hubspot",
    isMock: false,
    usesPkce: false,
    authorizeUrl({ state, redirectUri }) {
      const { clientId } = creds();
      const url = new URL(AUTH_URL);
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: HUBSPOT_SCOPES.join(" "), state }).toString();
      return url.toString();
    },
    async exchangeCode({ code, redirectUri }) {
      const { clientId, clientSecret } = creds();
      const res = await fetchJson<TokenResponse>(TOKEN_URL, {
        ...form({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code }),
        label: "HubSpot: troca do código",
      });
      return toTokens(res, HUBSPOT_SCOPES);
    },
    async fetchProfile(accessToken) {
      const i = await info(accessToken);
      return { id: String(i.user_id ?? i.hub_id), name: i.user || `Portal ${i.hub_id}`, email: i.user && i.user.includes("@") ? i.user : undefined };
    },
    async listAccounts(accessToken) {
      const i = await info(accessToken);
      return [account("hubspot", i.hub_id, i.hub_domain, { metadata: { hub_domain: i.hub_domain ?? null } })];
    },
    async refresh(refreshToken) {
      const { clientId, clientSecret } = creds();
      const res = await fetchJson<TokenResponse>(TOKEN_URL, {
        ...form({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
        label: "HubSpot: renovação do token",
      });
      return toTokens(res, HUBSPOT_SCOPES);
    },
  };
}
