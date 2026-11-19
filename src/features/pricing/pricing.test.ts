import { describe, expect, it } from "vitest";
import { brl } from "@/lib/format";
import { STORE_PLAN_PRICE, STORE_PLAN_PROJECTS } from "@vyz/shared";
import { DEFAULT_STATE, PLAN_PROJECTS, annualSavingPct, maxAnnualSavingPct, projectsLabel, annualTotal, fromQuery, quote, startingPrice, toQuery, type PlanState } from "./pricing";
import { buildPlanMessage } from "./messages";

const s = (patch: Partial<PlanState>): PlanState => ({ ...DEFAULT_STATE, ...patch });
describe("casos que precisam bater", () => {
  it("Básico, até 3 workspaces: R$ 49,90 no mensal e R$ 499,90 por ano (≈ R$ 41,66/mês)", () => {
    expect(brl(quote(s({ plano: "base", periodo: "mensal" })).monthly)).toBe("R$ 49,90");
    expect(brl(quote(s({ plano: "base", periodo: "anual" })).monthly)).toBe("R$ 41,66");
    expect(brl(quote(s({ plano: "base", periodo: "anual" })).yearly)).toBe("R$ 499,90");
  });

  it("Padrão, até 5 workspaces: R$ 149,90 no mensal e R$ 1.499,90 por ano (≈ R$ 124,99/mês)", () => {
    expect(brl(quote(s({ plano: "pro", periodo: "mensal" })).monthly)).toBe("R$ 149,90");
    expect(brl(quote(s({ plano: "pro", periodo: "anual" })).monthly)).toBe("R$ 124,99");
    expect(brl(annualTotal("pro"))).toBe("R$ 1.499,90");
    expect(brl(quote(s({ plano: "pro", periodo: "anual" })).yearly)).toBe("R$ 1.499,90");
  });

  it("Avançado, workspaces ilimitados: R$ 299,90 no mensal e R$ 2.999,90 por ano (≈ R$ 249,99/mês)", () => {
    expect(brl(quote(s({ plano: "avancado", periodo: "mensal" })).monthly)).toBe("R$ 299,90");
    expect(brl(quote(s({ plano: "avancado", periodo: "anual" })).monthly)).toBe("R$ 249,99");
    expect(brl(annualTotal("avancado"))).toBe("R$ 2.999,90");
  });

  it("os workspaces são fixos por plano: 3, 5 e ilimitados (a assinatura grava 200)", () => {
    expect(PLAN_PROJECTS).toEqual({ base: 3, pro: 5, avancado: 200 });
    expect(STORE_PLAN_PROJECTS).toEqual(PLAN_PROJECTS); // o app concede o mesmo limite do site
    expect([projectsLabel("base"), projectsLabel("pro"), projectsLabel("avancado")]).toEqual(["até 3 workspaces", "até 5 workspaces", "workspaces ilimitados"]);
    expect(quote(s({ plano: "base" })).projects).toBe(3);
    expect(quote(s({ plano: "pro" })).projects).toBe(5);
    expect(quote(s({ plano: "avancado" })).projects).toBe(200);
    expect(quote(s({ plano: "sem" })).projects).toBe(0);
  });

  it("1 landing page: R$ 950 uma vez", () => {
    expect(quote(s({ lp: 1 })).oneTime).toBe(95000);
    expect(quote(s({ plano: "sem", lp: 1 })).oneTime).toBe(95000);
  });

  it("1 sob medida recorrente sem plano: R$ 990 uma vez + R$ 199/mês", () => {
    const q = quote(s({ plano: "sem", sob: 1, sobm: "recorrente" }));
    expect(q.oneTime).toBe(99000);
    expect(q.monthly).toBe(19900);
  });

  it("2 LPs com hospedagem: R$ 1.900 + R$ 198/mês", () => {
    const q = quote(s({ plano: "sem", lp: 2, lpcare: true }));
    expect(q.oneTime).toBe(190000);
    expect(q.monthly).toBe(19800);
  });

  it("Padrão anual + 1 sob medida recorrente: ≈ R$ 323,99/mês, R$ 3.887,90 no ano + R$ 990", () => {
    const q = quote(s({ plano: "pro", periodo: "anual", sob: 1, sobm: "recorrente" }));
    expect(brl(q.monthly)).toBe("R$ 323,99");
    // o plano pelo total exato do ano, o extra mensal × 12
    expect(q.yearly).toBe(149990 + 19900 * 12);
    expect(q.oneTime).toBe(99000);
  });

  it("extras mensais não têm desconto no anual", () => {
    const q = quote(s({ plano: "pro", lp: 1, lpcare: true }));
    expect(q.monthlyMensal - q.monthlyAnual).toBe(14990 - 12499);
    expect(q.twelveMonths).toBe(149990 + 9900 * 12 + 95000);
  });
});

describe("regras", () => {
  it("o estado inicial é Padrão, anual", () => {
    expect(quote(DEFAULT_STATE).monthly).toBe(12499);
    expect(quote(DEFAULT_STATE).yearly).toBe(149990);
  });

  it("o preço de entrada do Básico anual é ≈ R$ 41,66 por mês", () => {
    expect(brl(startingPrice("base", "anual"))).toBe("R$ 41,66");
  });

  it("o plano é uma linha só, sem projeto extra nem plataforma extra", () => {
    const q = quote(s({ plano: "base", periodo: "mensal" }));
    expect(q.lines.map((l) => l.id)).toEqual(["plan"]);
    expect(q.lines[0].label).toBe("Plano Básico · até 3 workspaces");
  });

  it("o desconto do anual vem dos preços: ~17% nos três", () => {
    expect(annualSavingPct("base")).toBe(17);
    expect(maxAnnualSavingPct()).toBe(17); // "até −17%" nos seletores de período
    expect(annualSavingPct("pro")).toBe(17);
    expect(annualSavingPct("avancado")).toBe(17);
  });

  it("economia anual = 12 meses no mensal − total do ano", () => {
    const q = quote(s({ plano: "pro" }));
    expect(q.annualSaving).toBe(14990 * 12 - 149990);
    expect(q.yearly).toBe(149990);
  });

  it("em 12 meses = plano/mês × 12 + extras", () => {
    const q = quote(s({ plano: "base", periodo: "mensal", lp: 1, sob: 1, dash: 2 }));
    expect(q.oneTime).toBe(95000 + 190000 + 2 * 9900);
    expect(q.twelveMonths).toBe(4990 * 12 + q.oneTime);
  });

  it("sem plano não cobra mensalidade nem dashboard adicional", () => {
    const q = quote(s({ plano: "sem", lp: 2, dash: 3 }));
    expect(q.monthly).toBe(0);
    expect(q.oneTime).toBe(190000);
  });

  it("dashboard adicional: R$ 99, pagamento único (compra avulsa)", () => {
    const q = quote(s({ plano: "base", dash: 1 }));
    const line = q.lines.find((l) => l.id === "dash");
    expect(line).toMatchObject({ amount: 9900, kind: "once", detail: "1 × R$ 99,00 · pagamento único" });
    expect(q.monthly).toBe(q.planMonthly); // não entra na mensalidade
  });

  it("dashboard adicional na mensagem do WhatsApp: pagamento único", () => {
    const state = s({ plano: "pro", dash: 2 });
    expect(buildPlanMessage(state, quote(state), "u")).toContain("2× Dashboard adicional (R$ 99 cada, pagamento único)");
  });

  it("anual: o total do ano é o mesmo do site e das lojas (pontos de preço da Apple, em ,90)", () => {
    expect([annualTotal("base"), annualTotal("pro"), annualTotal("avancado")]).toEqual([49990, 149990, 299990]);
    expect(STORE_PLAN_PRICE).toEqual({
      base: { mensal: 4990, anual: 49990 },
      pro: { mensal: 14990, anual: 149990 },
      avancado: { mensal: 29990, anual: 299990 },
    });
    // o por mês do anual é só para mostrar: total ÷ 12, arredondado
    expect([startingPrice("base", "anual"), startingPrice("pro", "anual"), startingPrice("avancado", "anual")]).toEqual([4166, 12499, 24999]);
  });
});

describe("URL", () => {
  it("ida e volta pela query string", () => {
    const state = s({ plano: "base", periodo: "mensal", lp: 1, lpcare: true, sob: 2, sobm: "recorrente", nicho: "imobiliario" });
    const back = fromQuery(new URLSearchParams(toQuery(state)));
    expect({ ...DEFAULT_STATE, ...back }).toEqual(state);
  });

  it("limita valores fora do teto e ignora projetos antigos na query", () => {
    const back = fromQuery(new URLSearchParams("plano=pro&periodo=anual&workspaces=500&plataformas=2&lp=40&sob=-2"));
    expect(back).not.toHaveProperty("workspaces");
    expect(back).not.toHaveProperty("plataformas");
    expect(back?.lp).toBe(10);
    expect(back?.sob).toBe(0);
  });

  it("sem plano e período na query, não restaura nada", () => {
    expect(fromQuery(new URLSearchParams("utm_source=x"))).toBeNull();
  });
});

describe("mensagem do WhatsApp", () => {
  const url = "https://vyz.app/?plano=pro";

  it("plano pronto", () => {
    const state = s({ plano: "pro", periodo: "anual", lp: 1, nicho: "ecommerce" });
    expect(buildPlanMessage(state, quote(state), url)).toBe(
      [
        "Olá, VYZ! Montei meu plano no site:",
        "• Plano Padrão, anual",
        "• até 5 workspaces",
        "• Tipo de negócio: E-commerce",
        "• Extras: 1× Landing page feita pelo time",
        "• Todo mês: R$ 124,99 (R$ 1.499,90 no ano)",
        "• Uma vez: R$ 950,00",
        `Simulação: ${url}`,
        "Podemos seguir?",
      ].join("\n"),
    );
  });

  it("sem plano", () => {
    const state = s({ plano: "sem", sob: 1 });
    const msg = buildPlanMessage(state, quote(state), url);
    expect(msg.startsWith("Olá, VYZ! Quero só os extras:\n• 1× Dashboard sob medida: R$ 1.900,00")).toBe(true);
    const rec = s({ plano: "sem", sob: 1, sobm: "recorrente" });
    expect(buildPlanMessage(rec, quote(rec), url)).toContain("• 1× Dashboard sob medida · mensal: R$ 199,00/mês");
  });
});
