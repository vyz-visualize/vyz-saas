import "server-only";

// TikTok Ads: autorização do anunciante (TikTok API for Business v1.3). O
// retorno traz auth_code (não code) e o token não expira. Escrito pela
// documentação oficial, AINDA NÃO EXECUTADO. Para ligar: app de anunciante
// aprovado em business-api.tiktok.com com Ad Account Management, Ads
// Management e Reporting, e <site>/api/integrations/tiktok/callback como
// "Advertiser redirect URL". Variáveis: TIKTOK_APP_ID e TIKTOK_APP_SECRET.
// Docs: business-api.tiktok.com/portal/docs?id=1738373164380162 (Authorization).

import { fetchJson } from "./http";
import { account, clientCredentials } from "./oauth2";
import { ProviderError, type OAuthProvider } from "./types";

const PORTAL = "https://business-api.tiktok.com/portal/auth";
const API = "https://business-api.tiktok.com/open_api/v1.3";

type Envelope<T> = { code: number; message?: string; data?: T };

const creds = () => {
  const { clientId, clientSecret } = clientCredentials("tiktok", "TIKTOK_APP_ID", "TIKTOK_APP_SECRET");
  return { appId: clientId, secret: clientSecret };
};

/** A API responde 200 com code != 0 quando recusa. */
function data<T>(res: Envelope<T>, label: string): T {
  if (res.code !== 0 || !res.data) throw new ProviderError("troca_falhou", `${label}: code=${res.code}`);
  return res.data;
}

export function tiktokProvider(): OAuthProvider {
  return {
    id: "tiktok",
    isMock: false,
    usesPkce: false,
    authorizeUrl({ state, redirectUri }) {
      const { appId } = creds();
      const url = new URL(PORTAL);
      url.search = new URLSearchParams({ app_id: appId, state, redirect_uri: redirectUri }).toString();
      return url.toString();
    },
    async exchangeCode({ code }) {
      const { appId, secret } = creds();
      const res = await fetchJson<Envelope<{ access_token: string; scope?: number[]; advertiser_ids?: string[] }>>(`${API}/oauth2/access_token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: appId, secret, auth_code: code }),
        label: "TikTok: troca do código",
      });
      const d = data(res, "TikTok: troca do código");
      return { accessToken: d.access_token, scopes: (d.scope ?? []).map(String) };
    },
    async fetchProfile(accessToken) {
      const res = await fetchJson<Envelope<{ core_user_id?: string; display_name?: string; email?: string }>>(`${API}/user/info/`, {
        headers: { "Access-Token": accessToken },
        label: "TikTok: perfil",
      });
      const d = data(res, "TikTok: perfil");
      return { id: String(d.core_user_id ?? "tiktok"), name: d.display_name?.trim() || "Login do TikTok", email: d.email || undefined };
    },
    async listAccounts(accessToken) {
      const { appId, secret } = creds();
      const url = new URL(`${API}/oauth2/advertiser/get/`);
      url.search = new URLSearchParams({ app_id: appId, secret }).toString();
      const res = await fetchJson<Envelope<{ list?: { advertiser_id: string | number; advertiser_name?: string }[] }>>(url, {
        headers: { "Access-Token": accessToken },
        label: "TikTok: contas de anúncio",
      });
      return (data(res, "TikTok: contas de anúncio").list ?? []).map((a) => account("tiktok", a.advertiser_id, a.advertiser_name));
    },
  };
}
