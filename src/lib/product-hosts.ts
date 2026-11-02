// Subdomínio de cada produto: dash.vyzualize.com.br/<cliente> (dashboards) e
// lps.vyzualize.com.br/<cliente> (landing pages). Sem as variáveis, tudo
// segue no mesmo domínio (/painel/w/<cliente>). Roda no proxy e no navegador.

import type { Product } from "@/features/pricing/pricing";

export const PRODUCT_HOSTS: Record<Product, string> = {
  dash: process.env.NEXT_PUBLIC_DASH_HOST ?? "",
  lp: process.env.NEXT_PUBLIC_LPS_HOST ?? "",
};

/** Produto do host da requisição (null = site principal). */
export function productFromHost(host: string | null): Product | null {
  const h = (host ?? "").split(":")[0].toLowerCase();
  if (!h) return null;
  if (PRODUCT_HOSTS.dash && h === PRODUCT_HOSTS.dash) return "dash";
  if (PRODUCT_HOSTS.lp && h === PRODUCT_HOSTS.lp) return "lp";
  return null;
}

/** Endereço de entrada do cliente no produto dele. */
export function productEntryUrl(product: Product, slug: string, query = ""): string {
  const host = PRODUCT_HOSTS[product];
  return host ? `https://${host}/${slug}${query}` : `/painel/w/${slug}${query}`;
}

/** Caminhos que, no subdomínio, não são o slug do cliente. */
export const HOST_RESERVED = new Set(["painel", "comecar", "entrar", "assinar", "auth", "api", "integracoes", "convite", "p", "r", "recuperar-senha", "redefinir-senha", "termos", "privacidade", "_next"]);
