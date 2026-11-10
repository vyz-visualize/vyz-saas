import "server-only";

// Kommo: OAuth 2.0 de integração pública + API v4 (leitura). O retorno traz o
// subdomínio da conta (referer) e a troca do código é feita nele. Escrito pela
// documentação oficial, AINDA NÃO EXECUTADO. Para ligar: integração criada em
// Configurações > Integrações > Criar integração (conta de desenvolvedor), com
// <site>/api/integrations/kommo/callback como URL de redirecionamento e acesso
// a "dados da conta". Variáveis: KOMMO_CLIENT_ID e KOMMO_CLIENT_SECRET. Token
// de 24 h com refresh de 3 meses (uso único).
//
// A renovação precisa do domínio da conta; para não depender de outra coluna,
// o refresh token é guardado (no Vault) como "<dominio>|<token>".
// Docs: developers.kommo.com/docs/oauth-20.

import { fetchJson } from "./http";
import { account, bearer, clientCredentials, toTokens, type TokenResponse } from "./oauth2";
import { ProviderError, type OAuthProvider, type OAuthTokens } from "./types";

const AUTH_URL = "https://www.kommo.com/oauth";
const DOMAIN = /^[a-z0-9-]+\.(kommo\.com|amocrm\.com|amocrm\.ru)$/;

const creds = () => clientCredentials("kommo", "KOMMO_CLIENT_ID", "KOMMO_CLIENT_SECRET");

/** Só aceita subdomínios do Kommo: o código nunca vai para um host qualquer. */
export function kommoDomain(raw: string | null | undefined): string {
  const host = (raw ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!DOMAIN.test(host)) throw new ProviderError("troca_falhou", "Kommo: domínio da conta inválido");
  return host;
}

/** O token de acesso também leva o domínio ("<dominio>|<token>"): as chamadas precisam dele. */
const split = (packed: string) => {
  const i = packed.indexOf("|");
  if (i < 0) throw new ProviderError("troca_falhou", "Kommo: token sem domínio");
  return { domain: kommoDomain(packed.slice(0, i)), token: packed.slice(i + 1) };
};
const pack = (domain: string, tokens: OAuthTokens): OAuthTokens => ({
  ...tokens,
  accessToken: `${domain}|${tokens.accessToken}`,
  refreshToken: tokens.refreshToken ? `${domain}|${tokens.refreshToken}` : undefined,
});

async function tokenRequest(domain: string, body: Record<string, string>, label: string) {
  const { clientId, clientSecret } = creds();
  const res = await fetchJson<TokenResponse>(`https://${domain}/oauth2/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...body }),
    label,
  });
  return pack(domain, toTokens(res, ["crm"]));
}

async function accountInfo(packed: string) {
  const { domain, token } = split(packed);
  return fetchJson<{ id: number; name?: string; subdomain?: string; currency?: string }>(`https://${domain}/api/v4/account`, { headers: bearer(token), label: "Kommo: conta" });
}

export function kommoProvider(): OAuthProvider {
  return {
    id: "kommo",
    isMock: false,
    usesPkce: false,
    authorizeUrl({ state }) {
      const { clientId } = creds();
      const url = new URL(AUTH_URL);
      url.search = new URLSearchParams({ client_id: clientId, state, mode: "post_message" }).toString();
      return url.toString();
    },
    async exchangeCode({ code, redirectUri, params }) {
      const domain = kommoDomain(params?.get("referer"));
      return tokenRequest(domain, { grant_type: "authorization_code", code, redirect_uri: redirectUri }, "Kommo: troca do código");
    },
    async fetchProfile(accessToken) {
      const a = await accountInfo(accessToken);
      return { id: String(a.id), name: a.name?.trim() || a.subdomain || "Conta do Kommo" };
    },
    async listAccounts(accessToken) {
      const a = await accountInfo(accessToken);
      return [account("kommo", a.subdomain || a.id, a.name, { currency: a.currency, metadata: { account_id: a.id } })];
    },
    async refresh(packedRefresh) {
      const { domain, token } = split(packedRefresh);
      const { redirectUriFor } = await import("./redirect");
      return tokenRequest(domain, { grant_type: "refresh_token", refresh_token: token, redirect_uri: await redirectUriFor("kommo") }, "Kommo: renovação do token");
    },
  };
}
