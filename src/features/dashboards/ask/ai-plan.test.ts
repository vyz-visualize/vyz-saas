import { describe, expect, it } from "vitest";
import { AskRequestSchema, fromAi, type AiPlan, type AskRequest } from "./ai-plan";

const req = (over: Partial<AskRequest> = {}): AskRequest =>
  AskRequestSchema.parse({
    text: "qual cosmético vende mais",
    profile: "ecommerce",
    pageName: "Visão geral",
    sources: ["meta", "google", "nao-existe"],
    hideSpend: false,
    hasProducts: true,
    existing: [],
    kpis: [
      { id: "spend", label: "Investimento" },
      { id: "roas", label: "ROAS" },
      { id: "revenue", label: "Receita" },
    ],
    visibleKpis: ["spend", "revenue"],
    ...over,
  });

const ai = (over: Partial<AiPlan> = {}): AiPlan => ({ understood: true, summary: "Entendi.", blocks: [], kpis: [], notes: [], ...over });

describe("resposta da IA no Pedir ao Vyz", () => {
  it("o pedido só leva contas conhecidas", () => {
    expect(req().sources).toEqual(["meta", "google"]);
    expect(AskRequestSchema.safeParse({ ...req(), profile: "outro" }).success).toBe(false);
    expect(AskRequestSchema.safeParse({ ...req(), text: "  " }).success).toBe(false);
  });

  it("fica só o que o painel aceita: id válido, sem repetir, com a conta certa", () => {
    const plan = fromAi(
      ai({
        blocks: [
          { id: "c:rank:products:revenue:desc", title: "Cosméticos que mais faturam", why: "Receita por produto." },
          { id: "c:rank:products:revenue:desc", title: "De novo", why: "" },
          { id: "c:rank:products:ctr:desc", title: "Métrica que produto não tem", why: "" },
          { id: "c:rank:campaigns:roas:desc:tiktok", title: "Sem conta do TikTok", why: "" },
          { id: "c:hack", title: "x", why: "" },
          { id: " c:trend:revenue ", title: "Receita por dia", why: "Linha." },
        ],
      }),
      req(),
    );
    expect(plan.blocks.map((b) => b.id)).toEqual(["c:rank:products:revenue:desc", "c:trend:revenue"]);
    expect(plan.blocks[0].spec).toMatchObject({ type: "rank", entity: "products", metric: "revenue", dir: "desc" });
  });

  it("não repete o que já está na aba e esconde o que revela o investimento", () => {
    const blocks = [
      { id: "c:rank:products:roas:desc", title: "Retorno", why: "" },
      { id: "c:rank:products:sold:desc", title: "Mais vendidos", why: "" },
      { id: "c:funnel", title: "Funil", why: "" },
    ];
    expect(fromAi(ai({ blocks }), req({ hideSpend: true, existing: ["c:funnel"] })).blocks.map((b) => b.id)).toEqual(["c:rank:products:sold:desc"]);
  });

  it("limita a quantidade, limpa nomes e textos e usa o nome padrão quando falta", () => {
    const blocks = ["revenue", "sold", "roas", "spend", "ticket", "profit"].map((m) => ({ id: `c:rank:products:${m}:desc`, title: "", why: "" }));
    blocks.push({ id: "c:funnel", title: "Sobra", why: "" }, { id: "c:goals", title: "Sobra", why: "" });
    blocks[1] = { id: blocks[1].id, title: "Mais\nvendidos — top", why: "Linha um.\nLinha dois." };
    const plan = fromAi(ai({ blocks, notes: ["a", "a", "b", "c", "d"] }), req());
    expect(plan.blocks).toHaveLength(6);
    expect(plan.blocks[0].title).toBe("Produtos que mais faturam");
    expect(plan.blocks[1].title).toBe("Mais vendidos, top");
    expect(plan.blocks[1].why).toBe("Linha um. Linha dois.");
    expect(plan.notes).toEqual(["a", "b", "c"]);
  });

  it("cards: só os oferecidos que ainda não estão na tela", () => {
    expect(fromAi(ai({ kpis: ["roas", "revenue", "cpa", "roas"] }), req()).kpis).toEqual(["roas"]);
  });

  it("nada aproveitável: não entendeu, com os exemplos", () => {
    const plan = fromAi(ai({ understood: true, summary: "", blocks: [{ id: "c:nada", title: "x", why: "" }] }), req());
    expect(plan.understood).toBe(false);
    expect(plan.summary).toContain("Não entendi");
    expect(plan.examples.length).toBeGreaterThan(2);
  });
});
