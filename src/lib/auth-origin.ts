// Origem para onde o login volta (Google, Apple, links de e-mail): a da própria requisição, se for
// confiável; senão, o site principal. Assim o preview da Vercel volta para o preview, e não para o
// www. O app nativo (vyz://auth) tem o seu próprio retorno e não passa por aqui.

const MAIN_HOST = "www.vyzualize.com.br";
/** Previews de branch da Vercel deste projeto: https://vyz-saas-git-<branch>-vyzualize.vercel.app */
const PREVIEW_HOST = /^vyz-saas-git-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-vyzualize\.vercel\.app$/;

/**
 * A origem confiável para o host da requisição, ou null. Só três: o site principal (https), o
 * localhost:3000 (http) e os previews de branch (https). Nada de usuário, outra porta ou sufixo.
 */
export function trustedOrigin(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = host.trim().toLowerCase();
  if (h === MAIN_HOST) return `https://${MAIN_HOST}`;
  if (h === "localhost:3000") return "http://localhost:3000";
  if (PREVIEW_HOST.test(h)) return `https://${h}`;
  return null;
}

/** A origem da requisição se for confiável; senão, a reserva (o site principal). */
export function authOrigin(host: string | null | undefined, fallback: string): string {
  return trustedOrigin(host) ?? fallback;
}
