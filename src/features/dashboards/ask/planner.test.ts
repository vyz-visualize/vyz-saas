import { describe, expect, it } from "vitest";
import { customAllowed } from "../layout/custom-blocks";
import { planLayout, type PlanContext } from "./planner";

const ctx = (over: Partial<PlanContext> = {}): PlanContext => ({
  profile: "ecommerce",
  accepts: (id) => customAllowed(id, ["meta", "google"]),
  hasProducts: true,
  kpiIds: ["spend", "revenue", "roas", "cpa", "ctr", "conversions", "ticket", "cpc", "clicks"],
  visibleKpis: ["spend", "revenue"],
  ...over,
});

const titles = (text: string, over?: Partial<PlanContext>) => planLayout(text, ctx(over)).blocks.map((b) => b.title);

describe("planLayout", () => {
  it("loja de cosméticos: maior rendimento e maior receita viram dois rankings dos cosméticos", () => {
    const plan = planLayout("tenho uma loja de cosméticos e quero ver qual cosmético teve o maior rendimento e maior receita", ctx());
    expect(plan.understood).toBe(true);
    expect(plan.blocks.map((b) => b.id)).toEqual(["c:rank:products:roas:desc", "c:rank:products:revenue:desc"]);
    expect(plan.blocks.map((b) => b.title)).toEqual(["Cosméticos com melhor retorno (ROAS)", "Cosméticos que mais faturam"]);
    // receita já está na tela; o ROAS entra nos cards
    expect(plan.kpis).toEqual(["roas"]);
    expect(plan.notes.some((n) => n.includes("rendimento"))).toBe(true);
  });

  it("só o negócio monta um começo para ele", () => {
    expect(titles("tenho uma loja de perfumes")).toEqual(["Perfumes que mais faturam", "Perfumes mais vendidos", "Perfumes com melhor retorno (ROAS)", "Receita por dia"]);
  });

  it("produtos mais vendidos e o que menos vende", () => {
    expect(planLayout("quais produtos mais vendidos", ctx()).blocks[0].id).toBe("c:rank:products:sold:desc");
    expect(planLayout("qual produto menos vende", ctx()).blocks[0].id).toBe("c:rank:products:sold:asc");
  });

  it("campanhas de uma plataforma, com o sentido certo para custo", () => {
    expect(planLayout("campanhas do google com melhor roas", ctx()).blocks.map((b) => b.id)).toEqual(["c:rank:campaigns:roas:desc:google"]);
    expect(planLayout("quais campanhas estão com o pior custo por venda", ctx()).blocks.map((b) => b.id)).toEqual(["c:rank:campaigns:cpa:desc"]);
    expect(planLayout("campanhas mais baratas", ctx()).blocks.map((b) => b.id)).toEqual(["c:rank:campaigns:cpa:asc"]);
  });

  it("o segundo pedaço herda a métrica ou a coisa do primeiro", () => {
    expect(planLayout("receita por produto e por campanha", ctx()).blocks.map((b) => b.id)).toEqual(["c:rank:products:revenue:desc", "c:rank:campaigns:revenue:desc"]);
    expect(planLayout("criativos com maior ctr e campanhas com maior receita", ctx()).blocks.map((b) => b.id)).toEqual(["c:rank:creatives:ctr:desc", "c:rank:campaigns:revenue:desc"]);
  });

  it("dia a dia, horários, estados, público e termos", () => {
    expect(planLayout("receita por dia", ctx()).blocks.map((b) => b.id)).toEqual(["c:trend:revenue"]);
    expect(planLayout("qual horário vende mais", ctx()).blocks.map((b) => b.id)).toEqual(["c:breakdown:hour"]);
    expect(planLayout("estados que mais vendem", ctx()).blocks.map((b) => b.id)).toEqual(["c:rank:regions:conversions:desc"]);
    expect(planLayout("idade e gênero de quem compra", ctx()).blocks.map((b) => b.id)).toEqual(["c:audience"]);
    expect(planLayout("termos que gastam sem converter", ctx()).blocks.map((b) => b.id)).toEqual(["c:terms:waste"]);
    expect(planLayout("quais termos de pesquisa trazem mais vendas", ctx()).blocks.map((b) => b.id)).toEqual(["c:rank:terms:conversions:desc"]);
    expect(planLayout("retenção dos vídeos do youtube", ctx()).blocks.map((b) => b.id)).toEqual(["c:videos:youtube"]);
  });

  it("objetivo de lead: rendimento vira custo por lead", () => {
    const plan = planLayout("quais campanhas tem o melhor rendimento", ctx({ profile: "leads" }));
    expect(plan.blocks.map((b) => b.id)).toEqual(["c:rank:campaigns:cpa:asc"]);
  });

  it("sem a conta que o bloco precisa, avisa em vez de propor", () => {
    const plan = planLayout("termos que gastam sem converter", ctx({ accepts: (id) => customAllowed(id, ["meta"]) }));
    expect(plan.blocks).toEqual([]);
    expect(plan.notes[0]).toContain("Google Ads");
  });

  it("pedido sem sentido: não entende e mostra exemplos", () => {
    const plan = planLayout("bom dia tudo bem", ctx());
    expect(plan.understood).toBe(false);
    expect(plan.examples.length).toBeGreaterThan(2);
  });
});
