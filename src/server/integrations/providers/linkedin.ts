import "server-only";

// LinkedIn Ads: OAuth 2.0 (3-legged) + Advertising API (REST versionada).
// Escrito pela documentação oficial, AINDA NÃO EXECUTADO. Para ligar: app em
// linkedin.com/developers com os produtos "Sign In with LinkedIn using OpenID
// Connect" e "Advertising API" aprovados, e <site>/api/integrations/linkedin/callback
// nos redirecionamentos. Variáveis: LINKEDIN_CLIENT_ID e LINKEDIN_CLIENT_SECRET.
// Token de 60 dias; refresh token só para parceiros que o LinkedIn libera.
// Docs: learn.microsoft.com/linkedin/shared/authentication/authorization-code-flow,
// .../marketing/integrations/ads/account-structure/create-and-manage-accounts.

import { fetchJson, form } from "./http";
import { account, bearer, clientCredentials, toTokens, type TokenResponse } from "./oauth2";
import { ProviderError, type OAuthProvider } from "./types";

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const API = "https://api.linkedin.com";
const VERSION = "202510";
const SCOPES = ["openid", "profile", "email", "r_ads", "r_ads_reporting"];

type AdAccount = { id: number; name?: string; currency?: string; status?: string; reference?: string };

const creds = () => clientCredentials("linkedin", "LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET");
const rest = (token: string) => bearer(token, { "LinkedIn-Version": VERSION, "X-Restli-Protocol-Version": "2.0.0" });

export function linkedinProvider(): OAuthProvider {
  return {
    id: "linkedin",
    isMock: false,
    usesPkce: false,
    authorizeUrl({ state, redirectUri }) {
      const { clientId } = creds();
      const url = new URL(AUTH_URL);
      url.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, state, scope: SCOPES.join(" ") }).toString();
      return url.toString();
    },
    async exchangeCode({ code, redirectUri }) {
      const { clientId, clientSecret } = creds();
      const res = await fetchJson<TokenResponse>(TOKEN_URL, {
        ...form({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, client_secret: clientSecret }),
        label: "LinkedIn: troca do código",
      });
      const tokens = toTokens(res, SCOPES);
      if (!tokens.scopes.includes("r_ads")) throw new ProviderError("permissoes_negadas", "LinkedIn: r_ads não concedido");
      return tokens;
    },
    async fetchProfile(accessToken) {
      const me = await fetchJson<{ sub: string; name?: string; email?: string }>(`${API}/v2/userinfo`, { headers: bearer(accessToken), label: "LinkedIn: perfil" });
      return { id: me.sub, name: me.name?.trim() || me.email || "Login do LinkedIn", email: me.email };
    },
    async listAccounts(accessToken) {
      const res = await fetchJson<{ elements?: AdAccount[] }>(`${API}/rest/adAccounts?q=search&pageSize=1000`, { headers: rest(accessToken), label: "LinkedIn: contas de anúncio" });
      return (res.elements ?? []).map((a) =>
        account("linkedin", a.id, a.name, {
          currency: a.currency,
          status: a.status === "ACTIVE" ? "active" : a.status === "CANCELED" || a.status === "REMOVED" ? "closed" : "disabled",
          metadata: { status: a.status ?? null, reference: a.reference ?? null },
        }),
      );
    },
    async refresh(refreshToken) {
      const { clientId, clientSecret } = creds();
      const res = await fetchJson<TokenResponse>(TOKEN_URL, {
        ...form({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }),
        label: "LinkedIn: renovação do token",
      });
      return toTokens(res, SCOPES);
    },
  };
}
