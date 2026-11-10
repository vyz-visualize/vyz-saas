import "server-only";

// Google Ads: OAuth 2.0 para apps web (código + PKCE S256, access_type=offline)
// e Google Ads API (REST). Escrito pela documentação oficial (Google Ads API
// v26, de 14/10/2026; endpoints do discovery do Google), mas AINDA NÃO
// EXECUTADO contra o Google. Falta, para ligar (INTEGRATIONS_MODE=live):
//   - cliente OAuth "Aplicativo da Web" no Google Cloud (GOOGLE_OAUTH_CLIENT_ID
//     e _SECRET) com <site>/api/integrations/google/callback como URI de
//     redirecionamento autorizado, e a Google Ads API ativada no projeto;
//   - tela de consentimento publicada e verificada para o escopo restrito
//     .../auth/adwords (sem isso só usuários de teste conseguem entrar);
//   - nível de acesso da Google Ads API no projeto do Cloud (Exploração ou
//     acima; o de teste só enxerga contas de teste). O developer token é
//     opcional (GOOGLE_ADS_DEVELOPER_TOKEN), só para quem ainda usa.
// Docs: developers.google.com/identity/protocols/oauth2/web-server,
// .../identity/protocols/oauth2/native-app (PKCE),
// .../google-ads/api/docs/account-management/listing-accounts,
// .../google-ads/api/docs/account-management/get-account-hierarchy,
// .../google-ads/api/rest/auth.

import { serverEnv } from "@/server/env";
import { fetchJson, fetchOk, form } from "./http";
import { ProviderError, type DiscoveredAccount, type OAuthProvider, type OAuthTokens } from "./types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const ADS = "https://googleads.googleapis.com/v26";
const ADWORDS_SCOPE = "https://www.googleapis.com/auth/adwords";
const SCOPES = ["openid", "email", "profile", ADWORDS_SCOPE];
const MAX_ROOTS = 50;
const MAX_PAGES = 5;

// Hierarquia inteira abaixo de cada conta acessível (com login-customer-id = ela):
// a linha de nível 0 é a própria conta; as de baixo, as contas que ela administra.
const HIERARCHY_QUERY = `SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code,
  customer_client.time_zone, customer_client.manager, customer_client.status, customer_client.level, customer_client.test_account
  FROM customer_client`;

type TokenResponse = { access_token: string; expires_in?: number; refresh_token?: string; scope?: string; token_type?: string };
type UserInfo = { sub: string; name?: string; email?: string };
// JSON da API REST: int64 vem como string; valores padrão (false, 0) são omitidos.
type CustomerClient = {
  id?: string;
  descriptiveName?: string;
  currencyCode?: string;
  timeZone?: string;
  manager?: boolean;
  status?: string;
  level?: string;
  testAccount?: boolean;
};
type SearchResponse = { results?: { customerClient?: CustomerClient }[]; nextPageToken?: string };

function credentials() {
  const env = serverEnv();
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    throw new ProviderError("nao_configurado", "Google: faltam GOOGLE_OAUTH_CLIENT_ID ou GOOGLE_OAUTH_CLIENT_SECRET");
  }
  return { clientId: env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET };
}

/**
 * Cabeçalhos da Google Ads API. O acesso agora é do projeto do Google Cloud
 * (níveis gerenciados no Cloud, sem developer token): o developer-token só vai
 * se GOOGLE_ADS_DEVELOPER_TOKEN estiver definido (contas antigas).
 * Docs: developers.google.com/google-ads/api/docs/concepts/no-developer-token
 */
export function adsHeaders(accessToken: string, extra: Record<string, string> = {}): Record<string, string> {
  const token = serverEnv().GOOGLE_ADS_DEVELOPER_TOKEN;
  return { Authorization: `Bearer ${accessToken}`, ...(token ? { "developer-token": token } : {}), ...extra };
}

/** 1234567890 → 123-456-7890 (formato do cadastro manual). */
const dashed = (id: string) => `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}`;

function toTokens(res: TokenResponse): OAuthTokens {
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token,
    expiresAt: res.expires_in ? new Date(Date.now() + res.expires_in * 1000).toISOString() : undefined,
    scopes: (res.scope ?? "").split(" ").filter(Boolean),
  };
}

// CustomerStatus: ENABLED, CANCELED (admin reativa), SUSPENDED (só o suporte), CLOSED.
function accountStatus(status: string | undefined): DiscoveredAccount["status"] {
  if (status === "ENABLED") return "active";
  if (status === "CLOSED") return "closed";
  return "disabled";
}

async function search(customerId: string, query: string, headers: Record<string, string>): Promise<CustomerClient[]> {
  const rows: CustomerClient[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchJson<SearchResponse>(`${ADS}/customers/${customerId}/googleAds:search`, {
      method: "POST",
      // Consultando os clientes de um MCC, o login-customer-id é o próprio MCC (sem hífens).
      headers: { ...headers, "login-customer-id": customerId, "Content-Type": "application/json" },
      body: JSON.stringify(pageToken ? { query, pageToken } : { query }),
      label: "Google: hierarquia de contas",
    });
    for (const r of res.results ?? []) if (r.customerClient) rows.push(r.customerClient);
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }
  return rows;
}

export function googleProvider(): OAuthProvider {
  return {
    id: "google",
    isMock: false,
    usesPkce: true,
    authorizeUrl({ state, codeChallenge, redirectUri }) {
      const { clientId } = credentials();
      if (!codeChallenge) throw new ProviderError("indisponivel", "Google: PKCE ausente");
      const url = new URL(AUTH_URL);
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES.join(" "),
        // refresh token para a sincronização agendada; "consent" garante um novo a cada reconexão
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      }).toString();
      return url.toString();
    },

    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const { clientId, clientSecret } = credentials();
      if (!codeVerifier) throw new ProviderError("troca_falhou", "Google: code_verifier ausente");
      const res = await fetchJson<TokenResponse>(TOKEN_URL, {
        ...form({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: codeVerifier }),
        label: "Google: troca do código",
      });
      const tokens = toTokens(res);
      // Com o consentimento granular, o usuário pode desmarcar o Google Ads.
      if (!tokens.scopes.includes(ADWORDS_SCOPE)) throw new ProviderError("permissoes_negadas", "Google: escopo adwords não concedido");
      return tokens;
    },

    async fetchProfile(accessToken) {
      const me = await fetchJson<UserInfo>(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` }, label: "Google: perfil" });
      return { id: me.sub, name: me.name?.trim() || me.email || "Conta do Google", email: me.email };
    },

    async listAccounts(accessToken) {
      const headers = adsHeaders(accessToken);
      // Só as contas que o login acessa direto (ignora login-customer-id).
      const list = await fetchJson<{ resourceNames?: string[] }>(`${ADS}/customers:listAccessibleCustomers`, { headers, label: "Google: contas acessíveis" });
      const roots = (list.resourceNames ?? [])
        .map((r) => r.split("/")[1] ?? "")
        .filter((id) => /^\d{10}$/.test(id))
        .slice(0, MAX_ROOTS);

      const found = new Map<string, DiscoveredAccount>();
      for (const root of roots) {
        let rows: CustomerClient[];
        try {
          rows = await search(root, HIERARCHY_QUERY, headers);
        } catch (err) {
          // Conta acessível que não abre na API (cancelada, sem permissão) não derruba a lista.
          if (err instanceof ProviderError && err.status && err.status < 500 && err.status !== 429) continue;
          throw err;
        }
        const self = rows.find((c) => Number(c.level ?? 0) === 0);
        const viaManager = self?.manager === true;
        for (const c of rows) {
          // MCCs não têm métricas; entram só as contas de anúncio.
          if (!c.id || c.manager === true || found.has(c.id)) continue;
          found.set(c.id, {
            platform_id: "google",
            external_id: dashed(c.id),
            name: (c.descriptiveName?.trim() || `Conta ${dashed(c.id)}`).slice(0, 200),
            currency: c.currencyCode && /^[A-Z]{3}$/.test(c.currencyCode) ? c.currencyCode : "BRL",
            timezone: c.timeZone || "America/Sao_Paulo",
            status: accountStatus(c.status),
            business_external_id: null,
            business_name: null,
            manager_external_id: viaManager ? dashed(root) : null,
            // login_customer_id: cabeçalho que a sincronização usa para ler esta conta.
            metadata: {
              source: "google",
              customer_id: c.id,
              login_customer_id: viaManager ? root : c.id,
              manager_name: viaManager ? (self?.descriptiveName ?? null) : null,
              test_account: c.testAccount === true,
            },
          });
        }
      }
      return [...found.values()];
    },

    async refresh(refreshToken) {
      const { clientId, clientSecret } = credentials();
      const res = await fetchJson<TokenResponse>(TOKEN_URL, {
        ...form({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
        label: "Google: renovação do token",
      });
      return toTokens(res);
    },

    async revoke({ accessToken, refreshToken }) {
      // Revogar o refresh token derruba também os access tokens dele.
      await fetchOk(REVOKE_URL, { ...form({ token: refreshToken ?? accessToken }), label: "Google: revogação" });
    },
  };
}
