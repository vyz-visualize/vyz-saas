import "server-only";

// RD Station CRM: OAuth 2.0 dos apps da RD Station App Store + CRM API v2
// (leitura). Escrito pela documentação oficial, AINDA NÃO EXECUTADO. Para
// ligar: app criado na RD Station App Store (área do publisher) com acesso ao
// CRM e <site>/api/integrations/rdstation/callback como URL de callback.
// Variáveis: RDSTATION_CLIENT_ID e RDSTATION_CLIENT_SECRET. Token de 24 h com
// refresh token.
// Docs: developers.rdstation.com/reference/autenticacao, .../crm-v2.

import { fetchJson } from "./http";
import { account, bearer, clientCredentials, toTokens, type TokenResponse } from "./oauth2";
import type { OAuthProvider } from "./types";

const AUTH_URL = "https://api.rd.services/auth/dialog";
const TOKEN_URL = "https://api.rd.services/auth/token";
const CRM = "https://api.rd.services/crm/v2";

type Me = { data?: { id?: string; name?: string; email?: string; account?: { id?: string; name?: string } } } & { id?: string; name?: string; email?: string };

const creds = () => clientCredentials("rdstation", "RDSTATION_CLIENT_ID", "RDSTATION_CLIENT_SECRET");

async function me(accessToken: string) {
  const res = await fetchJson<Me>(`${CRM}/users/me`, { headers: bearer(accessToken), label: "RD Station: perfil" });
  const d = res.data ?? res;
  return { id: d.id ? String(d.id) : "rdstation", name: d.name, email: d.email, accountId: res.data?.account?.id, accountName: res.data?.account?.name };
}

function tokenRequest(body: Record<string, string>, label: string) {
  return fetchJson<TokenResponse>(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), label });
}

export function rdstationProvider(): OAuthProvider {
  return {
    id: "rdstation",
    isMock: false,
    usesPkce: false,
    authorizeUrl({ state, redirectUri }) {
      const { clientId } = creds();
      const url = new URL(AUTH_URL);
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, state }).toString();
      return url.toString();
    },
    async exchangeCode({ code }) {
      const { clientId, clientSecret } = creds();
      return toTokens(await tokenRequest({ client_id: clientId, client_secret: clientSecret, code }, "RD Station: troca do código"), ["crm"]);
    },
    async fetchProfile(accessToken) {
      const u = await me(accessToken);
      return { id: u.id, name: u.name?.trim() || u.email || "Login do RD Station", email: u.email };
    },
    async listAccounts(accessToken) {
      const u = await me(accessToken);
      return [account("rdstation", u.accountId ?? u.id, u.accountName ?? "RD Station CRM")];
    },
    async refresh(refreshToken) {
      const { clientId, clientSecret } = creds();
      return toTokens(await tokenRequest({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }, "RD Station: renovação do token"), ["crm"]);
    },
  };
}
