import { describe, expect, it } from "vitest";
import { brl } from "@/lib/format";
import { DEFAULT_STATE, fromQuery, quote, startingPrice, toQuery, type PlanState } from "./pricing";
import { buildPlanMessage } from "./messages";

const s = (patch: Partial<PlanState>): PlanState => ({ ...DEFAULT_STATE, ...patch });
const oneClient = { meta: 1, google: 1, ga4: 0, outras: 0 };

describe("casos que precisam bater", () => {
  it("Básico, 1 BM + 1 Google: R$ 96,32 no anual e R$ 141,65 no mensal", () => {
    expect(quote(s({ plano: "base", periodo: "anual", ...oneClient })).monthly).toBe(9632);
    expect(quote(s({ plano: "base", periodo: "mensal", ...oneClient })).monthly).toBe(14165);
  });

  it("Padrão, 1 BM + 1 Google: R$ 186,99 no anual e R$ 274,99 no mensal", () => {
    expect(quote(s({ plano: "pro", periodo: "anual", ...oneClient })).monthly).toBe(18699);
    expect(quote(s({ plano: "pro", periodo: "mensal", ...oneClient })).monthly).toBe(27499);
  });

  it("Avançado, mensal, 1 BM + 1 Google: R$ 1.264,99", () => {
    const q = quote(s({ plano: "avancado", periodo: "mensal", ...oneClient }));
    expect(q.monthly).toBe(126499);
    expect(brl(q.monthly)).toBe("R$ 1.264,99");
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

  it("Padrão anual 1+1 + 1 sob medida recorrente: R$ 385,99/mês + R$ 990", () => {
    const q = quote(s({ plano: "pro", periodo: "anual", ...oneClient, sob: 1, sobm: "recorrente" }));
    expect(brl(q.monthly)).toBe("R$ 385,99");
    expect(q.oneTime).toBe(99000);
  });

  it("extras mensais não têm desconto no anual", () => {
    const q = quote(s({ plano: "pro", ...oneClient, lp: 1, lpcare: true }));
    expect(q.monthlyMensal - q.monthlyAnual).toBe(27499 - 18699);
    expect(q.twelveMonths).toBe((18699 + 9900) * 12 + 95000);
  });
});

describe("regras", () => {
  it("o estado inicial é Padrão, anual, 1 BM + 1 Google", () => {
    expect(quote(DEFAULT_STATE).monthly).toBe(18699);
  });

  it("o preço de entrada do Básico anual é R$ 28,33", () => {
    expect(brl(startingPrice("base", "anual"))).toBe("R$ 28,33");
  });

  it("cobra pelo menos 1 conta, mesmo com zero", () => {
    const q = quote(s({ plano: "pro", meta: 0, google: 0 }));
    expect(q.accountsBilled).toBe(1);
    expect(q.monthly).toBe(8500);
  });

  it("o Básico ignora outras plataformas", () => {
    const q = quote(s({ plano: "base", periodo: "anual", ...oneClient, outras: 3 }));
    expect(q.accountsAccepted).toBe(2);
    expect(q.accountsOutside).toBe(3);
    expect(q.monthly).toBe(9632);
  });

  it("o Padrão conta outras plataformas", () => {
    const q = quote(s({ plano: "pro", periodo: "anual", ...oneClient, outras: 1 }));
    expect(q.accountsBilled).toBe(3);
    expect(q.monthly).toBe(8500 + 2 * 10199);
  });

  it("acima de 30 contas vira sob consulta e cobra no máximo 30", () => {
    const q = quote(s({ meta: 20, google: 11 }));
    expect(q.overLimit).toBe(true);
    expect(q.accountsBilled).toBe(30);
    expect(quote(s({ meta: 15, google: 15 })).overLimit).toBe(false);
  });

  it("a análise por áudio não tem desconto no anual", () => {
    const q = quote(s({ plano: "avancado", ...oneClient }));
    expect(q.monthlyMensal - q.monthlyAnual).toBe(27499 - 18699);
    expect(q.lines.find((l) => l.id === "audio")?.amount).toBe(99000);
  });

  it("economia anual = (mensal − anual) × 12", () => {
    const q = quote(s({ plano: "pro", ...oneClient }));
    expect(q.annualSaving).toBe((27499 - 18699) * 12);
    expect(q.yearly).toBe(18699 * 12);
  });

  it("em 12 meses = plano/mês × 12 + extras", () => {
    const q = quote(s({ plano: "base", periodo: "mensal", ...oneClient, lp: 1, sob: 1, dash: 2 }));
    expect(q.oneTime).toBe(95000 + 190000 + 2 * 9900);
    expect(q.twelveMonths).toBe(14165 * 12 + q.oneTime);
  });

  it("sem plano não cobra mensalidade nem dashboard adicional", () => {
    const q = quote(s({ plano: "sem", lp: 2, dash: 3 }));
    expect(q.monthly).toBe(0);
    expect(q.oneTime).toBe(190000);
    expect(q.overLimit).toBe(false);
  });

  it("Padrão e Avançado mostram o tracking incluso a R$ 0", () => {
    expect(quote(s({ plano: "pro" })).lines.find((l) => l.id === "tracking")?.amount).toBe(0);
    expect(quote(s({ plano: "base" })).lines.some((l) => l.id === "tracking")).toBe(false);
  });
});

describe("URL", () => {
  it("ida e volta pela query string", () => {
    const state = s({ plano: "base", periodo: "mensal", meta: 5, google: 5, lp: 1, lpcare: true, sob: 2, sobm: "recorrente", nicho: "imobiliario" });
    const back = fromQuery(new URLSearchParams(toQuery(state)));
    expect({ ...DEFAULT_STATE, ...back }).toEqual(state);
  });

  it("limita valores fora do teto", () => {
    const back = fromQuery(new URLSearchParams("plano=pro&periodo=anual&meta=500&lp=40&sob=-2"));
    expect(back?.meta).toBe(99);
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
    const state = s({ plano: "pro", periodo: "anual", ...oneClient, lp: 1, nicho: "ecommerce" });
    expect(buildPlanMessage(state, quote(state), url)).toBe(
      [
        "Olá, VYZ! Montei meu plano no site:",
        "• Plano Padrão, anual",
        "• 2 contas (1 BM do Meta e 1 conta do Google Ads)",
        "• Tipo de negócio: E-commerce",
        "• Extras: 1× Landing page feita pelo time",
        "• Todo mês: R$ 186,99 (R$ 2.243,88 no ano)",
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

  it("acima de 30 contas", () => {
    const state = s({ meta: 31 });
    expect(buildPlanMessage(state, quote(state), url).split("\n")[0]).toBe(
      "Olá, VYZ! Tenho 32 contas para conectar e quero montar um plano com um especialista.",
    );
  });
});
