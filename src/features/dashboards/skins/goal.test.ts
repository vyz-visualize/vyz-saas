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

import { SKIN_BLOCKS, skinGrid } from "./blocks";
import { withoutBlocks } from "../layout/model";

describe("blocos sem nada para mostrar saem sem deixar buraco", () => {
  const row = (g: ReturnType<typeof skinGrid>, y: number) => g.filter((it) => it.y === y).sort((a, b) => a.x - b.x).map((it) => `${it.id}:${it.x}+${it.w}`);
  it("Noturno sem a quebra por hora: o fecha do mês ocupa a fileira", () => {
    const g = withoutBlocks(skinGrid("noturno"), ["s-calor"]);
    expect(row(g, 24)).toEqual(["s-fecha:0+12"]);
  });
  it("bloco na ponta esquerda: o da direita cresce para a esquerda; o layout original não muda", () => {
    const base = skinGrid("pulso");
    const g = withoutBlocks(base, ["s-tabela"]);
    expect(row(g, 24)).toEqual(["s-ranking:0+12"]);
    expect(base.find((it) => it.id === "s-tabela")).toBeTruthy();
    expect(SKIN_BLOCKS.pulso.length).toBe(7);
  });
  it("nada a esconder: a mesma grade", () => {
    const base = skinGrid("areia");
    expect(withoutBlocks(base, [])).toBe(base);
  });
});

describe("bloco escondido que ocupava a fileira sozinho", () => {
  it("os blocos de baixo sobem (sem buraco): a barra de filtros do Lavanda", () => {
    const g = withoutBlocks(skinGrid("lavanda"), ["s-filtros"]);
    expect(g.find((it) => it.id === "s-filtros")).toBeUndefined();
    expect(g.find((it) => it.id === "s-campanhas")?.y).toBe(31);
    expect(g.find((it) => it.id === "s-cpa")?.y).toBe(5);
  });
});
