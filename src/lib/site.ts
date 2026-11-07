// Endereço oficial e regras de indexação do site público (robots.txt e sitemap).
// Funções puras: a flag SITE_INDEXABLE decide em app/robots.ts e app/sitemap.ts.

import type { MetadataRoute } from "next";

/** Domínio oficial, o mesmo do metadataBase da raiz. */
export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.vyzualize.com.br").replace(/\/+$/, "");

/** Páginas públicas que entram no sitemap. */
export const PUBLIC_PATHS = ["/", "/termos", "/privacidade"] as const;

/** O que nunca é indexado, mesmo com o site aberto: painel, checkout, links de cliente e API. */
export const PRIVATE_PATHS = ["/painel", "/assinar", "/comecar", "/integracoes", "/convite", "/entrar", "/r/", "/api/"];

export function robotsFor(indexable: boolean, origin = SITE_ORIGIN): MetadataRoute.Robots {
  if (!indexable) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }, sitemap: `${origin}/sitemap.xml` };
}

export function sitemapFor(indexable: boolean, origin = SITE_ORIGIN): MetadataRoute.Sitemap {
  if (!indexable) return [];
  return PUBLIC_PATHS.map((path) => ({ url: `${origin}${path === "/" ? "" : path}`, changeFrequency: path === "/" ? "weekly" : "yearly", priority: path === "/" ? 1 : 0.3 }));
}
