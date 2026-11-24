// Links de e-mail com token (templates do Supabase com {{ .TokenHash }}):
// confere com verifyOtp, abre a sessão e segue. Funciona em qualquer
// navegador (não depende de cookie de PKCE). Nova senha e convite terminam
// em /redefinir-senha.

import { NextResponse, type NextRequest } from "next/server";
import { failurePath, isEmailLinkType, isTokenHash, setsPassword } from "@/features/auth/links";
import { RESET_PASSWORD_PATH } from "@/features/auth/recovery";
import { logAuthEvent } from "@/server/history/log";
import { loginOrigin, safeNextPath } from "@/server/http/request";
import { createServerSupabase } from "@/server/supabase/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const tokenHash = params.get("token_hash");
  const next = safeNextPath(params.get("next"));
  const origin = await loginOrigin();
  const go = (path: string) => NextResponse.redirect(new URL(path, origin));
  const recovery = type === "recovery" || type === "invite";

  if (!isEmailLinkType(type) || !isTokenHash(tokenHash)) return go(failurePath("link_invalido", { recovery, next }));

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    console.warn("[vyz] link de e-mail recusado", error?.code ?? error?.status ?? "sem usuário");
    return go(failurePath("link_invalido", { recovery, next }));
  }

  const { user } = data;
  if (type === "email_change") await logAuthEvent({ event: "email_changed", userId: user.id, email: user.email });
  else await logAuthEvent({ event: "sign_in", userId: user.id, email: user.email, method: "magic_link", metadata: { flow: type } });
  return go(setsPassword(type) ? RESET_PASSWORD_PATH : next);
}
