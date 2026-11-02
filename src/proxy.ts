// Proxy (Next 16): renova a sessão do Supabase a cada requisição das áreas do
// app e faz o redirecionamento otimista (sem sessão → /entrar). A autorização
// de verdade acontece no servidor (src/server/auth) e no RLS do banco.
// Não roda na LP (/), que segue estática.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { HOST_RESERVED, productFromHost } from "@/lib/product-hosts";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookies";

const PROTECTED = ["/painel", "/comecar", "/integracoes", "/convite", "/assinar/pagamento", "/assinar/concluido"];
const GUEST_ONLY = ["/entrar", "/recuperar-senha"];

/** Mesmo filtro de safeNextPath (o proxy não importa código de servidor). */
function safeNext(raw: string | null): string {
  if (!raw || raw.length > 512 || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/painel";
  if (/[\x00-\x1F\\]/.test(raw) || /^\/[a-z][a-z0-9+.-]*:/i.test(raw)) return "/painel";
  return raw;
}

const startsWith = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * LP publicada (/p/<slug>) e link compartilhado (/r/<token>): com pré-renderização
 * parcial a página já respondeu 200 quando descobre que não existe; aqui,
 * antes de renderizar, o que não existe vira 404 de verdade (a página mostra
 * a mesma tela amigável).
 */
async function publicLinkMissing(request: NextRequest): Promise<boolean> {
  const [, area, key] = request.nextUrl.pathname.split("/");
  if (!key || (area !== "p" && area !== "r")) return false;
  if (area === "p" && request.nextUrl.searchParams.has("previa")) return false;
  const kind = area === "p" ? "lp" : "share";
  const value = area === "p" ? decodeURIComponent(key).toLowerCase() : await sha256Hex(key);
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/public_link_exists`, {
      method: "POST",
      headers: { apikey: (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, "content-type": "application/json" },
      body: JSON.stringify({ p_kind: kind, p_key: value }),
    });
    return res.ok && (await res.json()) === false;
  } catch {
    return false; // sem resposta do banco: a página decide
  }
}

// Resposta 404 direta (antes de qualquer stream), no visual do VYZ.
function notFoundPage(share: boolean) {
  const title = share ? "Link não encontrado" : "Página indisponível";
  const text = share ? "Este link não existe ou foi digitado errado. Peça um novo a quem compartilhou." : "Esta página não existe ou não está mais publicada.";
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · VYZ</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;font-family:system-ui,-apple-system,sans-serif;background:#f4f5f0;color:#1e1e1e;padding:16px}@media(prefers-color-scheme:dark){body{background:#1e1e1e;color:#f2f3ee}p{color:#a7aa9f!important}}main{max-width:420px;text-align:center}h1{font-size:22px;margin:0 0 8px}p{color:#5e6157;margin:0;line-height:1.5}</style></head><body><main><h1>${title}</h1><p>${text}</p></main></body></html>`;
  return new NextResponse(html, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

/**
 * dash.vyzualize.com.br/<slug> e lps.vyzualize.com.br/<slug>: a entrada do
 * cliente no produto dele (reescrita para /painel/w/<slug>). A raiz do
 * subdomínio volta para o site.
 */
function productHostRoute(request: NextRequest): NextResponse | null {
  if (!productFromHost(request.headers.get("host"))) return null;
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    const site = process.env.NEXT_PUBLIC_SITE_URL;
    return site ? NextResponse.redirect(site) : null;
  }
  if (parts.length === 1 && !HOST_RESERVED.has(parts[0]) && /^[a-z0-9][a-z0-9-]{1,62}$/i.test(parts[0])) {
    const url = request.nextUrl.clone();
    url.pathname = `/painel/w/${parts[0].toLowerCase()}`;
    return NextResponse.rewrite(url);
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const hostRoute = productHostRoute(request);
  if (hostRoute) return hostRoute;
  if (await publicLinkMissing(request)) return notFoundPage(request.nextUrl.pathname.startsWith("/r/"));

  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, { ...options, ...AUTH_COOKIE_OPTIONS });
      },
    },
    cookieOptions: AUTH_COOKIE_OPTIONS,
  });

  // Valida o JWT (e renova, se perto de expirar) antes de qualquer outra coisa.
  const { data } = await supabase.auth.getClaims();
  const authed = !!data?.claims?.sub;
  const { pathname, search } = request.nextUrl;

  const redirectTo = (target: string, query = "") => {
    const url = request.nextUrl.clone();
    const [path, search = ""] = target.split("?");
    url.pathname = path;
    url.search = query || (search ? `?${search}` : "");
    const res = NextResponse.redirect(url);
    // leva junto os cookies renovados
    for (const cookie of response.cookies.getAll()) res.cookies.set(cookie);
    return res;
  };

  if (!authed && startsWith(pathname, PROTECTED)) {
    return redirectTo("/entrar", `?next=${encodeURIComponent(pathname + search)}`);
  }
  if (authed && startsWith(pathname, GUEST_ONLY)) {
    return redirectTo(safeNext(request.nextUrl.searchParams.get("next")));
  }
  return response;
}

export const config = {
  matcher: [
    "/painel/:path*",
    "/comecar/:path*",
    "/assinar/:path*",
    "/integracoes/:path*",
    "/convite/:path*",
    "/entrar",
    "/recuperar-senha",
    "/redefinir-senha",
    "/auth/:path*",
    "/api/:path*",
    "/p/:path*",
    "/r/:path*",
    // subdomínios dos produtos: a raiz e /<slug> do cliente
    { source: "/:slug?", has: [{ type: "header", key: "host", value: "(dash|lps)\\..*" }] },
  ],
};
