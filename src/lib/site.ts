// Endereço oficial e regras de indexação do site público (robots.txt e sitemap).
// Funções puras: a flag SITE_INDEXABLE decide em app/robots.ts e app/sitemap.ts.

import type { MetadataRoute } from "next";

/** Domínio oficial, o mesmo do metadataBase da raiz. */
export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.vyzualize.com.br").replace(/\/+$/, "");

/** Páginas públicas que entram no sitemap. */
export const PUBLIC_PATHS = ["/", "/termos", "/privacidade", "/exclusao-de-dados"] as const;

/** As páginas legais: indexáveis desde já, antes do lançamento. */
export const LEGAL_PATHS = ["/termos", "/privacidade", "/exclusao-de-dados"] as const;

/**
 * O que os robôs podem abrir antes do lançamento: a home ("/$" é só a raiz), as páginas legais
 * (a Meta e o Google conferem esses endereços na revisão dos apps) e os arquivos delas.
 * Abrir não é indexar: até o lançamento, a home segue com noindex.
 */
export const CRAWLABLE_BEFORE_LAUNCH = ["/$", ...LEGAL_PATHS, "/_next/static/", "/opengraph-image"];

/** Citados à parte: quem tem grupo próprio no robots.txt ignora o grupo "*". */
export const REVIEW_CRAWLERS = ["facebookexternalhit", "Facebot", "Googlebot"];

/** O que nunca é indexado, mesmo com o site aberto: painel, checkout, links de cliente e API. */
export const PRIVATE_PATHS = ["/painel", "/assinar", "/comecar", "/integracoes", "/convite", "/entrar", "/r/", "/api/"];

export function robotsFor(indexable: boolean, origin = SITE_ORIGIN): MetadataRoute.Robots {
  if (!indexable) {
    return {
      rules: [
        { userAgent: REVIEW_CRAWLERS, allow: CRAWLABLE_BEFORE_LAUNCH, disallow: "/" },
        { userAgent: "*", allow: CRAWLABLE_BEFORE_LAUNCH, disallow: "/" },
      ],
      sitemap: `${origin}/sitemap.xml`,
    };
  }
  return { rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }, sitemap: `${origin}/sitemap.xml` };
}

export function sitemapFor(indexable: boolean, origin = SITE_ORIGIN): MetadataRoute.Sitemap {
  const paths = indexable ? PUBLIC_PATHS : LEGAL_PATHS;
  return paths.map((path) => ({ url: `${origin}${path === "/" ? "" : path}`, changeFrequency: path === "/" ? "weekly" : "yearly", priority: path === "/" ? 1 : 0.3 }));
}
