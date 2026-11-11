import "server-only";

// Meta Ads: Facebook Login for Business (fluxo manual com config_id) + Graph
// API. Escrito pela documentação oficial (Graph API v26.0, de 29/07/2026), mas
// AINDA NÃO EXECUTADO contra o Meta. Falta, para ligar (INTEGRATIONS_MODE=live):
//   - app do Meta (tipo Empresa) em modo ativo, com ads_read, ads_management (para o
//     botão Aplicar das otimizações) e
//     business_management aprovados na Análise do App;
//   - uma configuração do Login for Business (META_LOGIN_CONFIG_ID) com essas
//     permissões e os ativos "Contas de anúncio". Recomendado: token de usuário
//     do sistema (não expira, uso servidor-servidor). Com token de usuário, o
//     código abaixo troca pelo de 60 dias e a conexão precisa de reconexão
//     antes de vencer (connections.token_expires_at);
//   - <site>/api/integrations/meta/callback em "URIs de redirecionamento do
//     OAuth válidos" e, de preferência, "Exigir segredo do app" ligado (toda
//     chamada com token leva appsecret_proof).
// Docs: developers.facebook.com/docs/facebook-login/facebook-login-for-business,
// .../facebook-login/guides/advanced/manual-flow,
// .../facebook-login/guides/access-tokens/get-long-lived,
// .../marketing-api/reference/ad-account.

import { createHmac } from "node:crypto";
import { serverEnv } from "@/server/env";
import { fetchJson } from "./http";
import { ProviderError, type DiscoveredAccount, type OAuthProvider } from "./types";

const VERSION = "v26.0";
const DIALOG_URL = `https://www.facebook.com/${VERSION}/dialog/oauth`;
const GRAPH = `https://graph.facebook.com/${VERSION}`;
const PAGE_SIZE = "100";
const MAX_PAGES = 20;
// Abaixo disso o token é o curto (1 a 2 h): vale trocar pelo de 60 dias.
const SHORT_LIVED_SECONDS = 7 * 24 * 60 * 60;
const AD_ACCOUNT_FIELDS = "id,account_id,name,currency,timezone_name,account_status,disable_reason,business{id,name}";

type TokenResponse = { access_token: string; token_type?: string; expires_in?: number };
type DebugToken = { data?: { app_id?: string; is_valid?: boolean; scopes?: string[]; expires_at?: number } };
type GraphPage<T> = { data?: T[]; paging?: { cursors?: { after?: string }; next?: string } };
type MetaPage = {
  id: string;
  name?: string;
  instagram_business_account?: { id: string; username?: string; name?: string };
};
// Páginas que o login enxerga e o Instagram profissional ligado a cada uma (orgânico).
const PAGE_FIELDS = "id,name,instagram_business_account{id,username,name}";
type MetaAdAccount = {
  id: string;
  account_id: string;
  name?: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
  disable_reason?: number;
  business?: { id: string; name?: string };
};

function credentials() {
  const env = serverEnv();
  if (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_LOGIN_CONFIG_ID) {
    throw new ProviderError("nao_configurado", "Meta: faltam META_APP_ID, META_APP_SECRET ou META_LOGIN_CONFIG_ID");
  }
  return { appId: env.META_APP_ID, appSecret: env.META_APP_SECRET, configId: env.META_LOGIN_CONFIG_ID };
}

/** appsecret_proof: HMAC-SHA256 do token com o segredo do app. */
const appSecretProof = (token: string, secret: string) => createHmac("sha256", secret).update(token).digest("hex");

/** Chamada à Graph API com o token do usuário (e a prova do segredo do app). Também usada pelas otimizações. */
export function graph<T>(path: string, params: Record<string, string>, accessToken: string, label: string, method = "GET"): Promise<T> {
  const { appSecret } = credentials();
  const url = new URL(`${GRAPH}${path}`);
  url.search = new URLSearchParams({ ...params, access_token: accessToken, appsecret_proof: appSecretProof(accessToken, appSecret) }).toString();
  return fetchJson<T>(url, { method, label });
}

// account_status do Meta: 1 ACTIVE, 2 DISABLED, 3 UNSETTLED, 7 PENDING_RISK_REVIEW,
// 8 PENDING_SETTLEMENT, 9 IN_GRACE_PERIOD, 100 PENDING_CLOSURE, 101 CLOSED.
function accountStatus(code: number | undefined): DiscoveredAccount["status"] {
  if (code === 1 || code === 9) return "active";
  if (code === 100 || code === 101) return "closed";
  return "disabled";
}

/** Página do Facebook e o Instagram ligado a ela viram contas próprias (orgânico). Cada uma conta 1 no plano. */
export function pageAccounts(p: MetaPage): DiscoveredAccount[] {
  const out: DiscoveredAccount[] = [
    {
      platform_id: "facebook",
      external_id: p.id,
      name: (p.name?.trim() || `Página ${p.id}`).slice(0, 200),
      currency: "BRL",
      timezone: "America/Sao_Paulo",
      status: "active",
      business_external_id: null,
      business_name: null,
      manager_external_id: null,
      metadata: { source: "meta" },
    },
  ];
  const ig = p.instagram_business_account;
  if (ig?.id) {
    const handle = ig.username?.trim();
    out.push({
      platform_id: "instagram",
      external_id: ig.id,
      name: (handle ? `@${handle}` : ig.name?.trim() || `Instagram ${ig.id}`).slice(0, 200),
      currency: "BRL",
      timezone: "America/Sao_Paulo",
      status: "active",
      business_external_id: null,
      business_name: null,
      // a Página a que o perfil está ligado (é por ela que a API chega no Instagram)
      manager_external_id: p.id,
      metadata: { source: "meta", page_id: p.id, page_name: p.name ?? null },
    });
  }
  return out;
}

function toAccount(a: MetaAdAccount): DiscoveredAccount {
  const digits = a.account_id || a.id.replace(/^act_/, "");
  return {
    platform_id: "meta",
    external_id: `act_${digits}`,
    name: (a.name?.trim() || `Conta ${digits}`).slice(0, 200),
    currency: a.currency && /^[A-Z]{3}$/.test(a.currency) ? a.currency : "BRL",
    timezone: a.timezone_name || "America/Sao_Paulo",
    status: accountStatus(a.account_status),
    business_external_id: a.business?.id ?? null,
    business_name: a.business?.name ?? null,
    manager_external_id: null,
    metadata: { source: "meta", account_status: a.account_status ?? null, disable_reason: a.disable_reason ?? null },
  };
}

export function metaProvider(): OAuthProvider {
  return {
    id: "meta",
    isMock: false,
    usesPkce: false,
    authorizeUrl({ state, redirectUri }) {
      const { appId, configId } = credentials();
      const url = new URL(DIALOG_URL);
      // As permissões vêm da configuração (config_id); a doc recomenda não mandar scope.
      url.search = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        state,
        config_id: configId,
        response_type: "code",
        // Obrigatório quando a configuração emite token de usuário do sistema.
        override_default_response_type: "true",
      }).toString();
      return url.toString();
    },

    async exchangeCode({ code, redirectUri }) {
      const { appId, appSecret } = credentials();
      // O redirect_uri precisa ser idêntico ao do início do login.
      const exchange = new URL(`${GRAPH}/oauth/access_token`);
      exchange.search = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }).toString();
      let token = await fetchJson<TokenResponse>(exchange, { label: "Meta: troca do código" });

      if (token.expires_in && token.expires_in < SHORT_LIVED_SECONDS) {
        const long = new URL(`${GRAPH}/oauth/access_token`);
        long.search = new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: token.access_token }).toString();
        token = await fetchJson<TokenResponse>(long, { label: "Meta: token de 60 dias" });
      }

      // Confere que o token é deste app e lê as permissões concedidas.
      const debug = new URL(`${GRAPH}/debug_token`);
      debug.search = new URLSearchParams({ input_token: token.access_token, access_token: `${appId}|${appSecret}` }).toString();
      const info = (await fetchJson<DebugToken>(debug, { label: "Meta: conferência do token" })).data;
      if (!info?.is_valid || info.app_id !== appId) throw new ProviderError("troca_falhou", "Meta: token inválido ou de outro app");
      const scopes = info.scopes ?? [];
      // basta um dos dois mundos: anúncios (ads_read) ou orgânico (Páginas e Instagram)
      const ads = scopes.includes("ads_read") || scopes.includes("ads_management");
      const organic = scopes.includes("pages_show_list") || scopes.includes("instagram_basic");
      if (!ads && !organic) throw new ProviderError("permissoes_negadas", "Meta: nem ads_read nem pages_show_list concedidos");

      // expires_at = 0 → não expira (token de usuário do sistema).
      const expiresAt = info.expires_at
        ? new Date(info.expires_at * 1000).toISOString()
        : token.expires_in
          ? new Date(Date.now() + token.expires_in * 1000).toISOString()
          : undefined;
      return { accessToken: token.access_token, expiresAt, scopes };
    },

    async fetchProfile(accessToken) {
      // Com token de usuário do sistema, "me" é o usuário do sistema da integração.
      const me = await graph<{ id: string; name?: string }>("/me", { fields: "id,name" }, accessToken, "Meta: perfil");
      return { id: me.id, name: me.name?.trim() || "Login do Meta" };
    },

    async listAccounts(accessToken) {
      const out: DiscoveredAccount[] = [];
      let after: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await graph<GraphPage<MetaAdAccount>>(
          "/me/adaccounts",
          { fields: AD_ACCOUNT_FIELDS, limit: PAGE_SIZE, ...(after ? { after } : {}) },
          accessToken,
          "Meta: contas de anúncio",
        );
        for (const a of res.data ?? []) if (a?.id) out.push(toAccount(a));
        // Segue pelo cursor (não pela URL "next": ela não leva o appsecret_proof).
        after = res.paging?.next ? res.paging.cursors?.after : undefined;
        if (!after) break;
      }
      // Orgânico: Páginas e o Instagram ligado a cada uma. Sem a permissão (login antigo ou
      // só de anúncios), o Meta recusa: a lista segue só com as contas de anúncio.
      try {
        let cursor: string | undefined;
        for (let page = 0; page < MAX_PAGES; page++) {
          const res = await graph<GraphPage<MetaPage>>("/me/accounts", { fields: PAGE_FIELDS, limit: PAGE_SIZE, ...(cursor ? { after: cursor } : {}) }, accessToken, "Meta: Páginas");
          for (const pg of res.data ?? []) if (pg?.id) out.push(...pageAccounts(pg));
          cursor = res.paging?.next ? res.paging.cursors?.after : undefined;
          if (!cursor) break;
        }
      } catch (err) {
        if (!(err instanceof ProviderError) || (err.status ?? 500) >= 500) throw err;
      }
      return out;
    },

    async revoke({ accessToken }) {
      // Tira todas as permissões do app para este login (token de usuário).
      // Token de usuário do sistema só sai quando a empresa remove a integração
      // no Business Manager: aqui a chamada falha e quem chama segue.
      await graph<{ success?: boolean }>("/me/permissions", {}, accessToken, "Meta: revogação", "DELETE");
    },
  };
}
