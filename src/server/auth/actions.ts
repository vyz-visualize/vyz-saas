"use server";

// Ações de acesso (Server Actions): entrar com e-mail e senha ou com Google,
// pedir o link de nova senha, criar a senha nova, trocar a senha e sair.
// Nenhuma resposta diz se um e-mail tem conta; as entradas públicas têm
// limite de tentativas por IP e por e-mail; tudo vai para o histórico de
// acesso (auth_events).

import { createServerClient } from "@supabase/ssr";
import { createClient, isAuthWeakPasswordError, type AuthError } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { fieldErrors, formText, type AuthFormState, type FormValues } from "@/features/auth/form";
import { APPLE_PENDING, GOOGLE_PENDING, type OAuthProvider } from "@/features/auth/google";
import { AUTH_MESSAGES } from "@/features/auth/messages";
import { PASSWORD_MESSAGES } from "@/features/auth/password";
import { isRecentRecovery, RESET_PASSWORD_PATH } from "@/features/auth/recovery";
import { changePasswordSchema, newPasswordSchema, nextPathSchema, resetRequestSchema, signInSchema } from "@/features/auth/schemas";
import { ACTIVE_WORKSPACE_COOKIE, AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookies";
import type { Database } from "@/lib/supabase/database.types";
import { serverEnv } from "@/server/env";
import { logAuthEvent, type AuthMethod } from "@/server/history/log";
import { appOrigin, requestContext, safeNextPath } from "@/server/http/request";
import { hitRateLimit, type RateRule } from "@/server/security/rate-limit";
import { AppError, appError, toActionError, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";
import { signInWithPasswordServer } from "./accounts";
import { appleSignInStatus, googleSignInStatus } from "./google";
import { getSessionUser } from "./session";

// O Supabase só manda o e-mail quando a conta existe, e isso leva tempo:
// a resposta espera um mínimo para não denunciar quem tem conta pela demora.
const RESET_MIN_MS = 1200;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

/** E-mail digitado, para devolver ao formulário (nunca a senha). */
const typedEmail = (formData: FormData): FormValues => ({ email: formText(formData, "email").trim().slice(0, 254) });

function invalid(issues: readonly { path: readonly PropertyKey[]; message: string }[], values?: FormValues) {
  return { ok: false as const, error: appError("validation", undefined, fieldErrors(issues)).toAction(), values };
}

/** Conta a tentativa em cada regra; passou do limite, registra e lança. */
async function guard(rules: [RateRule, string | null | undefined][], who: { email: string; method?: AuthMethod }) {
  const allowed = await Promise.all(rules.map(([rule, subject]) => hitRateLimit(rule, subject)));
  const blocked = rules.find((_, i) => !allowed[i]);
  if (!blocked) return;
  await logAuthEvent({ event: "rate_limited", email: who.email, method: who.method, metadata: { rule: blocked[0] } });
  throw appError("rate_limited");
}

/**
 * Cliente só para pedir o link de nova senha: igual ao createServerSupabase,
 * mas grava apenas o verificador fixo do PKCE (o que /auth/callback lê). Os
 * cookies por fluxo ("-flow-<id>-", "-flows-") ficam de fora porque o
 * Supabase os apaga quando recusa o envio (conta existente no limite de
 * e-mail), e essa diferença na resposta denunciaria que a conta existe.
 */
async function resetLinkClient() {
  const env = serverEnv();
  const store = await cookies();
  const { forwardHeaders } = await requestContext();
  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          if (!/-flows?-/.test(name)) store.set(name, value, { ...options, ...AUTH_COOKIE_OPTIONS });
        }
      },
    },
    cookieOptions: AUTH_COOKIE_OPTIONS,
    global: { headers: forwardHeaders },
  });
}

/** Erro do Supabase ao gravar a senha → mensagem no campo. */
function passwordError(error: AuthError): AppError {
  if (error.code === "same_password") return appError("validation", undefined, { password: PASSWORD_MESSAGES.same });
  if (error.code === "weak_password") {
    const pwned = isAuthWeakPasswordError(error) && error.reasons.includes("pwned");
    return appError("validation", undefined, { password: pwned ? PASSWORD_MESSAGES.pwned : PASSWORD_MESSAGES.weak });
  }
  if (error.code === "reauthentication_needed") return appError("auth:reauthentication", "Por segurança, saia e entre de novo antes de trocar a senha.");
  console.error("[vyz] gravar senha", error.code ?? error.status);
  return appError("unknown");
}

/** Entrar com e-mail e senha (/entrar). Deu certo: vai para `next` (ou /painel). */
export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = typedEmail(formData);
  const parsed = signInSchema.safeParse({ email: values.email, password: formText(formData, "password") });
  if (!parsed.success) return invalid(parsed.error.issues, values);
  const { email, password } = parsed.data;
  try {
    const { ip } = await requestContext();
    await guard(
      [
        ["sign_in_ip", ip],
        ["sign_in_email", email],
      ],
      { email, method: "password" },
    );
    const result = await signInWithPasswordServer(email, password);
    if (!result.ok) {
      if (result.reason !== "invalid_credentials") throw appError("unknown");
      await logAuthEvent({ event: "sign_in_failed", email, method: "password" });
      throw appError("auth:invalid_credentials", AUTH_MESSAGES.invalidCredentials);
    }
    await logAuthEvent({ event: "sign_in", userId: result.userId, email, method: "password" });
  } catch (err) {
    unstable_rethrow(err);
    return { ...toActionError(err), values };
  }
  redirect(safeNextPath(formText(formData, "next")));
}

/**
 * Entrar com Google ou Apple: vai para o consentimento (pelo Supabase) e volta
 * em /auth/callback, que abre a sessão e segue para `next`.
 */
async function signInWithProvider(provider: OAuthProvider, next?: string | null): Promise<ActionResult> {
  let url: string;
  try {
    const status = provider === "google" ? await googleSignInStatus() : await appleSignInStatus();
    if (status === "disabled") throw appError(`auth:${provider}_disabled`, `${(provider === "google" ? GOOGLE_PENDING : APPLE_PENDING).label}.`);
    const parsed = nextPathSchema.safeParse(next);
    const callback = new URL("/auth/callback", await appOrigin());
    callback.searchParams.set("next", safeNextPath(parsed.success ? parsed.data : null));
    const supabase = await createServerSupabase();
    // PKCE: o verificador fica num cookie deste navegador até a volta.
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: provider === "google" ? { redirectTo: callback.toString(), queryParams: { prompt: "select_account" } } : { redirectTo: callback.toString(), scopes: "name email" },
    });
    if (error || !data.url) throw error ?? appError("unknown");
    url = data.url;
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(url);
}

export async function signInWithGoogle(next?: string | null): Promise<ActionResult> {
  return signInWithProvider("google", next);
}

export async function signInWithApple(next?: string | null): Promise<ActionResult> {
  return signInWithProvider("apple", next);
}

/**
 * Pede o link de nova senha (/recuperar-senha). Com ou sem conta para o
 * e-mail, a resposta é a mesma. O link volta em /auth/callback e abre
 * /redefinir-senha (PKCE: precisa ser aberto no mesmo navegador).
 */
export async function requestPasswordReset(_prev: AuthFormState<{ email: string }>, formData: FormData): Promise<AuthFormState<{ email: string }>> {
  const values = typedEmail(formData);
  const parsed = resetRequestSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues, values);
  const { email } = parsed.data;
  const started = Date.now();
  try {
    const { ip } = await requestContext();
    await guard(
      [
        ["password_reset_ip", ip],
        ["password_reset_email", email],
      ],
      { email },
    );
    const redirectTo = new URL("/auth/callback", await appOrigin());
    redirectTo.searchParams.set("next", RESET_PASSWORD_PATH);
    const supabase = await resetLinkClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo.toString() });
    // Só falha com conta existente (limite de envio do SMTP, endereço recusado):
    // a resposta não muda; o motivo fica no log e no histórico.
    const reason = error ? (error.code ?? String(error.status ?? "unknown")) : null;
    if (reason) console.error("[vyz] link de nova senha não enviado", reason);
    await logAuthEvent({ event: "password_reset_requested", email, metadata: reason ? { delivery: "failed", reason } : {} });
  } catch (err) {
    unstable_rethrow(err);
    return { ...toActionError(err), values };
  }
  await sleep(RESET_MIN_MS - (Date.now() - started));
  return { ok: true, data: { email }, values };
}

/**
 * Cria a senha nova com a sessão aberta pelo link do e-mail (/redefinir-senha).
 * Sessão comum (entrou com senha ou Google) não troca por aqui: usa changePassword.
 */
export async function resetPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = newPasswordSchema.safeParse({ password: formText(formData, "password"), confirm: formText(formData, "confirm") });
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims?.sub) throw appError("auth:required");
    if (!isRecentRecovery(claims.amr, Math.floor(Date.now() / 1000))) throw appError("auth:recovery_expired", AUTH_MESSAGES.recoveryExpired);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) throw passwordError(error);
    // O Supabase encerra as outras sessões da conta ao trocar a senha.
    await logAuthEvent({ event: "password_updated", userId: claims.sub, email: typeof claims.email === "string" ? claims.email : null, metadata: { via: "recovery" } });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect(safeNextPath(formText(formData, "next")));
}

/**
 * Troca a senha com a conta aberta (Configurações e /redefinir-senha). Antes,
 * confere a senha atual num cliente avulso, sem cookies: a sessão deste
 * aparelho não muda. Senha atual errada não muda nada. O Supabase encerra as
 * sessões dos outros aparelhos ao gravar a senha nova.
 */
export async function changePassword(_prev: AuthFormState<{ changedAt: number }>, formData: FormData): Promise<AuthFormState<{ changedAt: number }>> {
  const parsed = changePasswordSchema.safeParse({
    current: formText(formData, "current"),
    password: formText(formData, "password"),
    confirm: formText(formData, "confirm"),
  });
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const user = await getSessionUser();
    if (!user?.email) throw appError("auth:required");
    const { ip } = await requestContext();
    await guard(
      [
        ["sign_in_ip", ip],
        ["sign_in_email", user.email],
      ],
      { email: user.email, method: "password" },
    );
    if (!(await passwordMatches(user.id, user.email, parsed.data.current))) {
      await logAuthEvent({ event: "sign_in_failed", userId: user.id, email: user.email, method: "password", metadata: { reason: "change_password" } });
      throw appError("validation", undefined, { current: AUTH_MESSAGES.wrongCurrentPassword });
    }
    const supabase = await createServerSupabase();
    // current_password: vale quando o projeto exige a senha atual para trocar
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password, current_password: parsed.data.current });
    if (error) throw passwordError(error);
    await logAuthEvent({ event: "password_updated", userId: user.id, email: user.email, metadata: { via: "settings" } });
    return { ok: true, data: { changedAt: Date.now() } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Confere a senha entrando num cliente avulso (sem cookies) e encerra essa sessão de conferência. */
async function passwordMatches(userId: string, email: string, password: string): Promise<boolean> {
  const env = serverEnv();
  const probe = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await probe.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "invalid_credentials" || error.status === 400) return false;
    console.error("[vyz] conferir senha atual", error.code ?? error.status);
    throw appError("unknown");
  }
  await probe.auth.signOut({ scope: "local" });
  return data.user?.id === userId;
}

async function endSession(scope: "local" | "global") {
  const user = await getSessionUser();
  const supabase = await createServerSupabase();
  // Com erro, o cliente apaga a sessão local do mesmo jeito.
  const { error } = await supabase.auth.signOut({ scope });
  if (error) console.error("[vyz] sair", error.code ?? error.status);
  (await cookies()).delete(ACTIVE_WORKSPACE_COOKIE);
  if (user) await logAuthEvent({ event: "sign_out", userId: user.id, email: user.email, metadata: { scope } });
}

/** Sai neste aparelho. */
export async function signOut() {
  await endSession("local");
  redirect("/entrar");
}

/** Sai em todos os aparelhos (revoga todas as sessões da conta). */
export async function signOutEverywhere() {
  await endSession("global");
  redirect("/entrar?aviso=sessoes_encerradas");
}
