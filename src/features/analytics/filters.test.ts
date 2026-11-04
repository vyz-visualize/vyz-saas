import { describe, expect, it } from "vitest";
import { clampDays, comparedDays, filterSearch, filterSummary, hasFilters, NO_FILTERS, notFilteredDims, notFilteredText, parseFilters, rangeLabel, removeFilter, toggleDays, toggleFilter } from "./filters";

describe("URL", () => {
  it("lê e escreve os filtros, mantendo o resto do endereço", () => {
    const f = parseFilters({ campanha: "b,a,a", anuncio: "x", plataforma: "meta", de: "2026-10-10", ate: "2026-10-15" });
    expect(f).toEqual({ campaigns: ["a", "b"], ads: ["x"], platforms: ["meta"], days: { from: "2026-10-10", to: "2026-10-15" } });
    expect(filterSearch("periodo=7d&pagina=campanhas", f)).toBe("?periodo=7d&pagina=campanhas&campanha=a,b&anuncio=x&plataforma=meta&de=2026-10-10&ate=2026-10-15");
    expect(parseFilters(new URLSearchParams(filterSearch("", f)))).toEqual(f);
  });

  it("sem filtro, a URL fica limpa", () => {
    expect(filterSearch("campanha=a&de=2026-10-10&ate=2026-10-11&periodo=7d", NO_FILTERS)).toBe("?periodo=7d");
    expect(filterSearch("campanha=a", NO_FILTERS)).toBe("");
  });

  it("ignora o que não vale", () => {
    expect(parseFilters({ campanha: "<script>,a b,ok", de: "ontem", ate: "2026-10-15" })).toEqual({ ...NO_FILTERS, campaigns: ["ok"] });
    expect(parseFilters({ de: "2026-10-15", ate: "2026-10-10" }).days).toBeNull();
    expect(parseFilters({ campanha: Array.from({ length: 40 }, (_, i) => `c${i}`).join(",") }).campaigns).toHaveLength(20);
  });
});

describe("clique", () => {
  it("clicar filtra; clicar de novo tira; outro item troca", () => {
    const a = toggleFilter(NO_FILTERS, "campaigns", "a");
    expect(a.campaigns).toEqual(["a"]);
    expect(toggleFilter(a, "campaigns", "b").campaigns).toEqual(["b"]);
    expect(hasFilters(toggleFilter(a, "campaigns", "a"))).toBe(false);
  });

  it("Cmd/Ctrl soma na mesma dimensão, e dimensões diferentes se combinam", () => {
    const two = toggleFilter(toggleFilter(NO_FILTERS, "campaigns", "a"), "campaigns", "b", true);
    expect(two.campaigns).toEqual(["a", "b"]);
    expect(toggleFilter(two, "campaigns", "a", true).campaigns).toEqual(["b"]);
    const both = toggleDays(toggleFilter(two, "ads", "x"), { from: "2026-10-01", to: "2026-10-02" });
    expect(both).toEqual({ campaigns: ["a", "b"], ads: ["x"], platforms: [], days: { from: "2026-10-01", to: "2026-10-02" } });
  });

  it("o mesmo trecho tira o filtro de dias", () => {
    const days = { from: "2026-10-01", to: "2026-10-02" };
    expect(toggleDays(toggleDays(NO_FILTERS, days), days).days).toBeNull();
  });

  it("remove um item, uma dimensão ou os dias", () => {
    const f = { ...NO_FILTERS, campaigns: ["a", "b"], days: { from: "2026-10-01", to: "2026-10-02" } };
    expect(removeFilter(f, "campaigns", "a").campaigns).toEqual(["b"]);
    expect(removeFilter(f, "campaigns").campaigns).toEqual([]);
    expect(removeFilter(f, "days").days).toBeNull();
  });
});

describe("dias", () => {
  const period = { from: "2026-10-01", to: "2026-10-30" };

  it("fica dentro do período; fora dele, ou no período inteiro, não há filtro", () => {
    expect(clampDays({ from: "2026-09-20", to: "2026-10-05" }, period)).toEqual({ from: "2026-10-01", to: "2026-10-05" });
    expect(clampDays({ from: "2026-11-01", to: "2026-11-02" }, period)).toBeNull();
    expect(clampDays(period, period)).toBeNull();
  });

  it("compara com os mesmos dias do período anterior, e o rótulo diz qual é o trecho", () => {
    const compared = comparedDays({ from: "2026-10-10", to: "2026-10-15" }, 30);
    expect(compared).toEqual({ from: "2026-09-10", to: "2026-09-15" });
    expect(rangeLabel(compared)).toBe("10–15/09");
    expect(rangeLabel({ from: "2026-08-28", to: "2026-09-02" })).toBe("28/08–02/09");
    expect(rangeLabel({ from: "2026-09-10", to: "2026-09-10" })).toBe("10/09");
  });
});

describe("selo", () => {
  it("só aparece com um filtro que a parte não alcança", () => {
    expect(notFilteredDims("breakdown", NO_FILTERS)).toEqual([]);
    expect(notFilteredDims("breakdown", { ...NO_FILTERS, days: { from: "2026-10-01", to: "2026-10-02" } })).toEqual([]);
    expect(notFilteredText(notFilteredDims("breakdown", { ...NO_FILTERS, campaigns: ["a"] }))).toBe("não filtrado por Campanha");
    expect(notFilteredText(notFilteredDims("breakdown", { ...NO_FILTERS, campaigns: ["a"], ads: ["b"] }))).toBe("não filtrado por Campanha e Anúncio");
    expect(notFilteredText(notFilteredDims("funnel", { ...NO_FILTERS, campaigns: ["a"] }))).toBeNull();
  });

  it("resume os filtros numa frase", () => {
    expect(filterSummary({ ...NO_FILTERS, campaigns: ["a"], days: { from: "2026-10-10", to: "2026-10-15" } }, { campaigns: { a: "Loja" } })).toBe("Campanha Loja, Dias 10–15/10");
  });
});
