// A Fazer: tipos e rótulos. Puro: serve ao site, às rotas e aos testes.

import type { AutopilotRules, OptimizationAction, OptimizationLogDTO } from "@/features/optimize/actions";

export const TASK_STATUSES = ["planejado", "em_andamento", "concluido", "cancelado"] as const;
export const TASK_STAGES = ["midia_paga", "cro", "crm", "criativos", "relatorio", "outro"] as const;
export const TASK_PRIORITIES = ["alta", "media", "baixa"] as const;
export const TASK_SOURCES = ["manual", "insight", "playbook"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskStage = (typeof TASK_STAGES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskSource = (typeof TASK_SOURCES)[number];
export type TaskSituation = "no_prazo" | "atrasado" | "concluido" | "sem_prazo";

export const STATUS_LABEL: Record<TaskStatus, string> = { planejado: "Planejado", em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado" };
export const STAGE_LABEL: Record<TaskStage, string> = { midia_paga: "Mídia paga", cro: "CRO", crm: "CRM", criativos: "Criativos", relatorio: "Relatório", outro: "Outro" };
export const PRIORITY_LABEL: Record<TaskPriority, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
export const SITUATION_LABEL: Record<TaskSituation, string> = { no_prazo: "No prazo", atrasado: "Atrasado", concluido: "Concluído", sem_prazo: "Sem prazo" };
export const SOURCE_LABEL: Record<TaskSource, string> = { manual: "Manual", insight: "VYZ", playbook: "Roteiro" };

export const PRIORITY_RANK: Record<TaskPriority, number> = { alta: 0, media: 1, baixa: 2 };

export const isOpen = (s: TaskStatus) => s === "planejado" || s === "em_andamento";

export type TaskDTO = {
  id: string;
  title: string;
  detail: string | null;
  status: TaskStatus;
  stage: TaskStage;
  priority: TaskPriority;
  startDate: string | null;
  dueDate: string | null;
  assignees: string[];
  groupId: string | null;
  projectId: string | null;
  projectName: string | null;
  dashboardId: string | null;
  platform: string | null;
  source: TaskSource;
  autoNote: string | null;
  /** Automática e ainda não aberta por ninguém. */
  isNew: boolean;
  createdAt: string;
  completedAt: string | null;
  /** Mudança que o VYZ pode aplicar na plataforma (botão Aplicar). */
  action: OptimizationAction | null;
};

export type TaskMember = { userId: string; name: string; avatarUrl: string | null };
export type TaskGroupDTO = { id: string; name: string };

export type TodoState = {
  tasks: TaskDTO[];
  groups: TaskGroupDTO[];
  members: TaskMember[];
  projects: { id: string; name: string }[];
  level: "basic" | "full";
  canEdit: boolean;
  today: string;
  timeZone: string;
  /** Tarefas criadas pelo VYZ nesta abertura (para o aviso). */
  justCreated: number;
  /** Últimas mudanças aplicadas nas plataformas (com Desfazer). */
  runs: OptimizationLogDTO[];
  /** Automático por projeto: só no Avançado e Personalizado; editar só admin. */
  autopilot: { allowed: boolean; canEdit: boolean; projects: Record<string, AutopilotRules> };
};
