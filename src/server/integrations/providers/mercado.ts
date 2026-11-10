import "server-only";

// Mercado Ads (Mercado Livre): OAuth 2.0 com PKCE + API de Advertising (Product
// Ads). Escrito pela documentação oficial, AINDA NÃO EXECUTADO. Para ligar: app
// no DevCenter (developers.mercadolivre.com.br) com os escopos de leitura e
// offline_access, PKCE ligado e <site>/api/integrations/mercado/callback como
// URI de redirect. Variáveis: MERCADO_CLIENT_ID e MERCADO_CLIENT_SECRET.
// Token de 6 h com refresh token de uso único (o novo vem a cada renovação).
// Docs: developers.mercadolivre.com.br/pt_br/autenticacao-e-autorizacao,
// .../pt_br/product-ads (advertisers).

import { fetchJson, form } from "./http";
import { account, bearer, clientCredentials, toTokens, type TokenResponse } from "./oauth2";
import { ProviderError, type DiscoveredAccount, type OAuthProvider } from "./types";

const AUTH_URL = "https://auth.mercadolivre.com.br/authorization";
const API = "https://api.mercadolibre.com";

const creds = () => clientCredentials("mercado", "MERCADO_CLIENT_ID", "MERCADO_CLIENT_SECRET");

export function mercadoProvider(): OAuthProvider {
  return {
    id: "mercado",
    isMock: false,
    usesPkce: true,
    authorizeUrl({ state, codeChallenge, redirectUri }) {
      const { clientId } = creds();
      if (!codeChallenge) throw new ProviderError("indisponivel", "Mercado: PKCE ausente");
      const url = new URL(AUTH_URL);
      url.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, state, code_challenge: codeChallenge, code_challenge_method: "S256" }).toString();
      return url.toString();
    },
    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const { clientId, clientSecret } = creds();
      const res = await fetchJson<TokenResponse>(`${API}/oauth/token`, {
        ...form({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, code_verifier: codeVerifier ?? "" }),
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        label: "Mercado: troca do código",
      });
      return toTokens(res);
    },
    async fetchProfile(accessToken) {
      const me = await fetchJson<{ id: number; nickname?: string; first_name?: string; email?: string }>(`${API}/users/me`, { headers: bearer(accessToken), label: "Mercado: perfil" });
      return { id: String(me.id), name: me.nickname?.trim() || me.first_name || "Login do Mercado Livre", email: me.email };
    },
    async listAccounts(accessToken) {
      const out: DiscoveredAccount[] = [];
      try {
        const res = await fetchJson<{ advertisers?: { advertiser_id: number; site_id?: string; advertiser_name?: string; account_name?: string }[] }>(
          `${API}/advertising/advertisers?product_id=PADS`,
          { headers: bearer(accessToken, { "Api-Version": "1" }), label: "Mercado: anunciantes" },
        );
        for (const a of res.advertisers ?? []) out.push(account("mercado", a.advertiser_id, a.account_name || a.advertiser_name, { metadata: { site_id: a.site_id ?? null } }));
      } catch (err) {
        // Vendedor sem Product Ads ativo: a lista vem vazia (ou 404) e entra o próprio vendedor.
        if (!(err instanceof ProviderError) || err.code === "provedor_indisponivel") throw err;
      }
      if (out.length) return out;
      const me = await fetchJson<{ id: number; nickname?: string }>(`${API}/users/me`, { headers: bearer(accessToken), label: "Mercado: perfil" });
      return [account("mercado", me.id, me.nickname, { metadata: { seller_only: true } })];
    },
    async refresh(refreshToken) {
      const { clientId, clientSecret } = creds();
      const res = await fetchJson<TokenResponse>(`${API}/oauth/token`, {
        ...form({ grant_type: "refresh_token", client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken }),
        label: "Mercado: renovação do token",
      });
      return toTokens(res);
    },
  };
}
