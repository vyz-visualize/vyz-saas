import { describe, expect, it } from "vitest";
import { brl } from "@/lib/format";
import { DEFAULT_STATE, INCLUDED_PROJECTS, annualSavingPct, fromQuery, quote, startingPrice, toQuery, type PlanState } from "./pricing";
import { buildPlanMessage } from "./messages";

const s = (patch: Partial<PlanState>): PlanState => ({ ...DEFAULT_STATE, ...patch });
describe("casos que precisam bater", () => {
  it("Básico com 3 projetos: R$ 39,90 no anual e R$ 49,90 no mensal", () => {
    expect(quote(s({ plano: "base", periodo: "anual" })).monthly).toBe(3990);
    expect(quote(s({ plano: "base", periodo: "mensal" })).monthly).toBe(4990);
  });

  it("Padrão com 3 projetos: R$ 59,90 no anual e R$ 79,90 no mensal", () => {
    expect(quote(s({ plano: "pro", periodo: "anual" })).monthly).toBe(5990);
    expect(quote(s({ plano: "pro", periodo: "mensal" })).monthly).toBe(7990);
  });

  it("Avançado com 3 projetos: R$ 99,90 no anual e R$ 129,90 no mensal", () => {
    expect(quote(s({ plano: "avancado", periodo: "anual" })).monthly).toBe(9990);
    expect(brl(quote(s({ plano: "avancado", periodo: "mensal" })).monthly)).toBe("R$ 129,90");
  });

  it("Padrão anual com 5 projetos: R$ 97,70 (Reportei Pro com 5: R$ 109,90)", () => {
    expect(quote(s({ plano: "pro", periodo: "anual", projetos: 5 })).monthly).toBe(5990 + 2 * 1890);
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

  it("Padrão anual + 1 sob medida recorrente: R$ 258,90/mês + R$ 990", () => {
    const q = quote(s({ plano: "pro", periodo: "anual", sob: 1, sobm: "recorrente" }));
    expect(brl(q.monthly)).toBe("R$ 258,90");
    expect(q.oneTime).toBe(99000);
  });

  it("extras mensais não têm desconto no anual", () => {
    const q = quote(s({ plano: "pro", lp: 1, lpcare: true }));
    expect(q.monthlyMensal - q.monthlyAnual).toBe(7990 - 5990);
    expect(q.twelveMonths).toBe((5990 + 9900) * 12 + 95000);
  });
});

describe("regras", () => {
  it("o estado inicial é Padrão, anual, 3 projetos", () => {
    expect(DEFAULT_STATE.projetos).toBe(INCLUDED_PROJECTS);
    expect(quote(DEFAULT_STATE).monthly).toBe(5990);
  });

  it("o preço de entrada do Básico anual é R$ 39,90", () => {
    expect(brl(startingPrice("base", "anual"))).toBe("R$ 39,90");
  });

  it("cobra pelo menos os 3 projetos inclusos", () => {
    const q = quote(s({ plano: "pro", projetos: 1 }));
    expect(q.projects).toBe(3);
    expect(q.monthly).toBe(5990);
  });

  it("cada projeto a mais soma o preço do plano", () => {
    const q = quote(s({ plano: "base", periodo: "mensal", projetos: 6 }));
    expect(q.monthly).toBe(4990 + 3 * 1290);
    expect(q.lines.find((l) => l.id === "projects")?.label).toBe("3 projetos a mais");
  });

  it("acima de 200 projetos vira sob consulta e cobra no máximo 200", () => {
    const q = quote(s({ projetos: 201 }));
    expect(q.overLimit).toBe(true);
    expect(q.projects).toBe(200);
    expect(quote(s({ projetos: 200 })).overLimit).toBe(false);
  });

  it("plataforma extra só no Básico, R$ 49,90/mês sem desconto no anual", () => {
    const q = quote(s({ plano: "base", periodo: "anual", plataformas: 2 }));
    expect(q.monthly).toBe(3990 + 2 * 4990);
    expect(q.monthlyMensal - q.monthlyAnual).toBe(4990 - 3990);
    expect(quote(s({ plano: "pro", plataformas: 2 })).monthly).toBe(5990);
  });

  it("o desconto do anual vem dos preços", () => {
    expect(annualSavingPct("base")).toBe(20);
    expect(annualSavingPct("pro")).toBe(25);
  });

  it("economia anual = (mensal − anual) × 12", () => {
    const q = quote(s({ plano: "pro" }));
    expect(q.annualSaving).toBe((7990 - 5990) * 12);
    expect(q.yearly).toBe(5990 * 12);
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
    expect(q.overLimit).toBe(false);
  });

  it("o plano não traz serviço incluso (só o plano e os extras)", () => {
    expect(quote(s({ plano: "pro" })).lines.map((l) => l.id)).toEqual(["plan"]);
  });
});

describe("URL", () => {
  it("ida e volta pela query string", () => {
    const state = s({ plano: "base", periodo: "mensal", projetos: 7, plataformas: 1, lp: 1, lpcare: true, sob: 2, sobm: "recorrente", nicho: "imobiliario" });
    const back = fromQuery(new URLSearchParams(toQuery(state)));
    expect({ ...DEFAULT_STATE, ...back }).toEqual(state);
  });

  it("limita valores fora do teto", () => {
    const back = fromQuery(new URLSearchParams("plano=pro&periodo=anual&projetos=500&lp=40&sob=-2"));
    expect(back?.projetos).toBe(201);
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
    const state = s({ plano: "pro", periodo: "anual", projetos: 4, lp: 1, nicho: "ecommerce" });
    expect(buildPlanMessage(state, quote(state), url)).toBe(
      [
        "Olá, VYZ! Montei meu plano no site:",
        "• Plano Padrão, anual",
        "• 4 projetos",
        "• Tipo de negócio: E-commerce",
        "• Extras: 1× Landing page feita pelo time",
        "• Todo mês: R$ 78,80 (R$ 945,60 no ano)",
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

  it("acima de 200 projetos", () => {
    const state = s({ projetos: 201 });
    expect(buildPlanMessage(state, quote(state), url).split("\n")[0]).toBe(
      "Olá, VYZ! Tenho 201 projetos (clientes) e quero montar um plano com um especialista.",
    );
  });
});
