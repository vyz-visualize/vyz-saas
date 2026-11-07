// Tarefas automáticas: transforma as análises (src/features/insights) em
// sugestões de tarefa, com título no imperativo, etapa, prioridade e prazo.
// Puro: o servidor decide o que gravar, fechar ou ignorar (ver reconcile).

import type { Insight } from "@/features/insights/insights";
import type { TaskPriority, TaskStage, TaskStatus } from "./types";

export type InsightContext = {
  /** Nome do projeto (cliente) do dashboard. */
  projectName?: string | null;
  projectId?: string | null;
  platform?: "meta" | "google" | string | null;
};

export type TaskSuggestion = {
  insightKey: string;
  title: string;
  detail: string;
  stage: TaskStage;
  priority: TaskPriority;
  dueDate: string;
  dashboardId: string;
  projectId: string | null;
  platform: string | null;
};

const PLATFORM_NAME: Record<string, string> = { meta: "Meta Ads", google: "Google Ads" };

/** Chave estável da análise no workspace (o mesmo achado no mesmo dashboard). */
export const insightKey = (i: Pick<Insight, "dashboardId" | "id">) => `${i.dashboardId}:${i.id}`;

export function priorityFromWeight(weight: number): TaskPriority {
  if (weight >= 80) return "alta";
  if (weight >= 65) return "media";
  return "baixa";
}

const DUE_DAYS: Record<TaskPriority, number> = { alta: 1, media: 3, baixa: 7 };

/** Soma dias a uma data YYYY-MM-DD (sem fuso: aritmética de calendário). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Compras" vira "compras"; siglas (CPA, ROAS, CTR) ficam como estão. */
function lowerLabel(label: string): string {
  if (label.length > 1 && label[1] === label[1].toUpperCase() && /[A-Z]/.test(label[1])) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function where(ctx: InsightContext): string {
  const platform = ctx.platform ? (PLATFORM_NAME[ctx.platform] ?? ctx.platform) : null;
  const project = ctx.projectName?.trim() || null;
  if (platform && project) return ` na ${platform} de ${project}`;
  if (platform) return ` na ${platform}`;
  if (project) return ` de ${project}`;
  return "";
}

function quoted(title: string): string {
  const m = title.match(/"([^"]+)"/);
  return m ? m[1] : title;
}

function stageFor(insight: Insight): TaskStage {
  const kind = insight.id.split(":")[0];
  if (kind === "fatigue") return "criativos";
  if (kind === "kpi" && insight.metric && /conv(ersion)?_?rate|cvr|taxa/i.test(insight.metric)) return "cro";
  return "midia_paga";
}

/** Título no imperativo, ou null quando a análise não pede ação. */
function titleFor(insight: Insight, ctx: InsightContext): string | null {
  const kind = insight.id.split(":")[0];
  const at = where(ctx);
  const subject = insight.title.split(/ (gastou|está|é a)/)[0];
  switch (kind) {
    case "kpi": {
      if (insight.tone !== "bad") return null;
      const m = insight.title.match(/^(.+?):\s*(alta|queda)/);
      if (!m) return `Revisar ${lowerLabel(insight.title)}${at}`;
      return `Revisar ${m[2]} de ${lowerLabel(m[1])}${at}`;
    }
    case "zero":
      return `Revisar a campanha ${subject}, que gastou sem converter${at}`;
    case "be":
      return `Ajustar a campanha ${subject}, abaixo do ponto de equilíbrio${at}`;
    case "fatigue":
      return `Renovar o criativo "${quoted(insight.title)}"${at}`;
    case "wasted":
      return `Negativar termos de pesquisa sem conversão${at}`;
    case "lost-budget":
      return `Avaliar mais verba para as campanhas de pesquisa${at}`;
    case "best":
      return `Avaliar escalar a campanha ${subject}${at}`;
    default:
      return null;
  }
}

/** A sugestão de tarefa de uma análise (null quando não há o que fazer). */
export function taskFromInsight(insight: Insight, ctx: InsightContext, today: string): TaskSuggestion | null {
  const title = titleFor(insight, ctx);
  if (!title) return null;
  // oportunidades (tom bom ou informativo) nunca passam de média
  const raw = priorityFromWeight(insight.weight);
  const priority: TaskPriority = insight.tone === "bad" ? raw : raw === "alta" ? "media" : raw;
  return {
    insightKey: insightKey(insight),
    title: title.slice(0, 200),
    detail: `${insight.title}. ${insight.body}`.slice(0, 4000),
    stage: stageFor(insight),
    priority,
    dueDate: addDays(today, DUE_DAYS[priority]),
    dashboardId: insight.dashboardId,
    projectId: ctx.projectId ?? null,
    platform: ctx.platform ?? null,
  };
}

/** Todas as sugestões, sem chave repetida. */
export function suggestTasks(insights: Insight[], contextOf: (dashboardId: string) => InsightContext, today: string): TaskSuggestion[] {
  const seen = new Set<string>();
  const out: TaskSuggestion[] = [];
  for (const i of insights) {
    const s = taskFromInsight(i, contextOf(i.dashboardId), today);
    if (!s || seen.has(s.insightKey)) continue;
    seen.add(s.insightKey);
    out.push(s);
  }
  return out;
}

export type ExistingAutoTask = { id: string; insightKey: string; status: TaskStatus; editedAt: string | null; createdAt: string; completedAt: string | null; dashboardId: string | null };

export const RECOVERED_NOTE = "Fechada pelo VYZ: a métrica voltou ao normal.";
/** Depois de fechada (por alguém ou pelo VYZ), a mesma análise só volta a virar tarefa após este prazo. */
export const REOPEN_AFTER_DAYS = 7;

/**
 * O que fazer com as tarefas automáticas: criar as novas (sem tarefa aberta
 * nem fechada há pouco com a mesma chave) e fechar as abertas cuja análise
 * sumiu, desde que ninguém tenha mexido nelas. Só fecha as dos dashboards
 * que foram analisados agora (um dashboard que falhou não fecha nada).
 */
export function reconcile(suggestions: TaskSuggestion[], existing: ExistingAutoTask[], analyzedDashboards: Set<string>, now: Date): { create: TaskSuggestion[]; close: string[] } {
  const current = new Set(suggestions.map((s) => s.insightKey));
  const cutoff = now.getTime() - REOPEN_AFTER_DAYS * 86_400_000;
  const blocked = new Set(existing.filter((t) => t.status === "planejado" || t.status === "em_andamento" || Date.parse(t.completedAt ?? t.createdAt) >= cutoff).map((t) => t.insightKey));
  const create = suggestions.filter((s) => !blocked.has(s.insightKey));
  const close = existing
    .filter((t) => (t.status === "planejado" || t.status === "em_andamento") && !t.editedAt && !current.has(t.insightKey) && !!t.dashboardId && analyzedDashboards.has(t.dashboardId))
    .map((t) => t.id);
  return { create, close };
}
