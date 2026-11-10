import "server-only";

// RD Station CRM: OAuth 2.0 dos apps da RD Station App Store + CRM API v2
// (leitura). Endpoints conferidos na documentação do CRM v2 em 10/11/2026:
//   autorização: https://accounts.rdstation.com/oauth/authorize (response_type=code)
//   token e renovação: POST https://api.rd.services/oauth2/token (form)
// Token de 2 h com refresh token. App "Vyzualize" (id 45893) criado na App Store
// com a conta suporte@vyzualize.com.br; callback <site>/api/integrations/rdstation/callback.
// Variáveis: RDSTATION_CLIENT_ID e RDSTATION_CLIENT_SECRET.
//
// O CRM v2 não tem "usuário atual": o perfil sai das claims do token (JWT),
// quando houver, ou do primeiro usuário da conta (/crm/v2/users).
// Docs: developers.rdstation.com/reference/crm-v2-authentication-step-2 a 4.

import { fetchJson, form } from "./http";
import { account, bearer, clientCredentials, toTokens, type TokenResponse } from "./oauth2";
import type { OAuthProvider } from "./types";

const AUTH_URL = "https://accounts.rdstation.com/oauth/authorize";
const TOKEN_URL = "https://api.rd.services/oauth2/token";
const CRM = "https://api.rd.services/crm/v2";

type User = { id?: string | number; name?: string; email?: string };
type Claims = { sub?: string; account_id?: string | number; instance_id?: string | number; tenant_id?: string | number; email?: string; name?: string };

const creds = () => clientCredentials("rdstation", "RDSTATION_CLIENT_ID", "RDSTATION_CLIENT_SECRET");

/** Claims do access token, se for um JWT (sem verificar assinatura: só para identificar a conta). */
function claims(token: string): Claims {
  const part = token.split(".")[1];
  if (!part) return {};
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Claims;
  } catch {
    return {};
  }
}

async function firstUser(accessToken: string): Promise<User> {
  const res = await fetchJson<{ data?: User[] }>(`${CRM}/users?page[size]=1`, { headers: bearer(accessToken), label: "RD Station: usuários" });
  return res.data?.[0] ?? {};
}

async function identity(accessToken: string) {
  const c = claims(accessToken);
  const u = c.sub && (c.email || c.name) ? {} : await firstUser(accessToken);
  const accountId = c.account_id ?? c.instance_id ?? c.tenant_id;
  const userId = c.sub ?? (u.id !== undefined ? String(u.id) : undefined);
  return {
    userId: userId ?? `rd-${String(accountId ?? "conta")}`,
    name: c.name || u.name,
    email: c.email || u.email,
    accountId: accountId !== undefined ? String(accountId) : (userId ?? "rdstation"),
  };
}

export function rdstationProvider(): OAuthProvider {
  return {
    id: "rdstation",
    isMock: false,
    usesPkce: false,
    authorizeUrl({ state, redirectUri }) {
      const { clientId } = creds();
      const url = new URL(AUTH_URL);
      url.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, state }).toString();
      return url.toString();
    },
    async exchangeCode({ code, redirectUri }) {
      const { clientId, clientSecret } = creds();
      const res = await fetchJson<TokenResponse>(TOKEN_URL, {
        ...form({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code" }),
        label: "RD Station: troca do código",
      });
      return toTokens(res, ["crm"]);
    },
    async fetchProfile(accessToken) {
      const me = await identity(accessToken);
      return { id: me.userId, name: me.name?.trim() || me.email || "Login do RD Station", email: me.email };
    },
    async listAccounts(accessToken) {
      const me = await identity(accessToken);
      return [account("rdstation", me.accountId, "RD Station CRM")];
    },
    async refresh(refreshToken) {
      const { clientId, clientSecret } = creds();
      const res = await fetchJson<TokenResponse>(TOKEN_URL, {
        ...form({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
        label: "RD Station: renovação do token",
      });
      return toTokens(res, ["crm"]);
    },
  };
}
