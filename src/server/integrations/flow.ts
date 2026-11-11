import "server-only";

// Começo e volta do login OAuth (rotas /api/integrations/<provedor>/start e
// /callback). O state tem 32 bytes aleatórios e o banco guarda só o sha256; é
// de uso único, vale 10 minutos e fica preso ao usuário, ao workspace e ao
// provedor. O destino da volta sai do banco (validado na ida), nunca da URL do
// retorno. Erros voltam como ?erro=<codigo> (features/integrations/results.ts).

import { after, NextResponse } from "next/server";
import { isStateToken, pkceChallenge, randomToken, sha256Hex } from "@/features/integrations/oauth";
import type { ProviderId } from "@/features/integrations/providers";
import { RETURN_DEFAULT, storedReturnPath, withConnectResult, type ConnectErrorCode } from "@/features/integrations/results";
import type { Json } from "@/lib/supabase/database.types";
import { getSessionUser } from "@/server/auth/session";
import { authorize } from "@/server/auth/workspace";
import { logActivity, logAuthEvent, type ActivityEventName } from "@/server/history/log";
import { appOrigin, requestContext, safeNextPath } from "@/server/http/request";
import { hitRateLimit } from "@/server/security/rate-limit";
import { createAdminSupabase } from "@/server/supabase/admin";
import { AppError, unwrap } from "@/server/supabase/errors";
import type { DB } from "@/server/supabase/server";
import { getProvider, ProviderError } from "./providers";
import { syncAdAccounts } from "@/server/sync/run";
import { nullable } from "./tokens";

/** URL de retorno cadastrada no provedor: a mesma no início e na troca do código. */
export const callbackUri = (origin: string, provider: ProviderId) => `${origin}/api/integrations/${provider}/callback`;

/** Redirecionamento de OAuth (nunca em cache). */
export function oauthRedirect(url: URL): NextResponse {
  const res = NextResponse.redirect(url, 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

const loginUrl = (origin: string, back: string) => new URL(`/entrar?next=${encodeURIComponent(back)}`, origin);

/** Falha de autorização vira código da URL; o resto sobe. */
function authErrorCode(err: unknown): ConnectErrorCode {
  if (err instanceof AppError) {
    if (err.code === "plan:inactive") return "plano_inativo";
    if (err.code === "forbidden") return "permissao";
    if (err.code === "auth:required") return "sessao";
  }
  throw err;
}

/** Erro da troca ou do integration_connect vira código da URL. */
function connectFailureCode(err: unknown): ConnectErrorCode {
  if (err instanceof ProviderError) return err.code;
  if (err instanceof AppError) {
    if (err.code === "integration:platform_mismatch" || err.code === "integration:invalid_accounts") return "contas_invalidas";
    if (err.code === "integration:missing_token") return "troca_falhou";
  }
  return "indisponivel";
}

/** Começa a conexão: confere papel e limite, grava o state e manda ao provedor. */
export async function startConnection(provider: ProviderId, rawNext: string | null): Promise<URL> {
  const origin = await appOrigin();
  const back = storedReturnPath(safeNextPath(rawNext, RETURN_DEFAULT));
  const fail = (erro: ConnectErrorCode) => new URL(withConnectResult(back, { erro, provedor: provider }), origin);

  const user = await getSessionUser();
  if (!user) return loginUrl(origin, back);

  let workspaceId: string;
  try {
    workspaceId = (await authorize("admin")).workspace.id;
  } catch (err) {
    return fail(authErrorCode(err));
  }

  if (!(await hitRateLimit("oauth_start_user", user.id))) {
    await logAuthEvent({ event: "rate_limited", userId: user.id, email: user.email, metadata: { rule: "oauth_start_user", provider } });
    return fail("muitas_tentativas");
  }

  const oauth = getProvider(provider);
  const state = randomToken();
  const verifier = oauth.usesPkce ? randomToken() : null;
  let target: string;
  try {
    target = oauth.authorizeUrl({ state, codeChallenge: verifier ? await pkceChallenge(verifier) : undefined, redirectUri: callbackUri(origin, provider) });
  } catch (err) {
    if (!(err instanceof ProviderError)) throw err;
    console.error("[vyz] conexão não iniciada", provider, err.message);
    return fail(err.code);
  }

  const ctx = await requestContext();
  const admin = createAdminSupabase({ actorId: user.id, forwardHeaders: ctx.forwardHeaders });
  const { error } = await admin.from("oauth_states").insert({
    state_hash: await sha256Hex(state),
    workspace_id: workspaceId,
    user_id: user.id,
    provider,
    code_verifier: verifier,
    redirect_path: back,
  });
  if (error) {
    console.error("[vyz] oauth_states", error.message);
    return fail("indisponivel");
  }

  await logActivity({ workspaceId, actorId: user.id, event: "integration.connect_started", metadata: { provider, mock: oauth.isMock } });
  return new URL(target);
}

/**
 * O state venceu (do próprio usuário, não usado) ou é inválido. Quando o state
 * é de quem voltou, a falha entra no histórico do workspace dele; um state
 * desconhecido ou de outra pessoa não tem workspace para registrar (fica no log).
 */
async function whyStateFailed(admin: DB, stateHash: string, userId: string, provider: ProviderId): Promise<ConnectErrorCode> {
  const { data } = await admin.from("oauth_states").select("user_id, workspace_id, provider, consumed_at, expires_at").eq("state_hash", stateHash).maybeSingle();
  if (data && data.user_id !== userId) console.warn("[vyz] retorno de OAuth com state de outro usuário", provider);
  if (!data) console.warn("[vyz] retorno de OAuth com state desconhecido", provider);
  const own = !!data && data.user_id === userId && data.provider === provider;
  const expired = own && !data.consumed_at && Date.parse(data.expires_at) <= Date.now();
  const code: ConnectErrorCode = expired ? "estado_expirado" : "estado_invalido";
  if (data && data.user_id === userId) {
    await logActivity({
      workspaceId: data.workspace_id,
      actorId: userId,
      event: "integration.connect_failed",
      metadata: { provider, reason: code, state: expired ? "expired" : data.consumed_at ? "already_used" : "mismatch" },
    });
  }
  return code;
}

/** Volta do provedor: confere e consome o state, troca o código e grava a conexão. */
export async function finishConnection(provider: ProviderId, params: URLSearchParams): Promise<URL> {
  const origin = await appOrigin();
  const toDefault = (erro: ConnectErrorCode) => new URL(withConnectResult(RETURN_DEFAULT, { erro, provedor: provider }), origin);

  const state = params.get("state");
  if (!isStateToken(state)) return toDefault("estado_invalido");

  const user = await getSessionUser();
  if (!user) return loginUrl(origin, RETURN_DEFAULT);

  const ctx = await requestContext();
  const admin = createAdminSupabase({ actorId: user.id, forwardHeaders: ctx.forwardHeaders });
  const stateHash = await sha256Hex(state);
  const now = new Date().toISOString();

  // Confere e consome numa operação só: com dois retornos do mesmo state, só um passa.
  const { data: row, error } = await admin
    .from("oauth_states")
    .update({ consumed_at: now })
    .eq("state_hash", stateHash)
    .eq("user_id", user.id)
    .eq("provider", provider)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("workspace_id, code_verifier, redirect_path")
    .maybeSingle();
  if (error) {
    console.error("[vyz] oauth_states", error.message);
    return toDefault("indisponivel");
  }
  if (!row) return toDefault(await whyStateFailed(admin, stateHash, user.id, provider));

  const workspaceId = row.workspace_id;
  const back = storedReturnPath(row.redirect_path);
  const fail = (erro: ConnectErrorCode) => new URL(withConnectResult(back, { erro, provedor: provider }), origin);
  const log = (event: ActivityEventName, metadata: Record<string, Json>, entityId?: string) =>
    logActivity({ workspaceId, actorId: user.id, event, entityType: entityId ? "connection" : undefined, entityId, metadata: { provider, ...metadata } });

  // Ainda admin, com assinatura ativa, e no mesmo workspace onde a conexão começou.
  try {
    const session = await authorize("admin");
    if (session.workspace.id !== workspaceId) {
      await log("integration.connect_failed", { code: "workspace_trocado" });
      return fail("workspace_trocado");
    }
  } catch (err) {
    const erro = authErrorCode(err);
    await log("integration.connect_failed", { code: erro });
    return fail(erro);
  }

  const denied = params.get("error");
  if (denied) {
    await log("integration.connect_canceled", { reason: denied.slice(0, 40) });
    return fail(denied === "access_denied" ? "cancelado" : "provedor_recusou");
  }

  // O TikTok devolve o código em auth_code; os demais, em code.
  const code = params.get("code") ?? params.get("auth_code");
  if (!code || code.length > 2048) {
    await log("integration.connect_failed", { code: "troca_falhou" });
    return fail("troca_falhou");
  }

  const oauth = getProvider(provider);
  try {
    // relógio com folga: as contas criadas por esta conexão são as "novas" (ligadas a seguir)
    const connectStartedAt = new Date(Date.now() - 60_000).toISOString();
    const tokens = await oauth.exchangeCode({ code, codeVerifier: row.code_verifier ?? undefined, redirectUri: callbackUri(origin, provider), params });
    const [profile, accounts] = await Promise.all([oauth.fetchProfile(tokens.accessToken), oauth.listAccounts(tokens.accessToken)]);
    // Tokens vão direto para o Vault (integration_connect); nada fica em coluna comum.
    const connectionId = unwrap(
      await admin.rpc("integration_connect", {
        p_workspace_id: workspaceId,
        p_provider: provider,
        p_external_user_id: profile.id,
        p_external_user_name: profile.name.slice(0, 200),
        p_external_user_email: nullable(profile.email?.slice(0, 254)),
        p_scopes: tokens.scopes,
        p_is_mock: oauth.isMock,
        p_connected_by: user.id,
        p_access_token: tokens.accessToken,
        p_refresh_token: nullable(tokens.refreshToken),
        p_token_expires_at: nullable(tokens.expiresAt),
        p_accounts: accounts,
      }),
    );
    await log("integration.connected", { accounts: accounts.length, mock: oauth.isMock }, connectionId ?? undefined);
    if (connectionId) {
      const enabled = await enableNewAccounts(admin, workspaceId, connectionId, connectStartedAt).catch((err) => {
        console.error("[vyz] ligar contas novas", provider, err instanceof Error ? err.message : err);
        return [] as string[];
      });
      if (enabled.length) {
        await log("ad_accounts.selection_changed", { enabled, disabled: [], automatic: true }, connectionId);
        after(() => syncAdAccounts(enabled, "initial", { actorId: user.id }));
      }
    }
    return new URL(withConnectResult(back, { conectado: provider }), origin);
  } catch (err) {
    const erro = connectFailureCode(err);
    console.error("[vyz] conexão não concluída", provider, err instanceof Error ? err.message : "erro desconhecido");
    await log("integration.connect_failed", { code: erro });
    return fail(erro);
  }
}

/**
 * Quem acabou de escolher as contas na tela do provedor não deveria ter de ligá-las de novo
 * no VYZ. As contas que esta conexão trouxe pela primeira vez (ativas no provedor) entram
 * ligadas, por plataforma, se TODAS couberem no plano; se não couberem, ficam desligadas e a
 * pessoa escolhe (melhor do que o VYZ escolher por ela). Reconectar não religa o que a pessoa
 * desligou: só conta conta nova. O limite do plano é do banco (gatilho): passou, ligou.
 */
async function enableNewAccounts(admin: DB, workspaceId: string, connectionId: string, since: string): Promise<string[]> {
  const fresh = unwrap(await admin.from("ad_accounts").select("id, platform_id").eq("workspace_id", workspaceId).eq("connection_id", connectionId).eq("status", "active").eq("is_enabled", false).gte("created_at", since)) ?? [];
  const enabled: string[] = [];
  for (const platform of new Set(fresh.map((a) => a.platform_id))) {
    const current = unwrap(await admin.from("ad_accounts").select("id").eq("workspace_id", workspaceId).eq("platform_id", platform).eq("is_enabled", true)) ?? [];
    const add = fresh.filter((a) => a.platform_id === platform).map((a) => a.id);
    const { error } = await admin.rpc("set_enabled_ad_accounts", { p_workspace_id: workspaceId, p_platform_id: platform, p_ad_account_ids: [...current.map((a) => a.id), ...add] });
    if (error) continue; // passou do plano: a pessoa escolhe quais ligar
    enabled.push(...add);
  }
  return enabled;
}

