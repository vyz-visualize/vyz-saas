import { describe, expect, it } from "vitest";
import { change, count, money } from "@/features/agent/engine/format";
import { DEMO_FALLBACK, DEMO_QUESTIONS, demoAnswer, demoContext } from "./vyz-context";

const NOW = new Date("2026-11-15T12:00:00-03:00");
const ctx = demoContext(NOW);
const [a, b] = ctx.dashboards;

describe("VYZ na demonstração: só respostas certas", () => {
  it("investimento: a soma dos dois clientes, com a variação certa", () => {
    const r = demoAnswer(DEMO_QUESTIONS[0], ctx);
    const cur = a.cur.spend + b.cur.spend;
    const prev = a.prev.spend + b.prev.spend;
    expect(r.text).toContain(money(cur));
    expect(r.text).toContain(change(cur / prev - 1));
  });

  it("vendas: a soma das vendas dos dois clientes", () => {
    expect(demoAnswer(DEMO_QUESTIONS[1], ctx).text).toContain(count(a.cur.conversions + b.cur.conversions));
  });

  it("melhor ROAS: o cliente de maior ROAS", () => {
    const best = [a, b].sort((x, y) => y.cur.roas - x.cur.roas)[0];
    expect(demoAnswer(DEMO_QUESTIONS[2], ctx).text).toContain(`**${best.client}**`);
  });

  it("pior CPA: o cliente de maior custo por venda", () => {
    const worst = [a, b].sort((x, y) => y.cur.cpa - x.cur.cpa)[0];
    expect(demoAnswer(DEMO_QUESTIONS[3], ctx).text).toContain(`**${worst.client}**`);
  });

  it("qualquer outra pergunta recebe a lista do que dá para perguntar, nunca uma resposta", () => {
    for (const q of ["Qual o ROAS da Loja Verde?", "Quanto a Casa Norte investiu?", "Qual é o meu plano?", "oi", ""]) {
      const r = demoAnswer(q, ctx);
      expect(r.text, q).toBe(DEMO_FALLBACK);
      expect(r.understood).toBe(false);
      expect(r.card).toBeUndefined();
    }
    expect(DEMO_FALLBACK.startsWith("Nesta amostra eu respondo estas perguntas:")).toBe(true);
    for (const q of DEMO_QUESTIONS) expect(DEMO_FALLBACK).toContain(q);
  });
});
