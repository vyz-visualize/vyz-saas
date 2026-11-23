import "server-only";

// Conexão por token (opção secundária ao login): confere o que o cliente colou e devolve o
// que a conexão grava (saveConnection, o mesmo caminho do login). As mensagens de erro vão
// para a tela, então dizem o que fazer e em que passo do tutorial; nunca levam o token.
// O perfil leva o prefixo "token:" para não substituir um login da mesma pessoa.

import type { ProviderId } from "@/features/integrations/providers";
import { cleanToken, jwtExpiry, metaTokenProblem, tiktokAuthCode, TOKEN_SCOPE } from "@/features/integrations/token-connect";
import { AppError, appError } from "@/server/supabase/errors";
import { markOwnAppToken } from "./meta-auth";
import { GA4_SCOPE, ga4Provider } from "./providers/ga4";
import { packServiceAccount, parseServiceAccountKey, serviceAccountTokens } from "./providers/google-service-account";
import { fetchJson } from "./providers/http";
import { kommoDomain, kommoProvider } from "./providers/kommo";
import { linkedinProvider } from "./providers/linkedin";
import { graph, metaProvider } from "./providers/meta";
import { account, bearer } from "./providers/oauth2";
import { PIPEDRIVE_API_TOKEN, pipedriveProvider } from "./providers/pipedrive";
import { TIKTOK_API, tiktokData, tiktokProvider, type TiktokEnvelope } from "./providers/tiktok";
import { ProviderError, type DiscoveredAccount, type OAuthTokens, type ProviderProfile } from "./providers/types";

export type TokenCheck = { tokens: OAuthTokens; profile: ProviderProfile; accounts: DiscoveredAccount[] };

/** Confere o token e lista as contas. Lança AppError com a mensagem para a tela (no campo certo, quando é de um campo). */
export async function checkToken(provider: ProviderId, fields: Record<string, string>): Promise<TokenCheck> {
  switch (provider) {
    case "meta":
      return checkMetaToken(fields.token ?? "");
    case "ga4":
      return checkGa4Key(fields.json ?? "");
    case "tiktok":
      return checkTiktok(fields);
    case "linkedin":
      return checkLinkedin(fields.token ?? "");
    case "hubspot":
      return checkHubspot(fields.token ?? "");
    case "pipedrive":
      return checkPipedrive(fields.token ?? "");
    case "kommo":
      return checkKommo(fields);
    default:
      throw appError("validation", "Esta plataforma ainda não aceita conexão por token.");
  }
}

const fieldError = (message: string, field = "token") => appError("validation", message, { [field]: message });
const asToken = (profile: ProviderProfile): ProviderProfile => ({ ...profile, id: `token:${profile.id}`.slice(0, 200), name: `${profile.name} · token`.slice(0, 200) });
const required = (value: string, field: string, message: string) => {
  if (!value) throw fieldError(message, field);
  return value;
};

/** Erro de API (fora do Meta) em linguagem de quem está seguindo o tutorial. */
function platformError(err: unknown, platform: string, hints: { forbidden?: string; field?: string } = {}): AppError {
  if (err instanceof AppError) return err;
  if (!(err instanceof ProviderError)) return appError("unknown", "Não foi possível conferir agora. Tente de novo em instantes.");
  if (err.code === "provedor_indisponivel") return appError("unavailable", `O ${platform} não respondeu agora. Tente de novo em instantes.`);
  if (err.status === 403 && hints.forbidden) return fieldError(hints.forbidden, hints.field);
  return fieldError(`O ${platform} recusou: confira se copiou inteiro e se ainda vale. Se continuar, gere de novo seguindo os passos.`, hints.field);
}

// ---- Meta ------------------------------------------------------------------------------------

/** Código de erro da Graph API que o ProviderError traz no diagnóstico ("code=190"). */
const graphCode = (err: ProviderError) => Number(/\bcode=(\d+)/.exec(err.message)?.[1] ?? NaN);

/** Erro do Meta em linguagem de quem está seguindo o tutorial. */
export function metaTokenError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (!(err instanceof ProviderError)) return appError("unknown", "Não foi possível conferir o token agora. Tente de novo em instantes.");
  const code = graphCode(err);
  if (err.code === "provedor_indisponivel" || [4, 17, 32, 613].includes(code)) return appError("unavailable", "O Meta não respondeu agora. Tente de novo em instantes.");
  if (code === 190) return fieldError("O Meta recusou o token: ele está incompleto, expirou ou foi revogado. Gere um novo (passo 5) e cole de novo.");
  if (code === 10 || (code >= 200 && code < 300)) return fieldError("Falta permissão no token. Gere de novo marcando as permissões do passo 5.");
  if (code === 100) return fieldError("O Meta recusou a leitura. Confira se \"Exigir segredo do app\" está desligado (passo 2) e se o token tem as permissões do passo 5.");
  return fieldError("O Meta recusou o token. Confira os passos e gere um novo.");
}

/** Permissões concedidas ao token (vazio quando o Meta não informa: a conexão segue pelas contas que vierem). */
async function metaGrantedScopes(token: string): Promise<string[]> {
  try {
    const res = await graph<{ data?: { permission?: string; status?: string }[] }>("/me/permissions", {}, token, "Meta: permissões do token");
    return (res.data ?? []).filter((p) => p.status === "granted" && p.permission).map((p) => p.permission as string);
  } catch {
    return [];
  }
}

/** Validade do token (o token de usuário do sistema com "Nunca" não expira: sem data). */
async function metaExpiry(token: string): Promise<string | undefined> {
  try {
    const res = await graph<{ data?: { expires_at?: number } }>("/debug_token", { input_token: token }, token, "Meta: validade do token");
    const at = res.data?.expires_at;
    return at ? new Date(at * 1000).toISOString() : undefined;
  } catch {
    return undefined;
  }
}

async function checkMetaToken(raw: string): Promise<TokenCheck> {
  const token = cleanToken(raw);
  const problem = metaTokenProblem(token);
  if (problem) throw fieldError(problem);
  // gerado no app do cliente: as chamadas vão sem a prova do segredo do app do VYZ
  markOwnAppToken(token);
  const meta = metaProvider();
  try {
    const profile = await meta.fetchProfile(token);
    const [scopes, accounts, expiresAt] = await Promise.all([metaGrantedScopes(token), meta.listAccounts(token), metaExpiry(token)]);
    const ads = scopes.includes("ads_read") || scopes.includes("ads_management");
    const organic = scopes.includes("pages_show_list") || scopes.includes("instagram_basic");
    if (scopes.length && !ads && !organic) throw fieldError("O token não tem as permissões de anúncios nem de Páginas. Gere de novo marcando as permissões do passo 5.");
    if (!accounts.length) {
      throw fieldError("O token funciona, mas não enxerga nenhuma conta de anúncio nem Página. Atribua os ativos ao usuário do sistema (passo 4) e tente de novo.");
    }
    return {
      tokens: { accessToken: token, expiresAt, scopes: [...scopes, TOKEN_SCOPE] },
      profile: { id: profile.id, name: `${profile.name} · token`.slice(0, 200) },
      accounts,
    };
  } catch (err) {
    throw metaTokenError(err);
  }
}

// ---- GA4 (conta de serviço) -----------------------------------------------------------------

async function checkGa4Key(raw: string): Promise<TokenCheck> {
  const key = parseServiceAccountKey(raw);
  if (!key) throw fieldError("Isso não parece a chave JSON de uma conta de serviço do Google. Cole o conteúdo inteiro do arquivo baixado no passo 3.", "json");
  const packed = packServiceAccount(key);
  let tokens: OAuthTokens;
  try {
    tokens = await serviceAccountTokens(packed, GA4_SCOPE);
  } catch (err) {
    throw platformError(err, "Google", { field: "json" });
  }
  try {
    const accounts = await ga4Provider().listAccounts(tokens.accessToken);
    if (!accounts.length) throw fieldError(`A conta de serviço não enxerga nenhuma propriedade. Adicione ${key.client_email} como Leitor no GA4 (passo 4) e tente de novo.`, "json");
    return {
      tokens: { ...tokens, scopes: [GA4_SCOPE, TOKEN_SCOPE] },
      profile: asToken({ id: key.client_email, name: key.client_email, email: key.client_email }),
      accounts,
    };
  } catch (err) {
    throw platformError(err, "Google", { field: "json", forbidden: "O Google recusou a leitura: confira se a Google Analytics Admin API e a Data API estão ativas no projeto (passo 1)." });
  }
}

// ---- TikTok (app do cliente) ----------------------------------------------------------------

async function checkTiktok(fields: Record<string, string>): Promise<TokenCheck> {
  const appId = required((fields.app_id ?? "").trim(), "app_id", "Cole o App ID do seu app (passo 1).");
  if (!/^\d{6,30}$/.test(appId)) throw fieldError("O App ID do TikTok só tem números.", "app_id");
  const secret = required((fields.secret ?? "").trim(), "secret", "Cole o Secret do seu app (passo 1).");
  const code = required(tiktokAuthCode(fields.auth_code ?? ""), "auth_code", "Cole o endereço do retorno ou o auth_code (passo 2).");

  let accessToken: string;
  let scopes: string[];
  try {
    const res = await fetchJson<TiktokEnvelope<{ access_token: string; scope?: number[] }>>(`${TIKTOK_API}/oauth2/access_token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, secret, auth_code: code }),
      label: "TikTok: troca do código (token)",
    });
    const d = tiktokData(res, "TikTok: troca do código (token)");
    accessToken = d.access_token;
    scopes = (d.scope ?? []).map(String);
  } catch (err) {
    if (err instanceof ProviderError && err.code !== "provedor_indisponivel") {
      throw fieldError("O TikTok recusou o código: ele vale 1 hora e só uma vez, e o App ID e o Secret precisam ser do mesmo app. Autorize de novo (passo 2).", "auth_code");
    }
    throw platformError(err, "TikTok", { field: "auth_code" });
  }

  try {
    const url = new URL(`${TIKTOK_API}/oauth2/advertiser/get/`);
    url.search = new URLSearchParams({ app_id: appId, secret }).toString();
    const res = await fetchJson<TiktokEnvelope<{ list?: { advertiser_id: string | number; advertiser_name?: string }[] }>>(url, {
      headers: { "Access-Token": accessToken },
      label: "TikTok: contas de anúncio (token)",
    });
    const accounts = (tiktokData(res, "TikTok: contas de anúncio (token)").list ?? []).map((a) => account("tiktok", a.advertiser_id, a.advertiser_name));
    if (!accounts.length) throw fieldError("A autorização não trouxe nenhuma conta de anúncios. Autorize de novo marcando as contas (passo 2).", "auth_code");
    const profile = await tiktokProvider().fetchProfile(accessToken);
    return { tokens: { accessToken, scopes: [...scopes, TOKEN_SCOPE] }, profile: asToken(profile), accounts };
  } catch (err) {
    throw platformError(err, "TikTok", { field: "auth_code" });
  }
}

// ---- LinkedIn (app do cliente) --------------------------------------------------------------

const LINKEDIN_TOKEN_DAYS = 60;

async function checkLinkedin(raw: string): Promise<TokenCheck> {
  const token = cleanToken(raw);
  if (!/^[A-Za-z0-9_.\-~+/=]{40,2048}$/.test(token)) throw fieldError("Esse não parece um token do LinkedIn. Copie de novo, inteiro (passo 2).");
  const linkedin = linkedinProvider();
  try {
    const accounts = await linkedin.listAccounts(token);
    if (!accounts.length) throw fieldError("O token funciona, mas não enxerga nenhuma conta de anúncio. Gere de novo com a pessoa que acessa as contas (passo 2).");
    // o token do gerador do LinkedIn pode vir sem openid: sem o perfil, a conexão se identifica pela primeira conta
    const profile = await linkedin.fetchProfile(token).catch(() => ({ id: `ads-${accounts[0].external_id}`, name: "LinkedIn" }));
    return {
      tokens: { accessToken: token, expiresAt: new Date(Date.now() + LINKEDIN_TOKEN_DAYS * 86_400_000).toISOString(), scopes: ["r_ads", "r_ads_reporting", TOKEN_SCOPE] },
      profile: asToken(profile),
      accounts,
    };
  } catch (err) {
    throw platformError(err, "LinkedIn", { forbidden: "O LinkedIn recusou: o token precisa de r_ads e r_ads_reporting, e o app precisa do Advertising API aprovado (passos 1 e 2)." });
  }
}

// ---- HubSpot (app privado) ------------------------------------------------------------------

const HUBSPOT = "https://api.hubapi.com";

async function checkHubspot(raw: string): Promise<TokenCheck> {
  const token = cleanToken(raw);
  if (!/^pat-[A-Za-z0-9-]{20,200}$/.test(token)) throw fieldError("O token do app privado do HubSpot começa com pat-. Copie de novo na aba Autenticação (passo 3).");
  try {
    const info = await fetchJson<{ portalId: number; uiDomain?: string; companyCurrency?: string; timeZone?: string }>(`${HUBSPOT}/account-info/v3/details`, {
      headers: bearer(token),
      label: "HubSpot: conta (token)",
    });
    // confere o escopo de negócios, que a sincronização lê
    await fetchJson(`${HUBSPOT}/crm/v3/objects/deals?limit=1`, { headers: bearer(token), label: "HubSpot: negócios (token)" });
    return {
      tokens: { accessToken: token, scopes: ["crm.objects.contacts.read", "crm.objects.deals.read", "crm.schemas.deals.read", TOKEN_SCOPE] },
      profile: asToken({ id: String(info.portalId), name: info.uiDomain || `Portal ${info.portalId}` }),
      accounts: [account("hubspot", info.portalId, info.uiDomain, { currency: info.companyCurrency, timezone: info.timeZone, metadata: { hub_domain: info.uiDomain ?? null } })],
    };
  } catch (err) {
    throw platformError(err, "HubSpot", { forbidden: "O HubSpot recusou: faltam escopos no app privado. Marque os três do passo 2 e copie o token de novo." });
  }
}

// ---- Pipedrive (token pessoal) --------------------------------------------------------------

async function checkPipedrive(raw: string): Promise<TokenCheck> {
  const token = cleanToken(raw);
  if (!/^[A-Za-z0-9]{20,100}$/.test(token)) throw fieldError("Esse não parece o token de API do Pipedrive. Copie de novo na página da API (passo 1).");
  const packed = `${PIPEDRIVE_API_TOKEN}${token}`;
  const pipedrive = pipedriveProvider();
  try {
    const [profile, accounts] = await Promise.all([pipedrive.fetchProfile(packed), pipedrive.listAccounts(packed)]);
    return { tokens: { accessToken: packed, scopes: [TOKEN_SCOPE] }, profile: asToken(profile), accounts };
  } catch (err) {
    throw platformError(err, "Pipedrive");
  }
}

// ---- Kommo (integração privada) -------------------------------------------------------------

async function checkKommo(fields: Record<string, string>): Promise<TokenCheck> {
  const typed = (fields.domain ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  required(typed, "domain", "Cole o endereço da conta, como suaempresa.kommo.com.");
  let domain: string;
  try {
    domain = kommoDomain(typed.includes(".") ? typed : `${typed}.kommo.com`);
  } catch {
    throw fieldError("O endereço precisa ser o da sua conta do Kommo, como suaempresa.kommo.com.", "domain");
  }
  const token = cleanToken(fields.token ?? "");
  if (token.split(".").length !== 3 || token.length < 100) throw fieldError("Esse não parece o token de longa duração do Kommo. Copie de novo, inteiro (passo 2).");
  const packed = `${domain}|${token}`;
  const kommo = kommoProvider();
  try {
    const [profile, accounts] = await Promise.all([kommo.fetchProfile(packed), kommo.listAccounts(packed)]);
    return { tokens: { accessToken: packed, expiresAt: jwtExpiry(token), scopes: ["crm", TOKEN_SCOPE] }, profile: asToken(profile), accounts };
  } catch (err) {
    throw platformError(err, "Kommo");
  }
}
