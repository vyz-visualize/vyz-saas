import { describe, expect, it } from "vitest";
import { ALL_DASHBOARD_TEMPLATES } from "./live";
import { CATEGORY_WORDS, EXAMPLE_REQUESTS, fallbackTemplates, matchesSearch, plain, recommendTemplates, TEMPLATE_WORDS } from "./recommend";

const all = { tier: "avancado" as const, enabledAccounts: { meta: 1, google: 1 } };
const ids = (text: string, o = all) => recommendTemplates(text, o).map((r) => r.template.id);

describe("recommendTemplates", () => {
  it("entende o tipo de negócio", () => {
    expect(ids("quero um dashboard para minha loja virtual")[0]).toMatch(/ecommerce|lavanda/);
    expect(ids("imobiliária, custo por lead e visitas")[0]).toBe("imobiliario-leads");
    expect(ids("clínica odontológica, agendamentos")[0]).toBe("clinicas-saude");
    expect(ids("faculdade, acompanhar matrículas")[0]).toBe("educacao-matriculas");
    expect(ids("todos os clientes da agência numa tela")[0]).toBe("agencia-carteira");
  });

  it("entende a plataforma e prefere o modelo dedicado", () => {
    expect(ids("campanhas do tiktok")[0]).toBe("tiktok-ads");
    expect(ids("vídeos no YouTube")[0]).toBe("youtube-video");
    expect(ids("anúncios no mercado livre e shopee")[0]).toBe("marketplace");
    expect(ids("funil do site no GA4")[0]).toBe("funil-ga4");
  });

  it("entende o que a pessoa quer acompanhar", () => {
    expect(ids("leads do CRM até a venda, RD Station")[0]).toBe("crm-lead-venda");
    expect(ids("relatório para a diretoria")[0]).toBe("relatorio-executivo");
    expect(ids("previsão de receita até o fim do mês")[0]).toBe("previsao-kpis");
    expect(ids("comparar os canais lado a lado")[0]).toBe("comparativo-canais");
    expect(ids("quais criativos renovar")).toContain("criativos-meta");
  });

  it('"meta do mês" é objetivo, não a plataforma Meta', () => {
    expect(ids("acompanhar a meta do mês e a verba")[0]).toBe("metas-pacing");
    expect(recommendTemplates("acompanhar a meta do mês", all)[0].reasons).not.toContain("Meta Ads");
    expect(recommendTemplates("loja no meta e no google", all)[0].reasons).toContain("Meta Ads");
  });

  it("ignora acento e maiúsculas", () => {
    expect(ids("IMOBILIARIA")).toEqual(ids("imobiliária"));
    expect(plain("  Relatório   Executivo ")).toBe("relatorio executivo");
  });

  it("sem sinal claro não inventa", () => {
    expect(ids("")).toEqual([]);
    expect(ids("oi")).toEqual([]);
    expect(ids("xyzabc qualquer coisa")).toEqual([]);
  });

  it("marca o que o plano não libera e o que precisa de conta", () => {
    const base = recommendTemplates("relatório para a diretoria", { tier: "base", enabledAccounts: {} });
    expect(base[0].locked).toBe(true);
    const live = recommendTemplates("dados reais das minhas contas do facebook", { tier: "base", enabledAccounts: {} });
    expect(live.find((r) => r.template.id === "meta-ecommerce")?.needsAccount).toBe(true);
  });

  it("prefere dados reais quando há conta ativa", () => {
    expect(ids("loja virtual no facebook e instagram, dados reais")[0]).toBe("meta-ecommerce");
  });

  it("devolve no máximo três, sem repetir", () => {
    const r = ids("loja virtual com meta, google e analytics, receita e roas");
    expect(r.length).toBeLessThanOrEqual(3);
    expect(new Set(r).size).toBe(r.length);
  });

  it("os exemplos do popup sempre encontram um modelo", () => {
    for (const e of EXAMPLE_REQUESTS) expect(ids(e).length, e).toBeGreaterThan(0);
  });
});

describe("fallbackTemplates", () => {
  it("só sugere o que dá para usar agora, dados reais primeiro", () => {
    const r = fallbackTemplates({ tier: "base", enabledAccounts: { meta: 1 } });
    expect(r[0].template.id).toBe("meta-ecommerce");
    expect(r.every((x) => !x.locked && !x.needsAccount)).toBe(true);
  });
});

describe("dicionário", () => {
  it("toda entrada de TEMPLATE_WORDS é de um modelo que existe", () => {
    const known = new Set(ALL_DASHBOARD_TEMPLATES.map((t) => t.id));
    expect(Object.keys(TEMPLATE_WORDS).filter((id) => !known.has(id))).toEqual([]);
  });
  it("todo modelo tem palavras próprias e toda categoria também", () => {
    expect(ALL_DASHBOARD_TEMPLATES.filter((t) => !TEMPLATE_WORDS[t.id]?.length).map((t) => t.id)).toEqual([]);
    for (const t of ALL_DASHBOARD_TEMPLATES) expect(CATEGORY_WORDS[t.category].length).toBeGreaterThan(0);
  });
});

describe("busca da galeria", () => {
  const found = (q: string) => ALL_DASHBOARD_TEMPLATES.filter((t) => matchesSearch(t, q)).map((t) => t.id);

  it("acha sem acento e pela palavra que a pessoa usa", () => {
    expect(found("imobiliaria")).toContain("imobiliario-leads");
    expect(found("clinica")).toContain("clinicas-saude");
    expect(found("faculdade")).toContain("educacao-matriculas");
    expect(found("rd station")).toContain("crm-lead-venda");
  });

  it("acha pela plataforma e exige todas as palavras", () => {
    expect(found("tiktok")).toContain("tiktok-ads");
    expect(found("tiktok")).not.toContain("google-pesquisa");
    expect(found("loja tiktok")).not.toContain("tiktok-ads");
  });

  it("vazio mostra tudo; sem sentido não mostra nada", () => {
    expect(found("  ").length).toBe(ALL_DASHBOARD_TEMPLATES.length);
    expect(found("xyzabc")).toEqual([]);
  });
});
