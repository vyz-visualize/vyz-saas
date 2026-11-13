import { describe, expect, it } from "vitest";
import type { LaunchRow } from "@/features/import/launch-sheet";
import { addDays } from "@/features/sync/dates";
import { currentTotals, previousTotals } from "./compute";
import type { Profile } from "./definitions";
import { withLaunchSheet } from "./launch-dataset";
import { MockSource } from "./source";

const TODAY = "2026-11-13";
const load = (profile: Profile) => MockSource.load({ seed: "fachada", profile, sources: ["meta", "google"], days: 30 });
const row = (ago: number, origin: string, n: Partial<LaunchRow>): LaunchRow => ({ date: addDays(TODAY, -ago), origin, leads: 0, attended: 0, visits: 0, proposals: 0, sales: 0, value: 0, ...n });

// 2 dias no período atual (duas origens), 1 no anterior
const ROWS: LaunchRow[] = [
  row(0, "Meta Ads", { leads: 40, attended: 20, visits: 6, proposals: 2, sales: 1, value: 700000 }),
  row(0, "Portal", { leads: 10, attended: 4, visits: 1 }),
  row(5, "Meta Ads", { leads: 30, attended: 18, visits: 5, proposals: 1 }),
  row(40, "Meta Ads", { leads: 25, attended: 10, visits: 2 }),
];

describe("planilha do lançamento por cima do Dataset", () => {
  it("sem linhas, o Dataset não muda", () => {
    const ds = load("imob");
    expect(withLaunchSheet(ds, [], { today: TODAY })).toBe(ds);
  });

  it("imobiliário: leads, qualificados e visitas passam a ser os da planilha; o investimento fica", () => {
    const ds = load("imob");
    const out = withLaunchSheet(ds, ROWS, { today: TODAY });
    const cur = currentTotals(out);
    expect(cur).toMatchObject({ leads: 80, qualified: 42, visits: 12, conversions: 42 });
    expect(cur.spend).toBe(currentTotals(ds).spend);
    expect(cur.clicks).toBe(currentTotals(ds).clicks);
    // custo por lead = investimento das plataformas ÷ leads da planilha
    expect(cur.cpl).toBeCloseTo(cur.spend / 80, 6);
    expect(previousTotals(out)).toMatchObject({ leads: 25, qualified: 10, visits: 2 });
    // dia que a planilha não traz fica zerado (nada inventado) e nada "em maturação"
    expect(out.current.find((d) => d.ago === 1)).toMatchObject({ leads: 0, qualified: 0, visits: 0, maturing: false });
    // o original não é alterado
    expect(currentTotals(ds).leads).not.toBe(80);
  });

  it("funil e etapas saem da planilha, com contagem e o valor vendido em centavos", () => {
    const out = withLaunchSheet(load("imob"), ROWS, { today: TODAY });
    expect(out.funnel.map((s) => `${s.label} ${s.count}`)).toEqual(["Leads 80", "Atendimentos 42", "Visitas 12", "Propostas 3", "Vendas 1"]);
    expect(out.funnel[0].pct).toBe(100);
    expect(out.funnel[1].pct).toBeCloseTo(52.5, 6);
    expect(out.crm.at(-1)).toEqual({ stage: "Vendas", count: 1, value: 70000000 });
    expect(out.launch).toMatchObject({ from: addDays(TODAY, -29), to: TODAY, proposals: 3, sales: 1, value: 70000000 });
    expect(out.launch?.origins).toEqual([
      { name: "Meta Ads", leads: 70, sales: 1 },
      { name: "Portal", leads: 10, sales: 0 },
    ]);
  });

  it("etapa sem coluna na planilha sai do funil; só com leads, fica o funil do modelo", () => {
    const ds = load("imob");
    const noVisits = withLaunchSheet(ds, ROWS, { today: TODAY, missing: ["visits", "proposals"] });
    expect(noVisits.funnel.map((s) => s.label)).toEqual(["Leads", "Atendimentos", "Vendas"]);
    expect(currentTotals(noVisits).visits).toBe(0);
    const onlyLeads = withLaunchSheet(ds, ROWS, { today: TODAY, missing: ["origin", "attended", "visits", "proposals", "sales", "value"] });
    expect(onlyLeads.funnel).toBe(ds.funnel);
    expect(onlyLeads.crm).toBe(ds.crm);
    // sem atendimentos, o resultado do imobiliário cai para o lead
    expect(currentTotals(onlyLeads)).toMatchObject({ leads: 80, conversions: 80, qualified: 0 });
  });

  it("o resultado segue o objetivo: venda em e-commerce (com a receita), lead em leads, visita em saúde", () => {
    const sales = currentTotals(withLaunchSheet(load("ecommerce"), ROWS, { today: TODAY }));
    expect(sales).toMatchObject({ conversions: 1, revenue: 70000000, leads: 80 });
    expect(currentTotals(withLaunchSheet(load("leads"), ROWS, { today: TODAY }))).toMatchObject({ conversions: 80, qualified: 42 });
    expect(currentTotals(withLaunchSheet(load("saude"), ROWS, { today: TODAY })).conversions).toBe(12);
    // fora de venda, a receita das plataformas não é tocada
    const ds = load("imob");
    expect(currentTotals(withLaunchSheet(ds, ROWS, { today: TODAY })).revenue).toBe(currentTotals(ds).revenue);
  });
});
