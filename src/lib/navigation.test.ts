import { describe, expect, it } from "vitest";
import { isSamePageRequest } from "./navigation";

const PAGE = "/painel/dashboards/d1";
const here = `https://vyzualize.com.br${PAGE}`;

describe("'dashboard visto' só grava na abertura da página", () => {
  it("limpar o último filtro não é abertura: o endereço fica sem filtro, mas o pedido parte da própria página", () => {
    expect(isSamePageRequest({ fetchDest: "empty", referer: `${here}?campanha=c1` }, PAGE)).toBe(true);
  });

  it("aplicar filtro e trocar o período também não", () => {
    expect(isSamePageRequest({ fetchDest: "empty", referer: here }, PAGE)).toBe(true);
    expect(isSamePageRequest({ fetchDest: "empty", referer: `${here}?periodo=7d` }, PAGE)).toBe(true);
  });

  it("abrir pelo endereço ou recarregar é abertura, mesmo com filtro na URL", () => {
    expect(isSamePageRequest({ fetchDest: "document", referer: null }, PAGE)).toBe(false);
    expect(isSamePageRequest({ fetchDest: "document", referer: `${here}?campanha=c1` }, PAGE)).toBe(false);
  });

  it("chegar pela lista ou por outra página do painel é abertura", () => {
    expect(isSamePageRequest({ fetchDest: "empty", referer: "https://vyzualize.com.br/painel/dashboards" }, PAGE)).toBe(false);
    expect(isSamePageRequest({ fetchDest: "empty", referer: "https://vyzualize.com.br/painel/dashboards/d2" }, PAGE)).toBe(false);
  });

  it("sem os cabeçalhos, ou com endereço estranho, conta como abertura", () => {
    expect(isSamePageRequest({ fetchDest: null, referer: null }, PAGE)).toBe(false);
    expect(isSamePageRequest({ fetchDest: "empty", referer: null }, PAGE)).toBe(false);
    expect(isSamePageRequest({ fetchDest: "empty", referer: "não é endereço" }, PAGE)).toBe(false);
  });
});
