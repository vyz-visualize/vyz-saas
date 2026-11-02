// GET /painel/w/<slug>: entrada do cliente no produto dele. É o destino de
// dash.vyzualize.com.br/<slug> e lps.vyzualize.com.br/<slug> (o proxy
// reescreve). Abre o workspace (se a pessoa for membro) e leva ao início do
// produto: onboarding ou dashboards (dash), lista de LPs (lp).

import { NextResponse } from "next/server";
import { ACTIVE_WORKSPACE_COOKIE, WORKSPACE_COOKIE_OPTIONS } from "@/lib/supabase/cookies";
import { getViewer } from "@/server/auth/workspace";

export async function GET(request: Request, ctx: RouteContext<"/painel/w/[slug]">) {
  const { slug } = await ctx.params;
  const url = new URL(request.url);
  // o host que o cliente digitou (dash./lps.), não o interno do servidor
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const origin = host ? `${request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")}://${host}` : url.origin;
  const to = (path: string) => NextResponse.redirect(new URL(path, origin));

  const viewer = await getViewer();
  // depois do login volta por aqui (o caminho existe em qualquer host)
  if (!viewer) return to(`/entrar?next=${encodeURIComponent(`/painel/w/${slug}${url.search}`)}`);

  const m = viewer.memberships.find((x) => x.workspace.slug === slug.toLowerCase());
  if (!m) return to("/painel");

  const welcome = url.searchParams.get("bemvindo") === "1";
  const w = m.workspace;
  const home =
    w.product === "lp"
      ? `/painel/landing-pages${welcome ? "?bemvindo=1" : ""}`
      : w.onboarding_step !== "done"
        ? "/comecar"
        : "/painel";
  const res = to(home);
  res.cookies.set(ACTIVE_WORKSPACE_COOKIE, w.id, WORKSPACE_COOKIE_OPTIONS);
  return res;
}
