import { describe, expect, it } from "vitest";
import type { Insight } from "@/features/insights/insights";
import { addDays, priorityFromWeight, reconcile, suggestTasks, taskFromInsight, type ExistingAutoTask } from "./auto";

const DASH = "11111111-1111-4111-8111-111111111111";
const ins = (p: Partial<Insight>): Insight => ({ id: "kpi:purchases", dashboardId: DASH, dashboardName: "Loja", tone: "bad", title: "Compras: queda de 35%", body: "Foi de 100 para 65.", weight: 80.5, metric: "purchases", ...p });
const ctx = { projectName: "Loja Azul", projectId: "p1", platform: "meta" };

describe("taskFromInsight", () => {
  it("queda de KPI vira tarefa imperativa com plataforma e projeto", () => {
    const t = taskFromInsight(ins({}), ctx, "2026-11-07")!;
    expect(t.title).toBe("Revisar queda de compras na Meta Ads de Loja Azul");
    expect(t.insightKey).toBe(`${DASH}:kpi:purchases`);
    expect(t.stage).toBe("midia_paga");
    expect(t.priority).toBe("alta");
    expect(t.dueDate).toBe("2026-11-08");
    expect(t.projectId).toBe("p1");
    expect(t.detail).toContain("Foi de 100 para 65.");
  });

  it("mantém siglas e entende alta", () => {
    const t = taskFromInsight(ins({ id: "kpi:cpa", title: "CPA: alta de 20%", weight: 70 }), { platform: "google" }, "2026-11-07")!;
    expect(t.title).toBe("Revisar alta de CPA na Google Ads");
    expect(t.priority).toBe("media");
    expect(t.dueDate).toBe("2026-11-10");
  });

  it("ignora KPI bom e análises sem ação", () => {
    expect(taskFromInsight(ins({ tone: "good" }), ctx, "2026-11-07")).toBeNull();
    expect(taskFromInsight(ins({ id: "audience", tone: "info", title: "Mulheres de 25-34 trazem 40% da receita" }), ctx, "2026-11-07")).toBeNull();
  });

  it("criativo cansado vai para Criativos; oportunidade nunca é alta", () => {
    expect(taskFromInsight(ins({ id: "fatigue:a1", title: 'Criativo "Vídeo 3" mostra cansaço', weight: 65 }), {}, "2026-11-07")).toMatchObject({ title: 'Renovar o criativo "Vídeo 3"', stage: "criativos", priority: "media" });
    const best = taskFromInsight(ins({ id: "best:c1", tone: "good", title: "Verão é a campanha mais rentável", weight: 90 }), {}, "2026-11-07")!;
    expect(best.title).toBe("Avaliar escalar a campanha Verão");
    expect(best.priority).toBe("media");
  });

  it("campanha sem conversão", () => {
    expect(taskFromInsight(ins({ id: "zero:c2", title: "Leads gastou sem converter", weight: 90 }), {}, "2026-11-07")!.title).toBe("Revisar a campanha Leads, que gastou sem converter");
  });
});

describe("apoio", () => {
  it("prioridade pelo peso e soma de dias na virada do mês", () => {
    expect([priorityFromWeight(85), priorityFromWeight(70), priorityFromWeight(40)]).toEqual(["alta", "media", "baixa"]);
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });

  it("suggestTasks remove chaves repetidas", () => {
    expect(suggestTasks([ins({}), ins({})], () => ctx, "2026-11-07")).toHaveLength(1);
  });
});

describe("reconcile", () => {
  const now = new Date("2026-11-07T12:00:00Z");
  const s = taskFromInsight(ins({}), ctx, "2026-11-07")!;
  const task = (p: Partial<ExistingAutoTask>): ExistingAutoTask => ({ id: "t1", insightKey: s.insightKey, status: "planejado", editedAt: null, createdAt: "2026-11-01T00:00:00Z", completedAt: null, dashboardId: DASH, ...p });

  it("não duplica a tarefa aberta", () => {
    expect(reconcile([s], [task({})], new Set([DASH]), now)).toEqual({ create: [], close: [] });
  });

  it("cria quando não há tarefa ou a última fechou há mais de 7 dias", () => {
    expect(reconcile([s], [], new Set([DASH]), now).create).toHaveLength(1);
    expect(reconcile([s], [task({ status: "concluido", completedAt: "2026-10-20T00:00:00Z", createdAt: "2026-10-10T00:00:00Z" })], new Set([DASH]), now).create).toHaveLength(1);
    expect(reconcile([s], [task({ status: "concluido", completedAt: "2026-11-05T00:00:00Z" })], new Set([DASH]), now).create).toHaveLength(0);
  });

  it("fecha a aberta quando a análise some, salvo se alguém editou ou o dashboard não foi analisado", () => {
    expect(reconcile([], [task({})], new Set([DASH]), now).close).toEqual(["t1"]);
    expect(reconcile([], [task({ editedAt: "2026-11-02T00:00:00Z" })], new Set([DASH]), now).close).toEqual([]);
    expect(reconcile([], [task({})], new Set(), now).close).toEqual([]);
  });
});
