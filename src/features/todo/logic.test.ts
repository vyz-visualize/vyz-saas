import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, filterTasks, groupByMonth, monthLabel, PLAYBOOKS, playbookTasks, situationOf, sortTasks, tasksCsv, todayIn } from "./logic";
import type { TaskDTO } from "./types";

const task = (p: Partial<TaskDTO>): TaskDTO => ({
  id: "t",
  action: null,
  title: "Tarefa",
  detail: null,
  status: "planejado",
  stage: "outro",
  priority: "media",
  startDate: null,
  dueDate: null,
  assignees: [],
  groupId: null,
  projectId: null,
  projectName: null,
  dashboardId: null,
  platform: null,
  source: "manual",
  autoNote: null,
  isNew: false,
  createdAt: "2026-11-01T10:00:00Z",
  completedAt: null,
  ...p,
});

describe("situationOf", () => {
  const today = "2026-11-07";
  it("deriva no prazo, atrasado, concluído e sem prazo", () => {
    expect(situationOf(task({ dueDate: "2026-11-07" }), today)).toBe("no_prazo");
    expect(situationOf(task({ dueDate: "2026-11-06" }), today)).toBe("atrasado");
    expect(situationOf(task({ dueDate: "2026-11-01", status: "concluido" }), today)).toBe("concluido");
    expect(situationOf(task({ status: "cancelado" }), today)).toBe("concluido");
    expect(situationOf(task({}), today)).toBe("sem_prazo");
  });

  it("hoje no fuso do workspace", () => {
    expect(todayIn("America/Sao_Paulo", new Date("2026-11-08T02:00:00Z"))).toBe("2026-11-07");
  });
});

describe("filtros, ordem e meses", () => {
  const list = [
    task({ id: "a", priority: "baixa", dueDate: "2026-11-10" }),
    task({ id: "b", priority: "alta", dueDate: "2026-11-20", title: "Revisar promoção", assignees: ["u1"] }),
    task({ id: "c", status: "concluido", priority: "alta", dueDate: "2026-10-05" }),
    task({ id: "d", priority: "alta", dueDate: "2026-11-02" }),
  ];

  it("modo foco esconde concluídas e baixa prioridade", () => {
    expect(filterTasks(list, { ...EMPTY_FILTERS, focus: true }, "2026-11-07").map((t) => t.id)).toEqual(["b", "d"]);
  });

  it("busca sem acento, responsável e situação", () => {
    expect(filterTasks(list, { ...EMPTY_FILTERS, q: "promocao" }, "2026-11-07").map((t) => t.id)).toEqual(["b"]);
    expect(filterTasks(list, { ...EMPTY_FILTERS, assignee: "u1" }, "2026-11-07").map((t) => t.id)).toEqual(["b"]);
    expect(filterTasks(list, { ...EMPTY_FILTERS, assignee: "none" }, "2026-11-07")).toHaveLength(3);
    expect(filterTasks(list, { ...EMPTY_FILTERS, situation: "atrasado" }, "2026-11-07").map((t) => t.id)).toEqual(["d"]);
  });

  it("ordena abertas por prioridade e prazo, concluídas no fim", () => {
    expect(sortTasks(list).map((t) => t.id)).toEqual(["d", "b", "a", "c"]);
  });

  it("agrupa por mês do prazo, mais recente primeiro", () => {
    const g = groupByMonth(list);
    expect(g.map((x) => x.key)).toEqual(["2026-11", "2026-10"]);
    expect(g[0].label).toBe("Novembro de 2026");
    expect(monthLabel("2026-03")).toBe("Março de 2026");
  });
});

describe("tasksCsv", () => {
  const t = task({ title: 'Revisar "oferta"; já', dueDate: "2026-11-06", assignees: ["u1"], groupId: "g1", startDate: "2026-11-01", projectName: "Loja" });
  const opts = { today: "2026-11-07", members: [{ userId: "u1", name: "Ana", avatarUrl: null }], groups: [{ id: "g1", name: "Black Friday" }] };

  it("plano básico: sem colunas do plano completo, com escape e BOM", () => {
    const csv = tasksCsv([t], { ...opts, full: false });
    expect(csv.startsWith("﻿")).toBe(true);
    const [head, row] = csv.slice(1).split("\r\n");
    expect(head).toBe("Tarefa;Detalhe;Projeto;Status;Etapa;Prioridade;Situação;Prazo;Origem;Criada em;Concluída em");
    expect(row).toContain('"Revisar ""oferta""; já"');
    expect(row).toContain("Atrasado;06/11/2026;Manual;01/11/2026;");
    expect(row).not.toContain("Ana");
  });

  it("plano completo: início, responsáveis e grupo", () => {
    const csv = tasksCsv([t], { ...opts, full: true });
    expect(csv).toContain("Início;Responsáveis;Grupo");
    expect(csv).toContain("01/11/2026;Ana;Black Friday");
  });
});

describe("roteiros", () => {
  it("calcula início e prazo de cada tarefa", () => {
    const bf = PLAYBOOKS.find((p) => p.id === "black-friday")!;
    const tasks = playbookTasks(bf, "2026-11-01");
    expect(tasks[0]).toMatchObject({ startDate: "2026-11-01", dueDate: "2026-11-03" });
    for (const t of tasks) expect(t.startDate <= t.dueDate).toBe(true);
  });
});
