import { describe, expect, it } from "vitest";
import { totals } from "@/features/metrics/compute";
import type { DayRow } from "@/features/metrics/source";
import { ENTITLEMENTS } from "@/features/pricing/entitlements";
import { normalize, respond } from "./local";
import type { AgentContext, ClientData } from "./types";

const NOW = new Date(2026, 9, 26); // 26 de outubro

function row(p: Partial<DayRow>): DayRow {
  return { ago: 0, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, leads: 0, qualified: 0, visits: 0, calls: 0, sessions: 0, views: 0, ...p } as DayRow;
}

function client(id: string, name: string, profile: ClientData["profile"], cur: Partial<DayRow>, prev: Partial<DayRow>, kpis: ClientData["kpis"] = ["cpa", "conversions", "revenue", "roas"]): ClientData {
  return { dashboardId: id, dashboardName: "Visão geral", client: name, profile, cur: totals([row(cur)]), prev: totals([row(prev)]), kpis };
}

function ctx(dashboards: ClientData[], tier: AgentContext["tier"] = "pro"): AgentContext {
  return { now: NOW, tier, tierLabel: tier === "pro" ? "Pro" : "Base", ent: ENTITLEMENTS[tier], dashboards, landingPages: true, counts: { dashboards: dashboards.length, landingPublished: 1, accounts: 2, projects: 2, contractedProjects: 3 } };
}

const LOJA = client("d1", "Loja Verde", "ecommerce", { spend: 1_000_000, conversions: 200, revenue: 4_000_000 }, { spend: 900_000, conversions: 180, revenue: 3_500_000 });
const MODA = client("d2", "Moda Sul", "ecommerce", { spend: 452_026, conversions: 50, revenue: 900_000 }, { spend: 500_000, conversions: 60, revenue: 1_000_000 });
const IMOB = client("d3", "Incorporadora Sul", "imob", { spend: 300_000, leads: 120, qualified: 40 }, { spend: 280_000, leads: 100, qualified: 35 }, ["cplq", "qualified", "visits", "spend"]);

describe("LocalEngine", () => {
  it("tira acento, pontuação e o 'Olá, Vyz' do começo", () => {
    expect(normalize("Olá, Vyz! Quanto gastei esse mês?")).toBe("quanto gastei esse mes");
  });

  it("investimento do mês: soma, período explícito e números pt-BR", () => {
    const a = respond("Olá, Vyz, quanto gastei esse mês?", ctx([LOJA, MODA]));
    expect(a.understood).toBe(true);
    expect(a.text).toContain("**R$ 14.520,26**");
    expect(a.text).toContain("em outubro até hoje");
    expect(a.card?.value).toBe("R$ 14.520,26");
    expect(a.card?.delta?.text).toBe("+3,7% vs anterior");
    expect(a.chart?.items.map((i) => i.label)).toEqual(["Loja Verde", "Moda Sul"]);
  });

  it("melhor CPA: o menor custo ganha, com alvo no KPI do dashboard", () => {
    const a = respond("Qual cliente teve o melhor CPA?", ctx([LOJA, MODA, IMOB]));
    expect(a.text).toContain("**Loja Verde**");
    expect(a.text).toContain("R$ 50,00");
    expect(a.target).toEqual({ dashboardId: "d1", metric: "cpa" });
    expect(a.card?.hint).toBe("menor é melhor");
  });

  it("pior ROAS e CPL só entre quem mede a métrica", () => {
    expect(respond("qual o pior roas", ctx([LOJA, MODA, IMOB])).text).toContain("**Moda Sul**");
    const cpl = respond("melhor custo por lead", ctx([LOJA, MODA, IMOB]));
    expect(cpl.text).toContain("Incorporadora Sul");
    expect(cpl.target).toBeUndefined(); // CPL não é KPI da primeira página: sem "Mostrar no painel"
    expect(cpl.card?.hint).toBe("menor é melhor");
    expect(respond("qual o melhor roas", ctx([LOJA, MODA])).card?.hint).toBeUndefined();
  });

  it("limites do plano vêm do entitlements", () => {
    const a = respond("Quantos dashboards ainda posso criar?", ctx([LOJA], "pro"));
    expect(a.text).toContain("**10 dashboards**");
    expect(a.text).toContain("ainda pode criar **9**");
    expect(a.action).toMatchObject({ type: "navigate", href: "/painel/dashboards/novo?novo=1" });
  });

  it("ações: tema e navegação", () => {
    expect(respond("Ativar modo escuro", ctx([])).action).toEqual({ type: "theme", theme: "dark" });
    expect(respond("muda pro tema claro", ctx([])).action).toEqual({ type: "theme", theme: "light" });
    expect(respond("abre as landing pages", ctx([])).action).toMatchObject({ href: "/painel/landing-pages" });
    expect(respond("criar um novo dashboard", ctx([])).action).toMatchObject({ href: "/painel/dashboards/novo?novo=1" });
  });

  it("sem dado no contexto: diz que não tem, nunca inventa número", () => {
    for (const q of ["quanto investi esse mês?", "qual cliente teve o melhor CPA?", "quantas vendas tive?"]) {
      const a = respond(q, ctx([]));
      expect(a.text).toMatch(/não tenho esse dado/i);
      expect(a.text).not.toMatch(/R\$|\d/);
      expect(a.card).toBeUndefined();
    }
    // há dashboards, mas nenhum mede ROAS
    const roas = respond("qual o melhor roas?", ctx([IMOB]));
    expect(roas.text).toMatch(/não tenho esse dado/i);
    expect(roas.card).toBeUndefined();
  });

  it("landing pages em breve: não fala de limite de LP", () => {
    const off = { ...ctx([LOJA]), landingPages: false };
    expect(respond("quantas landing pages posso publicar?", off).text).toMatch(/em breve/);
    expect(respond("qual é o meu plano?", off).text).not.toMatch(/landing/i);
    expect(respond("qual é o meu plano?", ctx([LOJA])).text).toMatch(/landing pages publicadas/);
  });

  it("pergunta desconhecida: resposta honesta + sugestões", () => {
    const a = respond("qual a previsão do tempo amanhã?", ctx([LOJA]));
    expect(a.understood).toBe(false);
    expect(a.text).toMatch(/não sei/i);
    expect(a.text).not.toMatch(/R\$/);
    expect(a.suggestions?.length).toBeGreaterThanOrEqual(2);
  });
});

describe("com filtros ativos no dashboard aberto", () => {
  const focused = (): AgentContext => ({ ...ctx([LOJA]), focus: { label: "Campanha Prospecção", period: "no período aberto (30 dias)" } });

  it("diz o filtro e o período na resposta sobre números", () => {
    const a = respond("Quanto investi?", focused());
    expect(a.text).toContain("Com o filtro **Campanha Prospecção**, você investiu");
    expect(a.text).toContain("no período aberto (30 dias)");
    expect(a.spoken).toContain("Com o filtro Campanha Prospecção");
    expect(respond("Quantas vendas?", focused()).text).toContain("Com o filtro");
    expect(respond("Qual o ROAS?", focused()).text).toContain("Com o filtro");
  });

  it("vários filtros", () => {
    const a = respond("Quanto investi?", { ...focused(), focus: { label: "Campanha A, Dias 10–15/10", period: "nos dias 10–15/10" } });
    expect(a.text).toContain("Com os filtros **Campanha A, Dias 10–15/10**");
    expect(a.text).toContain("nos dias 10–15/10");
  });

  it("o que não é sobre números não cita filtro", () => {
    expect(respond("Qual é o meu plano?", focused()).text).not.toContain("filtro");
  });

  it("sem filtro, a resposta é a de sempre", () => {
    expect(respond("Quanto investi?", ctx([LOJA])).text).not.toContain("filtro");
  });
});
