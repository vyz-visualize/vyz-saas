import { describe, expect, it } from "vitest";
import { metric } from "@/features/metrics/definitions";
import { goalOf } from "./shared";

describe("os visuais seguem o objetivo do modelo, não os números", () => {
  it("venda: vendas, custo por venda, receita e ROAS, mesmo com leads nos dados", () => {
    const g = goalOf("ecommerce", 120);
    expect(g).toMatchObject({ sales: true, conv: "conversions", cost: "cpa", value: "revenue", efficiency: "roas" });
    expect(metric(g.conv, "ecommerce").label).toBe("Vendas confirmadas");
    expect(metric(g.cost, "ecommerce").label).toBe("Custo por venda");
    expect(goalOf("infoproduto", 900).sales).toBe(true);
  });
  it("leads: Leads e Custo por lead, sem receita nem ROAS", () => {
    const g = goalOf("leads", 120);
    expect(g).toMatchObject({ sales: false, conv: "conversions", cost: "cpa", value: "conversions", efficiency: "convRate" });
    expect(metric(g.conv, "leads").label).toBe("Leads");
    expect(metric(g.cost, "leads").label).toBe("Custo por lead");
  });
  it("imobiliário conta todos os leads (os qualificados vêm à parte); saúde usa o rótulo dela", () => {
    expect(goalOf("imob", 50)).toMatchObject({ conv: "leads", cost: "cpl" });
    expect(goalOf("imob", 0)).toMatchObject({ conv: "conversions", cost: "cpa" });
    expect(metric(goalOf("saude", 30).conv, "saude").label).toBe("Agendamentos");
  });
});
