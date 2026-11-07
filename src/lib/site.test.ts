import { describe, expect, it } from "vitest";
import { BILLING_LIVE, SITE_INDEXABLE } from "./flags";
import { PRIVATE_PATHS, robotsFor, sitemapFor } from "./site";

describe("indexação do site", () => {
  it("antes do lançamento: as duas flags seguem desligadas", () => {
    expect(SITE_INDEXABLE).toBe(false);
    expect(BILLING_LIVE).toBe(false);
  });

  it("fechado: robots bloqueia tudo e o sitemap sai vazio", () => {
    expect(robotsFor(false)).toEqual({ rules: { userAgent: "*", disallow: "/" } });
    expect(sitemapFor(false)).toEqual([]);
  });

  it("aberto: libera o site, mantém o painel fora e aponta o sitemap", () => {
    const r = robotsFor(true, "https://exemplo.com.br");
    expect(r.sitemap).toBe("https://exemplo.com.br/sitemap.xml");
    expect(r.rules).toMatchObject({ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS });
    expect(PRIVATE_PATHS).toContain("/painel");
    expect(sitemapFor(true, "https://exemplo.com.br").map((e) => e.url)).toEqual(["https://exemplo.com.br", "https://exemplo.com.br/termos", "https://exemplo.com.br/privacidade"]);
  });
});
