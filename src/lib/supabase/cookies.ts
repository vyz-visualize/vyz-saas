// Cookies da sessão do Supabase. httpOnly: o navegador nunca lê o token (um
// XSS não rouba a sessão); toda chamada autenticada passa pelo servidor.

export const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // ".vyzualize.com.br": a mesma sessão no site, em dash. e em lps.
  ...(process.env.NEXT_PUBLIC_COOKIE_DOMAIN ? { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN } : {}),
} as const;

/** Workspace aberto (quando o usuário participa de mais de um). */
export const ACTIVE_WORKSPACE_COOKIE = "vyz-ws";
/** Workspace (cliente; na tabela, projeto) aberto por último: o painel abre nele e o "Novo dashboard" sem conta nasce nele. */
export const ACTIVE_PROJECT_COOKIE = "vyz-project";

/** Cookie do workspace aberto: mesmo domínio da sessão, por um ano. */
export const WORKSPACE_COOKIE_OPTIONS = { ...AUTH_COOKIE_OPTIONS, maxAge: 60 * 60 * 24 * 365 };
