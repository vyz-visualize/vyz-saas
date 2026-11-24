// Volta dos fluxos PKCE: login com Google ou Apple e link de nova senha. Troca o code
// pela sessão (o verificador está no cookie do navegador que começou o fluxo)
// e segue para um caminho interno. Falhou: volta com aviso para /entrar ou
// para /recuperar-senha.

import { NextResponse, type NextRequest } from "next/server";
import { failurePath, isRecoveryReturn, returnFailure } from "@/features/auth/links";
import { amrMethods, isRecentRecovery, RESET_PASSWORD_PATH } from "@/features/auth/recovery";
import { logAuthEvent } from "@/server/history/log";
import { loginOrigin, safeNextPath } from "@/server/http/request";
import { createServerSupabase } from "@/server/supabase/server";

/** Texto do provedor no log: curto e sem quebras. */
const clip = (v: string | null | undefined) => (v ? v.replace(/[\x00-\x1F]/g, " ").slice(0, 200) : null);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const recovery = isRecoveryReturn(next);
  const origin = await loginOrigin();
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));

  const code = params.get("code");
  if (!code || code.length > 512) {
    // Google cancelado ou link vencido: o Supabase manda ?error=... (fica no log, sem esconder)
    console.warn("[vyz] volta do login com erro", {
      error: clip(params.get("error")),
      code: clip(params.get("error_code")),
      description: clip(params.get("error_description")),
      semCodigo: !code,
    });
    return go(failurePath(returnFailure({ recovery, providerError: params.get("error") }), { recovery, next }));
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    // o verificador do PKCE não chegou (cookie recusado ou outro navegador): pkce_code_verifier_not_found
    console.warn("[vyz] volta do login sem sessão", { code: error.code, status: error.status, message: clip(error.message) });
    return go(failurePath(returnFailure({ recovery, errorCode: error.code }), { recovery, next }));
  }

  // Como a sessão foi aberta (claim amr do JWT novo): link de senha ou Google.
  const { user, session } = data;
  const { data: verified } = await supabase.auth.getClaims(session.access_token);
  const amr = verified?.claims.amr;
  if (isRecentRecovery(amr, Math.floor(Date.now() / 1000))) {
    await logAuthEvent({ event: "sign_in", userId: user.id, email: user.email, method: "magic_link", metadata: { flow: "recovery" } });
    return go(RESET_PASSWORD_PATH);
  }
  const methods = amrMethods(amr);
  if (methods.includes("oauth")) {
    // o histórico só aceita "google" como método; a Apple vai no metadata
    const provider = String(user.app_metadata?.provider ?? "google");
    await logAuthEvent({ event: "oauth_sign_in", userId: user.id, email: user.email, ...(provider === "google" ? { method: "google" as const } : { metadata: { provider } }) });
  }
  else await logAuthEvent({ event: "sign_in", userId: user.id, email: user.email, method: "magic_link", metadata: { flow: methods.join(",") || "pkce" } });
  return go(next);
}
