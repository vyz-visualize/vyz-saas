// Cookies da sessão do Supabase. httpOnly: o navegador nunca lê o token (um
// XSS não rouba a sessão); toda chamada autenticada passa pelo servidor.

const BASE = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
} as const;

/**
 * O domain do cookie para o host da requisição. NEXT_PUBLIC_COOKIE_DOMAIN (".vyzualize.com.br")
 * deixa a mesma sessão no site, em dash. e em lps., mas só vale quando o host é desse domínio: no
 * preview da Vercel (*.vercel.app) ou no localhost, o navegador recusa um cookie com domain de
 * outro site (o verificador do PKCE some e o login com Google falha). Nesses, sem domain.
 */
export function cookieDomainFor(host: string | null | undefined, configured = process.env.NEXT_PUBLIC_COOKIE_DOMAIN): string | undefined {
  const domain = configured?.trim().toLowerCase().replace(/^\./, "");
  if (!domain) return undefined;
  const hostname = (host ?? "").trim().toLowerCase().split(":")[0];
  return hostname === domain || hostname.endsWith(`.${domain}`) ? configured : undefined;
}

/** Opções dos cookies da sessão para o host da requisição (o domain, só no domínio configurado). */
export function authCookieOptions(host: string | null | undefined) {
  const domain = cookieDomainFor(host);
  return { ...BASE, ...(domain ? { domain } : {}) };
}

/** Workspace aberto (quando o usuário participa de mais de um). */
export const ACTIVE_WORKSPACE_COOKIE = "vyz-ws";
/** Workspace (cliente; na tabela, projeto) aberto por último: o painel abre nele e o "Novo dashboard" sem conta nasce nele. */
export const ACTIVE_PROJECT_COOKIE = "vyz-project";

/** Cookie do workspace aberto: mesmo domínio da sessão, por um ano. */
export function workspaceCookieOptions(host: string | null | undefined) {
  return { ...authCookieOptions(host), maxAge: 60 * 60 * 24 * 365 };
}
