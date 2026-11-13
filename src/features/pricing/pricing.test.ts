import { describe, expect, it } from "vitest";
import { brl } from "@/lib/format";
import { DEFAULT_STATE, PLAN_PROJECTS, annualSavingPct, annualTotal, fromQuery, quote, startingPrice, toQuery, type PlanState } from "./pricing";
import { buildPlanMessage } from "./messages";

const s = (patch: Partial<PlanState>): PlanState => ({ ...DEFAULT_STATE, ...patch });
describe("casos que precisam bater", () => {
  it("Básico, até 5 projetos: R$ 59,90 no mensal e R$ 579,00 por ano", () => {
    expect(brl(quote(s({ plano: "base", periodo: "mensal" })).monthly)).toBe("R$ 59,90");
    expect(brl(quote(s({ plano: "base", periodo: "anual" })).monthly)).toBe("R$ 48,25");
    expect(brl(quote(s({ plano: "base", periodo: "anual" })).yearly)).toBe("R$ 579,00");
  });

  it("Padrão, até 15 projetos: R$ 219,90 no mensal e R$ 2.199,00 por ano", () => {
    expect(brl(quote(s({ plano: "pro", periodo: "mensal" })).monthly)).toBe("R$ 219,90");
    expect(brl(quote(s({ plano: "pro", periodo: "anual" })).monthly)).toBe("R$ 183,25");
    expect(brl(annualTotal("pro"))).toBe("R$ 2.199,00");
  });

  it("Avançado, até 30 projetos: R$ 499,90 no mensal e R$ 4.899,00 por ano", () => {
    expect(brl(quote(s({ plano: "avancado", periodo: "mensal" })).monthly)).toBe("R$ 499,90");
    expect(brl(quote(s({ plano: "avancado", periodo: "anual" })).monthly)).toBe("R$ 408,25");
    expect(brl(annualTotal("avancado"))).toBe("R$ 4.899,00");
  });

  it("os projetos são fixos por plano: 5, 15 e 30", () => {
    expect(PLAN_PROJECTS).toEqual({ base: 5, pro: 15, avancado: 30 });
    expect(quote(s({ plano: "base" })).projects).toBe(5);
    expect(quote(s({ plano: "pro" })).projects).toBe(15);
    expect(quote(s({ plano: "avancado" })).projects).toBe(30);
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

  it("Padrão anual + 1 sob medida recorrente: R$ 382,25/mês + R$ 990", () => {
    const q = quote(s({ plano: "pro", periodo: "anual", sob: 1, sobm: "recorrente" }));
    expect(brl(q.monthly)).toBe("R$ 382,25");
    expect(q.oneTime).toBe(99000);
  });

  it("extras mensais não têm desconto no anual", () => {
    const q = quote(s({ plano: "pro", lp: 1, lpcare: true }));
    expect(q.monthlyMensal - q.monthlyAnual).toBe(21990 - 18325);
    expect(q.twelveMonths).toBe((18325 + 9900) * 12 + 95000);
  });
});

describe("regras", () => {
  it("o estado inicial é Padrão, anual", () => {
    expect(quote(DEFAULT_STATE).monthly).toBe(18325);
  });

  it("o preço de entrada do Básico anual é R$ 48,25", () => {
    expect(brl(startingPrice("base", "anual"))).toBe("R$ 48,25");
  });

  it("o plano é uma linha só, sem projeto extra nem plataforma extra", () => {
    const q = quote(s({ plano: "base", periodo: "mensal" }));
    expect(q.lines.map((l) => l.id)).toEqual(["plan"]);
    expect(q.lines[0].label).toBe("Plano Básico · até 5 workspaces");
  });

  it("o desconto do anual vem dos preços", () => {
    expect(annualSavingPct("base")).toBe(19);
    expect(annualSavingPct("pro")).toBe(17);
    expect(annualSavingPct("avancado")).toBe(18);
  });

  it("economia anual = (mensal − anual) × 12", () => {
    const q = quote(s({ plano: "pro" }));
    expect(q.annualSaving).toBe((21990 - 18325) * 12);
    expect(q.yearly).toBe(18325 * 12);
  });

  it("em 12 meses = plano/mês × 12 + extras", () => {
    const q = quote(s({ plano: "base", periodo: "mensal", lp: 1, sob: 1, dash: 2 }));
    expect(q.oneTime).toBe(95000 + 190000 + 2 * 9900);
    expect(q.twelveMonths).toBe(5990 * 12 + q.oneTime);
  });

  it("sem plano não cobra mensalidade nem dashboard adicional", () => {
    const q = quote(s({ plano: "sem", lp: 2, dash: 3 }));
    expect(q.monthly).toBe(0);
    expect(q.oneTime).toBe(190000);
  });

  it("dashboard adicional: R$ 99 uma vez (compra avulsa)", () => {
    const q = quote(s({ plano: "base", dash: 1 }));
    expect(q.lines.find((l) => l.id === "dash")?.amount).toBe(9900);
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
        "• até 15 workspaces",
        "• Tipo de negócio: E-commerce",
        "• Extras: 1× Landing page feita pelo time",
        "• Todo mês: R$ 183,25 (R$ 2.199,00 no ano)",
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
