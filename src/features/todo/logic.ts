// A Fazer: regras puras da tela e das rotas (situação, filtros, ordem,
// agrupamento por mês, CSV e roteiros prontos).

import { CSV_BOM, csvRow } from "@/features/landing-pages/leads";
import { addDays } from "./auto";
import {
  PRIORITY_LABEL,
  PRIORITY_RANK,
  SITUATION_LABEL,
  SOURCE_LABEL,
  STAGE_LABEL,
  STATUS_LABEL,
  type TaskDTO,
  type TaskMember,
  type TaskPriority,
  type TaskSituation,
  type TaskStage,
  type TaskStatus,
} from "./types";

/** Data de hoje (YYYY-MM-DD) no fuso do workspace. */
export function todayIn(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Situação derivada: concluída (ou cancelada), atrasada, no prazo ou sem prazo. */
export function situationOf(task: Pick<TaskDTO, "status" | "dueDate">, today: string): TaskSituation {
  if (task.status === "concluido" || task.status === "cancelado") return "concluido";
  if (!task.dueDate) return "sem_prazo";
  return task.dueDate < today ? "atrasado" : "no_prazo";
}

export type TaskFilters = {
  q: string;
  assignee: string | "all";
  status: TaskStatus | "all";
  stage: TaskStage | "all";
  situation: TaskSituation | "all";
  priority: TaskPriority | "all";
  group: string | "all";
  focus: boolean;
};

export const EMPTY_FILTERS: TaskFilters = { q: "", assignee: "all", status: "all", stage: "all", situation: "all", priority: "all", group: "all", focus: false };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterTasks(tasks: TaskDTO[], f: TaskFilters, today: string): TaskDTO[] {
  const q = fold(f.q.trim());
  return tasks.filter((t) => {
    if (f.focus && (t.status === "concluido" || t.status === "cancelado" || t.priority === "baixa")) return false;
    if (f.status !== "all" && t.status !== f.status) return false;
    if (f.stage !== "all" && t.stage !== f.stage) return false;
    if (f.priority !== "all" && t.priority !== f.priority) return false;
    if (f.group !== "all" && t.groupId !== f.group) return false;
    if (f.assignee !== "all" && !(f.assignee === "none" ? t.assignees.length === 0 : t.assignees.includes(f.assignee))) return false;
    if (f.situation !== "all" && situationOf(t, today) !== f.situation) return false;
    if (q && !fold(`${t.title} ${t.detail ?? ""} ${t.projectName ?? ""}`).includes(q)) return false;
    return true;
  });
}

/** Abertas primeiro, depois prioridade, prazo mais próximo e mais novas. */
export function sortTasks(tasks: TaskDTO[]): TaskDTO[] {
  const closed = (t: TaskDTO) => (t.status === "concluido" || t.status === "cancelado" ? 1 : 0);
  return [...tasks].sort(
    (a, b) =>
      closed(a) - closed(b) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-11" vira "Novembro de 2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[(m || 1) - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${y}`;
}

/** Mês da tarefa: o do prazo, senão o do início, senão o da criação. */
export const monthOf = (t: Pick<TaskDTO, "dueDate" | "startDate" | "createdAt">) => (t.dueDate ?? t.startDate ?? t.createdAt).slice(0, 7);

/** Grupos por mês, do mais recente para o mais antigo, cada um já ordenado. */
export function groupByMonth(tasks: TaskDTO[]): { key: string; label: string; tasks: TaskDTO[] }[] {
  const map = new Map<string, TaskDTO[]>();
  for (const t of tasks) map.set(monthOf(t), [...(map.get(monthOf(t)) ?? []), t]);
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([key, list]) => ({ key, label: monthLabel(key), tasks: sortTasks(list) }));
}

// ---- CSV ---------------------------------------------------------------------------------------

const brDate = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** Planilha das tarefas (separador ";" e BOM para o Excel em pt-BR). Responsáveis só no plano completo. */
export function tasksCsv(tasks: TaskDTO[], opts: { today: string; members: TaskMember[]; groups: { id: string; name: string }[]; full: boolean }): string {
  const name = new Map(opts.members.map((m) => [m.userId, m.name]));
  const group = new Map(opts.groups.map((g) => [g.id, g.name]));
  const head = ["Tarefa", "Detalhe", "Projeto", "Status", "Etapa", "Prioridade", "Situação", "Prazo", ...(opts.full ? ["Início", "Responsáveis", "Grupo"] : []), "Origem", "Criada em", "Concluída em"];
  let out = CSV_BOM + csvRow(head);
  for (const t of tasks) {
    out += csvRow([
      t.title,
      t.detail ?? "",
      t.projectName ?? "",
      STATUS_LABEL[t.status],
      STAGE_LABEL[t.stage],
      PRIORITY_LABEL[t.priority],
      SITUATION_LABEL[situationOf(t, opts.today)],
      brDate(t.dueDate),
      ...(opts.full ? [brDate(t.startDate), t.assignees.map((a) => name.get(a) ?? "").filter(Boolean).join(", "), t.groupId ? (group.get(t.groupId) ?? "") : ""] : []),
      SOURCE_LABEL[t.source],
      brDate(t.createdAt.slice(0, 10)),
      brDate(t.completedAt?.slice(0, 10) ?? null),
    ]);
  }
  return out;
}

// ---- roteiros prontos (plano completo) ---------------------------------------------------------

export type PlaybookTask = { title: string; stage: TaskStage; priority: TaskPriority; startOffset: number; days: number };
export type Playbook = { id: string; name: string; description: string; tasks: PlaybookTask[] };

export const PLAYBOOKS: Playbook[] = [
  {
    id: "black-friday",
    name: "Black Friday",
    description: "Da preparação ao pós-venda, em três semanas.",
    tasks: [
      { title: "Definir ofertas e metas da Black Friday", stage: "midia_paga", priority: "alta", startOffset: 0, days: 3 },
      { title: "Produzir criativos de esquenta e de oferta", stage: "criativos", priority: "alta", startOffset: 2, days: 5 },
      { title: "Montar públicos de remarketing e semelhantes", stage: "midia_paga", priority: "media", startOffset: 3, days: 3 },
      { title: "Revisar páginas de oferta e checkout", stage: "cro", priority: "alta", startOffset: 4, days: 4 },
      { title: "Programar disparos para a base de clientes", stage: "crm", priority: "media", startOffset: 7, days: 4 },
      { title: "Subir campanhas e acompanhar verba diária", stage: "midia_paga", priority: "alta", startOffset: 12, days: 5 },
      { title: "Fechar o relatório de resultados", stage: "relatorio", priority: "media", startOffset: 18, days: 3 },
    ],
  },
  {
    id: "queda-conversao",
    name: "Queda de conversão",
    description: "Investigar e corrigir uma queda de vendas ou leads.",
    tasks: [
      { title: "Conferir pixel, eventos e integrações", stage: "midia_paga", priority: "alta", startOffset: 0, days: 1 },
      { title: "Comparar funil por campanha e público", stage: "midia_paga", priority: "alta", startOffset: 0, days: 2 },
      { title: "Testar a página de destino no celular", stage: "cro", priority: "alta", startOffset: 1, days: 2 },
      { title: "Trocar criativos com sinal de cansaço", stage: "criativos", priority: "media", startOffset: 2, days: 3 },
      { title: "Registrar causa e ações no relatório do cliente", stage: "relatorio", priority: "media", startOffset: 4, days: 2 },
    ],
  },
  {
    id: "novo-cliente",
    name: "Novo cliente",
    description: "Entrada de um cliente, do acesso ao primeiro relatório.",
    tasks: [
      { title: "Pedir acessos às contas de anúncio e analytics", stage: "outro", priority: "alta", startOffset: 0, days: 2 },
      { title: "Ligar as contas no VYZ e criar o projeto", stage: "outro", priority: "alta", startOffset: 1, days: 2 },
      { title: "Auditar campanhas, pixel e conversões", stage: "midia_paga", priority: "alta", startOffset: 2, days: 4 },
      { title: "Alinhar metas e verba do primeiro mês", stage: "midia_paga", priority: "media", startOffset: 3, days: 3 },
      { title: "Montar o dashboard e compartilhar com o cliente", stage: "relatorio", priority: "media", startOffset: 5, days: 3 },
      { title: "Planejar os primeiros criativos", stage: "criativos", priority: "media", startOffset: 6, days: 5 },
    ],
  },
];

/** As tarefas de um roteiro a partir de uma data (início e prazo de cada uma). */
export function playbookTasks(playbook: Playbook, start: string): { title: string; stage: TaskStage; priority: TaskPriority; startDate: string; dueDate: string }[] {
  return playbook.tasks.map((t) => {
    const startDate = addDays(start, t.startOffset);
    return { title: t.title, stage: t.stage, priority: t.priority, startDate, dueDate: addDays(startDate, Math.max(0, t.days - 1)) };
  });
}
