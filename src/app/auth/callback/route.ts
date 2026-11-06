// Volta dos fluxos PKCE: login com Google ou Apple e link de nova senha. Troca o code
// pela sessão (o verificador está no cookie do navegador que começou o fluxo)
// e segue para um caminho interno. Falhou: volta com aviso para /entrar ou
// para /recuperar-senha.

import { NextResponse, type NextRequest } from "next/server";
import { failurePath, isRecoveryReturn, returnFailure } from "@/features/auth/links";
import { amrMethods, isRecentRecovery, RESET_PASSWORD_PATH } from "@/features/auth/recovery";
import { logAuthEvent } from "@/server/history/log";
import { appOrigin, safeNextPath } from "@/server/http/request";
import { createServerSupabase } from "@/server/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const next = safeNextPath(params.get("next"));
  const recovery = isRecoveryReturn(next);
  const origin = await appOrigin();
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));

  const code = params.get("code");
  if (!code || code.length > 512) {
    // Google cancelado ou link vencido: o Supabase manda ?error=...
    return go(failurePath(returnFailure({ recovery, providerError: params.get("error") }), { recovery, next }));
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.warn("[vyz] volta do login sem sessão", error.code ?? error.status);
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
