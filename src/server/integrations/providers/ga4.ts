import "server-only";

// GA4: login do Google só leitura (analytics.readonly) com o mesmo cliente
// OAuth do Google Ads, e a Admin API para listar as propriedades. Escrito pela
// documentação oficial, AINDA NÃO EXECUTADO. Para ligar: ativar a Google
// Analytics Admin API e a Data API no projeto do Cloud, pôr o escopo na tela de
// consentimento e <site>/api/integrations/ga4/callback nos redirecionamentos.
// Docs: developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/accountSummaries/list

import { fetchJson, fetchOk, form } from "./http";
import { account, bearer, clientCredentials, toTokens, type TokenResponse } from "./oauth2";
import { ProviderError, type DiscoveredAccount, type OAuthProvider } from "./types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const ADMIN = "https://analyticsadmin.googleapis.com/v1beta";
export const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const SCOPES = ["openid", "email", "profile", GA4_SCOPE];
const MAX_PAGES = 10;

type Summaries = {
  accountSummaries?: { account?: string; displayName?: string; propertySummaries?: { property?: string; displayName?: string; propertyType?: string }[] }[];
  nextPageToken?: string;
};

const creds = () => clientCredentials("ga4", "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET");

export function ga4Provider(): OAuthProvider {
  return {
    id: "ga4",
    isMock: false,
    usesPkce: true,
    authorizeUrl({ state, codeChallenge, redirectUri }) {
      const { clientId } = creds();
      if (!codeChallenge) throw new ProviderError("indisponivel", "GA4: PKCE ausente");
      const url = new URL(AUTH_URL);
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES.join(" "),
        access_type: "offline",
        prompt: "consent",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      }).toString();
      return url.toString();
    },
    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const { clientId, clientSecret } = creds();
      if (!codeVerifier) throw new ProviderError("troca_falhou", "GA4: code_verifier ausente");
      const res = await fetchJson<TokenResponse>(TOKEN_URL, {
        ...form({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: codeVerifier }),
        label: "GA4: troca do código",
      });
      const tokens = toTokens(res);
      if (!tokens.scopes.includes(GA4_SCOPE)) throw new ProviderError("permissoes_negadas", "GA4: analytics.readonly não concedido");
      return tokens;
    },
    async fetchProfile(accessToken) {
      const me = await fetchJson<{ sub: string; name?: string; email?: string }>(USERINFO_URL, { headers: bearer(accessToken), label: "GA4: perfil" });
      return { id: me.sub, name: me.name?.trim() || me.email || "Conta do Google", email: me.email };
    },
    async listAccounts(accessToken) {
      const out: DiscoveredAccount[] = [];
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const url = new URL(`${ADMIN}/accountSummaries`);
        url.searchParams.set("pageSize", "200");
        if (pageToken) url.searchParams.set("pageToken", pageToken);
        const res = await fetchJson<Summaries>(url, { headers: bearer(accessToken), label: "GA4: propriedades" });
        for (const acc of res.accountSummaries ?? []) {
          for (const p of acc.propertySummaries ?? []) {
            const id = p.property?.split("/")[1];
            if (!id || !/^\d+$/.test(id)) continue;
            out.push(
              account("ga4", id, p.displayName, {
                business_external_id: acc.account?.split("/")[1] ?? null,
                business_name: acc.displayName ?? null,
                metadata: { property: p.property ?? null, property_type: p.propertyType ?? null },
              }),
            );
          }
        }
        pageToken = res.nextPageToken;
        if (!pageToken) break;
      }
      return out;
    },
    async refresh(refreshToken) {
      const { clientId, clientSecret } = creds();
      const res = await fetchJson<TokenResponse>(TOKEN_URL, {
        ...form({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
        label: "GA4: renovação do token",
      });
      return toTokens(res);
    },
    async revoke({ accessToken, refreshToken }) {
      await fetchOk(REVOKE_URL, { ...form({ token: refreshToken ?? accessToken }), label: "GA4: revogação" });
    },
  };
}
