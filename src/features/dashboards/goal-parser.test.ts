import { describe, expect, it } from "vitest";
import { normalize, parseGoalText } from "./goal-parser";
import { describeGoal } from "./goals";

const TODAY = "2026-11-12"; // quinta-feira

function ok(text: string, today = TODAY) {
  const r = parseGoalText(text, today);
  if (!r.ok) throw new Error(`não leu "${text}": ${r.error}`);
  return r;
}

describe("normalize", () => {
  it("tira acento, caixa e espaço extra", () => {
    expect(normalize("  Até   o MÊS ")).toBe("ate o mes");
    expect(normalize("1ª semana")).toBe("1a semana");
  });
});

describe("parseGoalText: exemplos do produto", () => {
  it("CPM de 6,50 na primeira semana: custo, então atingir = no máximo", () => {
    const { goal } = ok("quero atingir um CPM de 6,50 na primeira semana");
    expect(goal).toMatchObject({ metric: "cpm", value: 650, direction: "max", period: { kind: "firstWeek" } });
    expect(describeGoal(goal)).toBe("CPM no máximo R$ 6,50 · primeira semana do mês");
  });

  it("CPL abaixo de 20 reais esse mês", () => {
    const { goal, assumed } = ok("CPL abaixo de 20 reais esse mês");
    expect(goal).toMatchObject({ metric: "cpl", value: 2000, direction: "max", period: { kind: "month" } });
    expect(assumed).toEqual([]);
  });

  it("500 leads em dezembro: volume, pelo menos, mês inteiro", () => {
    const { goal } = ok("500 leads em dezembro");
    expect(goal).toMatchObject({ metric: "leads", value: 500, direction: "min", period: { kind: "custom", from: "2026-12-01", to: "2026-12-31" } });
  });
});

describe("parseGoalText: métricas", () => {
  it.each([
    ["custo por lead de 15", "cpl"],
    ["custo por lead qualificado de 40", "cplq"],
    ["custo por venda de 80", "cpa"],
    ["CPA de 80", "cpa"],
    ["custo por clique de 1,20", "cpc"],
    ["CTR de 1,5%", "ctr"],
    ["ROAS de 4", "roas"],
    ["200 vendas", "conversions"],
    ["300 conversões", "conversions"],
    ["receita de 100 mil", "revenue"],
    ["faturamento de 50k", "revenue"],
    ["investimento de 10 mil", "spend"],
    ["ticket médio de 250", "ticket"],
    ["50 leads qualificados", "qualified"],
    ["taxa de conversão de 2%", "convRate"],
    ["10 mil cliques", "clicks"],
    ["1 milhão de impressões", "impressions"],
  ])("%s → %s", (text, id) => {
    expect(ok(text).goal.metric).toBe(id);
  });

  it("sem métrica conhecida, explica", () => {
    const r = parseGoalText("quero 500 de alguma coisa", TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/métrica/);
  });

  it("sem número, explica", () => {
    const r = parseGoalText("CPL baixo esse mês", TODAY);
    expect(r).toMatchObject({ ok: false });
  });

  it("texto vazio", () => {
    expect(parseGoalText("   ", TODAY).ok).toBe(false);
  });
});

describe("parseGoalText: números", () => {
  it.each([
    ["CPM de 6,50", 650],
    ["CPM de 6.50", 650],
    ["CPM de R$ 7", 700],
    ["CPM de R$7,25", 725],
    ["CPC de 80 centavos", 80],
  ])("dinheiro: %s → %d centavos", (text, cents) => {
    expect(ok(text).goal.value).toBe(cents);
  });

  it.each([
    ["receita de 1.500.000", 150_000_000],
    ["receita de 1,5 mil", 150_000],
    ["receita de 2k", 200_000],
    ["receita de 2 milhões", 200_000_000],
  ])("milhar, mil, k e milhão: %s", (text, cents) => {
    expect(ok(text).goal.value).toBe(cents);
  });

  it("taxa vira fração, com ou sem %", () => {
    expect(ok("CTR de 1,5%").goal.value).toBeCloseTo(0.015);
    expect(ok("CTR acima de 2").goal.value).toBeCloseTo(0.02);
    expect(ok("CTR de 2 por cento").goal.value).toBeCloseTo(0.02);
  });

  it("volume arredonda; ROAS guarda o decimal", () => {
    expect(ok("1.200 leads").goal.value).toBe(1200);
    expect(ok("ROAS de 3,5").goal.value).toBe(3.5);
  });

  it("número da data não vira valor", () => {
    const { goal } = ok("CPL até 25 reais até 15/12");
    expect(goal.value).toBe(2500);
    expect(goal.period).toEqual({ kind: "custom", from: TODAY, to: "2026-12-15" });
  });

  it("ano do mês não vira valor", () => {
    const { goal } = ok("800 vendas em janeiro de 2027");
    expect(goal.value).toBe(800);
    expect(goal.period).toEqual({ kind: "custom", from: "2027-01-01", to: "2027-01-31" });
  });

  it("% numa métrica que não é taxa vira aviso", () => {
    const r = ok("leads acima de 10% esse mês");
    expect(r.assumed.join(" ")).toMatch(/%/);
  });
});

describe("parseGoalText: sentido", () => {
  it.each([
    ["CPL abaixo de 20", "max"],
    ["CPL no máximo 20", "max"],
    ["CPL até 20 reais", "max"],
    ["CPL menor que 20", "max"],
    ["reduzir o CPC para 1", "max"],
    ["CPA não passar de 90", "max"],
    ["pelo menos 300 leads", "min"],
    ["no mínimo 300 leads", "min"],
    ["mais de 300 leads", "min"],
    ["ROAS acima de 4", "min"],
    ["atingir 300 leads", "min"],
    ["atingir CPA de 50", "max"],
    ["bater 100 mil de receita", "min"],
    ["CTR de 1%", "min"],
    ["CPM de 10", "max"],
  ])("%s → %s", (text, dir) => {
    expect(ok(text).goal.direction).toBe(dir);
  });

  it("'pelo menos' não é lido como 'menos'", () => {
    expect(ok("CPC pelo menos 2").goal.direction).toBe("min");
  });

  it("investimento sem palavra de sentido: teto, com aviso", () => {
    const r = ok("investimento de 10 mil esse mês");
    expect(r.goal.direction).toBe("max");
    expect(r.assumed.length).toBe(1);
  });
});

describe("parseGoalText: período", () => {
  it.each([
    ["CPL de 20 esse mês", { kind: "month" }],
    ["CPL de 20 este mês", { kind: "month" }],
    ["CPL de 20 neste mês", { kind: "month" }],
    ["CPL de 20 por mês", { kind: "month" }],
    ["CPL de 20 na 1ª semana", { kind: "firstWeek" }],
    ["CPL de 20 na primeira semana do mês", { kind: "firstWeek" }],
  ])("%s", (text, period) => {
    expect(ok(text).goal.period).toEqual(period);
  });

  it("essa semana: de segunda a domingo", () => {
    expect(ok("CPL de 20 essa semana").goal.period).toEqual({ kind: "custom", from: "2026-11-09", to: "2026-11-15" });
  });

  it("próxima semana", () => {
    expect(ok("CPL de 20 na próxima semana").goal.period).toEqual({ kind: "custom", from: "2026-11-16", to: "2026-11-22" });
  });

  it("próximo mês e mês que vem, virando o ano", () => {
    expect(ok("300 leads no próximo mês").goal.period).toEqual({ kind: "custom", from: "2026-12-01", to: "2026-12-31" });
    expect(ok("300 leads mês que vem", "2026-12-20").goal.period).toEqual({ kind: "custom", from: "2027-01-01", to: "2027-01-31" });
  });

  it("primeira semana de um mês nomeado", () => {
    expect(ok("CPM de 8 na primeira semana de dezembro").goal.period).toEqual({ kind: "custom", from: "2026-12-01", to: "2026-12-07" });
  });

  it("mês que já passou é o do ano que vem; fevereiro respeita o tamanho", () => {
    expect(ok("100 vendas em fevereiro").goal.period).toEqual({ kind: "custom", from: "2027-02-01", to: "2027-02-28" });
    expect(ok("100 vendas em março").goal.period).toEqual({ kind: "custom", from: "2027-03-01", to: "2027-03-31" });
  });

  it("nos próximos N dias", () => {
    expect(ok("200 leads nos próximos 10 dias").goal.period).toEqual({ kind: "custom", from: TODAY, to: "2026-11-21" });
  });

  it("até dd/mm que já passou vai para o ano seguinte", () => {
    expect(ok("CPL de 20 até 05/01").goal.period).toEqual({ kind: "custom", from: TODAY, to: "2027-01-05" });
  });

  it("de dd/mm a dd/mm", () => {
    expect(ok("CPL de 20 de 01/12 a 15/12").goal.period).toEqual({ kind: "custom", from: "2026-12-01", to: "2026-12-15" });
  });

  it("sem período: este mês, com aviso", () => {
    const r = ok("CPL de 20");
    expect(r.goal.period).toEqual({ kind: "month" });
    expect(r.assumed[0]).toMatch(/este mês/);
  });

  it("palavra que contém 'mes' não é período", () => {
    const r = ok("CPL de 20 mesmo assim");
    expect(r.assumed[0]).toMatch(/este mês/);
  });

  it("guarda o texto original", () => {
    expect(ok("CPL abaixo de 20 reais esse mês").goal.text).toBe("CPL abaixo de 20 reais esse mês");
  });
});
