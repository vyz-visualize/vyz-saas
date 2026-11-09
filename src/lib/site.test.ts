import { describe, expect, it } from "vitest";
import { BILLING_LIVE, SITE_INDEXABLE } from "./flags";
import { CRAWLABLE_BEFORE_LAUNCH, PRIVATE_PATHS, REVIEW_CRAWLERS, robotsFor, sitemapFor } from "./site";

describe("indexação do site", () => {
  it("antes do lançamento: as duas flags seguem desligadas", () => {
    expect(SITE_INDEXABLE).toBe(false);
    expect(BILLING_LIVE).toBe(false);
  });

  it("fechado: os robôs só abrem a home e as páginas legais, e o sitemap só tem as legais", () => {
    const rules = robotsFor(false).rules as { userAgent: string | string[]; allow: string[]; disallow: string }[];
    expect(rules[0].userAgent).toEqual(["facebookexternalhit", "Facebot", "Googlebot"]);
    expect(rules[1].userAgent).toBe("*");
    for (const r of rules) {
      expect(r.disallow).toBe("/");
      expect(r.allow).toEqual(CRAWLABLE_BEFORE_LAUNCH);
      for (const p of ["/$", "/privacidade", "/termos", "/exclusao-de-dados"]) expect(r.allow).toContain(p);
      expect(r.allow.some((p) => p.startsWith("/painel"))).toBe(false);
    }
    expect(REVIEW_CRAWLERS).toContain("facebookexternalhit");
    expect(robotsFor(false, "https://exemplo.com.br").sitemap).toBe("https://exemplo.com.br/sitemap.xml");
    expect(sitemapFor(false, "https://exemplo.com.br").map((e) => e.url)).toEqual(["https://exemplo.com.br/termos", "https://exemplo.com.br/privacidade", "https://exemplo.com.br/exclusao-de-dados"]);
  });

  it("aberto: libera o site, mantém o painel fora e aponta o sitemap", () => {
    const r = robotsFor(true, "https://exemplo.com.br");
    expect(r.sitemap).toBe("https://exemplo.com.br/sitemap.xml");
    expect(r.rules).toMatchObject({ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS });
    expect(PRIVATE_PATHS).toContain("/painel");
    expect(sitemapFor(true, "https://exemplo.com.br").map((e) => e.url)).toEqual(["https://exemplo.com.br", "https://exemplo.com.br/termos", "https://exemplo.com.br/privacidade", "https://exemplo.com.br/exclusao-de-dados"]);
  });
});
