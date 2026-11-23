import "server-only";

// Conexão por token (opção secundária ao login): confere o token colado pelo cliente e
// devolve o que a conexão grava (saveConnection, o mesmo caminho do login). As mensagens
// de erro vão para a tela, então dizem o que fazer; nunca levam o token.

import type { ProviderId } from "@/features/integrations/providers";
import { cleanToken, metaTokenProblem, TOKEN_SCOPE } from "@/features/integrations/token-connect";
import { AppError, appError } from "@/server/supabase/errors";
import { markOwnAppToken } from "./meta-auth";
import { graph, metaProvider } from "./providers/meta";
import { ProviderError, type DiscoveredAccount, type OAuthTokens, type ProviderProfile } from "./providers/types";

export type TokenCheck = { tokens: OAuthTokens; profile: ProviderProfile; accounts: DiscoveredAccount[] };

/** Confere o token e lista as contas. Lança AppError com a mensagem para a tela (campo "token" quando é do token). */
export async function checkToken(provider: ProviderId, fields: Record<string, string>): Promise<TokenCheck> {
  if (provider === "meta") return checkMetaToken(fields.token ?? "");
  throw appError("validation", "Esta plataforma ainda não aceita conexão por token.");
}

const fieldError = (message: string) => appError("validation", message, { token: message });

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
