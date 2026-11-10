import "server-only";

// Pipedrive: OAuth 2.0 de app do Marketplace + API v1 (leitura). Escrito pela
// documentação oficial, AINDA NÃO EXECUTADO. Para ligar: app no Developer
// Hub (developers.pipedrive.com) com acesso de leitura a negócios e contatos e
// <site>/api/integrations/pipedrive/callback como callback. Variáveis:
// PIPEDRIVE_CLIENT_ID e PIPEDRIVE_CLIENT_SECRET. Token de 1 h com refresh; a
// troca usa Basic auth e devolve o api_domain da empresa.
// Docs: pipedrive.readme.io/docs/marketplace-oauth-authorization.

import { fetchJson } from "./http";
import { account, bearer, clientCredentials, toTokens, type TokenResponse } from "./oauth2";
import { ProviderError, type OAuthProvider } from "./types";

const AUTH_URL = "https://oauth.pipedrive.com/oauth/authorize";
const TOKEN_URL = "https://oauth.pipedrive.com/oauth/token";
const DEFAULT_API = "https://api.pipedrive.com";

type Me = { data?: { id: number; name?: string; email?: string; company_id?: number; company_name?: string; company_domain?: string } };

const creds = () => clientCredentials("pipedrive", "PIPEDRIVE_CLIENT_ID", "PIPEDRIVE_CLIENT_SECRET");

function tokenRequest(fields: Record<string, string>, label: string) {
  const { clientId, clientSecret } = creds();
  return fetchJson<TokenResponse & { api_domain?: string }>(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
    label,
  });
}

async function me(accessToken: string): Promise<NonNullable<Me["data"]>> {
  const res = await fetchJson<Me>(`${DEFAULT_API}/v1/users/me`, { headers: bearer(accessToken), label: "Pipedrive: perfil" });
  if (!res.data) throw new ProviderError("troca_falhou", "Pipedrive: perfil vazio");
  return res.data;
}

export function pipedriveProvider(): OAuthProvider {
  return {
    id: "pipedrive",
    isMock: false,
    usesPkce: false,
    authorizeUrl({ state, redirectUri }) {
      const { clientId } = creds();
      const url = new URL(AUTH_URL);
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, state }).toString();
      return url.toString();
    },
    async exchangeCode({ code, redirectUri }) {
      return toTokens(await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri }, "Pipedrive: troca do código"));
    },
    async fetchProfile(accessToken) {
      const u = await me(accessToken);
      return { id: String(u.id), name: u.name?.trim() || u.email || "Login do Pipedrive", email: u.email };
    },
    async listAccounts(accessToken) {
      const u = await me(accessToken);
      return [account("pipedrive", u.company_id ?? u.id, u.company_name, { metadata: { company_domain: u.company_domain ?? null } })];
    },
    async refresh(refreshToken) {
      return toTokens(await tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }, "Pipedrive: renovação do token"));
    },
  };
}
