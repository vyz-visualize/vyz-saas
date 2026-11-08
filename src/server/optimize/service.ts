import "server-only";

// Aplicar, desfazer e o automático das otimizações. Usa o cliente de serviço:
// quem chama já conferiu o acesso (authorize) ou é o agendador. Cada mudança
// vira uma linha em optimization_runs, aplicada ou não, com o motivo da falha.

import {
  type AutopilotRules,
  budgetChange,
  checkAutopilot,
  cleanRules,
  describeAction,
  inverseAction,
  parseAction,
  type OptimizationAction,
  type OptimizationLogDTO,
} from "@/features/optimize/actions";
import { availableIn, ENTITLEMENTS, TIERS, type Tier } from "@/features/pricing/entitlements";
import { z } from "zod";
import { createAdminSupabase } from "@/server/supabase/admin";
import { unwrap } from "@/server/supabase/errors";
import { sendPushToUser } from "@/server/push/send";
import { appError } from "@/server/supabase/errors";
import type { DB } from "@/server/supabase/server";
import { sendTemplate } from "@/server/whatsapp/client";
import { recordOut, wants } from "@/server/whatsapp/service";
import { ExecError, execute, type ExecTarget } from "./executors";

/** Prazo para desfazer uma mudança. */
export const UNDO_DAYS = 30;
const DAY = 86_400_000;

type Loaded = {
  target: ExecTarget;
  projectId: string | null;
  startedOn: string | null;
};

async function loadTarget(db: DB, workspaceId: string, campaignId: string): Promise<Loaded> {
  const { data: c } = await db
    .from("ad_campaigns")
    .select("external_id, started_on, account:ad_accounts(external_id, project_id, connection_id, metadata, connection:connections(id, is_mock, scopes, status))")
    .eq("workspace_id", workspaceId)
    .eq("id", campaignId)
    .maybeSingle();
  if (!c) throw new ExecError("Campanha não encontrada.");
  const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const acc = one(c.account as never) as {
    external_id: string;
    project_id: string | null;
    metadata: Record<string, unknown> | null;
    connection: unknown;
  } | null;
  const conn = acc
    ? (one(acc.connection as never) as {
        id: string;
        is_mock: boolean;
        scopes: string[];
        status: string;
      } | null)
    : null;
  if (!acc || !conn) throw new ExecError("A conta desta campanha não está conectada ao VYZ.");
  if (conn.status !== "active") throw new ExecError("A conexão desta conta expirou. Reconecte para aplicar mudanças.");
  const login = typeof acc.metadata?.login_customer_id === "string" ? (acc.metadata.login_customer_id as string) : null;
  return {
    target: {
      connectionId: conn.id,
      isMock: conn.is_mock,
      scopes: conn.scopes ?? [],
      campaignExternalId: c.external_id,
      accountExternalId: acc.external_id,
      loginCustomerId: login,
    },
    projectId: acc.project_id,
    startedOn: c.started_on,
  };
}

const errorText = (err: unknown) =>
  err instanceof ExecError
    ? err.message
    : err instanceof Error && err.name === "ProviderError"
      ? "A plataforma recusou a mudança. Confira a conexão e tente de novo."
      : "Não deu para aplicar agora. Tente de novo.";

/** Aplica uma ação e registra. Devolve o registro (aplicado ou com a falha). */
export async function applyAction(
  db: DB,
  input: {
    workspaceId: string;
    action: OptimizationAction;
    taskId: string | null;
    mode: "manual" | "auto";
    userId: string | null;
  },
): Promise<OptimizationLogDTO> {
  const { workspaceId, action, taskId, mode, userId } = input;
  let status: "applied" | "failed" = "applied";
  let error: string | null = null;
  let loaded: Loaded | null = null;
  try {
    loaded = await loadTarget(db, workspaceId, action.campaignId);
    await execute(db, action, loaded.target);
  } catch (err) {
    status = "failed";
    error = errorText(err);
    if (!(err instanceof ExecError)) console.error("[vyz] otimização: aplicar", err);
  }
  const { data: row, error: e } = await db
    .from("optimization_runs")
    .insert({
      workspace_id: workspaceId,
      task_id: taskId,
      project_id: loaded?.projectId ?? null,
      campaign_id: action.campaignId,
      platform: action.platform,
      kind: action.kind,
      action,
      mode,
      status,
      error,
      is_mock: loaded?.target.isMock ?? false,
      applied_by: userId,
    })
    .select("id, task_id, action, mode, status, error, applied_at, undone_at")
    .single();
  if (e || !row) throw appError("internal", "Não deu para registrar a mudança.");
  if (status === "applied" && taskId) {
    const now = new Date().toISOString();
    const note = `${mode === "auto" ? "Aplicado automaticamente" : "Aplicado"} pelo VYZ: ${describeAction(action)}.`.slice(0, 400);
    await db.from("tasks").update({ status: "concluido", completed_at: now, auto_note: note }).eq("workspace_id", workspaceId).eq("id", taskId);
  }
  return toLogDTO(row);
}

/** Desfaz uma mudança aplicada (volta ao "de"). */
export async function undoRun(db: DB, workspaceId: string, runId: string, userId: string): Promise<OptimizationLogDTO> {
  const { data: run } = await db.from("optimization_runs").select("id, task_id, action, mode, status, error, applied_at, undone_at").eq("workspace_id", workspaceId).eq("id", runId).maybeSingle();
  if (!run) throw appError("optimization:not_found", "Mudança não encontrada.");
  if (!canUndo(run)) throw appError("validation", run.status === "undone" ? "Esta mudança já foi desfeita." : `Só dá para desfazer mudanças aplicadas nos últimos ${UNDO_DAYS} dias.`);
  const action = parseAction(run.action);
  if (!action) throw appError("validation", "Mudança inválida.");
  const back = inverseAction(action);
  try {
    const loaded = await loadTarget(db, workspaceId, back.campaignId);
    await execute(db, back, loaded.target);
  } catch (err) {
    const msg = errorText(err);
    await db.from("optimization_runs").update({ status: "undo_failed", error: msg }).eq("id", run.id);
    throw appError("validation", msg);
  }
  const { data: row } = await db
    .from("optimization_runs")
    .update({
      status: "undone",
      error: null,
      undone_at: new Date().toISOString(),
      undone_by: userId,
    })
    .eq("id", run.id)
    .select("id, task_id, action, mode, status, error, applied_at, undone_at")
    .single();
  if (run.task_id)
    await db
      .from("tasks")
      .update({ auto_note: `Desfeito: ${describeAction(back)}.`.slice(0, 400) })
      .eq("workspace_id", workspaceId)
      .eq("id", run.task_id);
  return toLogDTO(row!);
}

type RunRow = {
  id: string;
  task_id: string | null;
  action: unknown;
  mode: string;
  status: string;
  error: string | null;
  applied_at: string;
  undone_at: string | null;
};

const canUndo = (r: Pick<RunRow, "status" | "applied_at">) => (r.status === "applied" || r.status === "undo_failed") && Date.now() - Date.parse(r.applied_at) < UNDO_DAYS * DAY;

export function toLogDTO(r: RunRow): OptimizationLogDTO {
  const a = parseAction(r.action);
  return {
    id: r.id,
    taskId: r.task_id,
    description: a ? describeAction(a) : "Mudança",
    mode: r.mode === "auto" ? "auto" : "manual",
    status: r.status as OptimizationLogDTO["status"],
    error: r.error,
    appliedAt: r.applied_at,
    undoneAt: r.undone_at,
    canUndo: canUndo(r),
  };
}

/** Últimas mudanças do workspace (RLS de quem está logado ou serviço). */
export async function listRuns(db: DB, workspaceId: string, limit = 50): Promise<OptimizationLogDTO[]> {
  const { data } = await db
    .from("optimization_runs")
    .select("id, task_id, action, mode, status, error, applied_at, undone_at")
    .eq("workspace_id", workspaceId)
    .order("applied_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(toLogDTO);
}

// ---- automático -------------------------------------------------------------------------

async function workspaceTier(db: DB, workspaceId: string): Promise<Tier | null> {
  const { data } = await db.from("workspace_access").select("pages_plan_id, has_access").eq("workspace_id", workspaceId).maybeSingle();
  if (!data?.has_access) return null;
  return (TIERS as string[]).includes(data.pages_plan_id ?? "") ? (data.pages_plan_id as Tier) : null;
}

/**
 * Aplica as tarefas abertas com ação nos projetos com o automático ligado,
 * dentro dos limites. Só no plano com autoOptimize. Avisa quem é do workspace.
 */
export async function runAutopilot(db: DB, workspaceId: string, now = new Date()): Promise<{ applied: number; skipped: number }> {
  const tier = await workspaceTier(db, workspaceId);
  if (!tier || !ENTITLEMENTS[tier].autoOptimize) return { applied: 0, skipped: 0 };
  const { data: configs } = await db.from("optimization_autopilot").select("*").eq("workspace_id", workspaceId).eq("enabled", true);
  if (!configs?.length) return { applied: 0, skipped: 0 };
  const rulesOf = new Map(
    configs.map((c) => [
      c.project_id,
      cleanRules({
        enabled: c.enabled,
        maxBudgetChangePct: c.max_budget_change_pct,
        allowIncrease: c.allow_increase,
        allowPause: c.allow_pause,
        minCampaignAgeDays: c.min_campaign_age_days,
      }),
    ]),
  );
  const { data: tasks } = await db
    .from("tasks")
    .select("id, project_id, action")
    .eq("workspace_id", workspaceId)
    .in("status", ["planejado", "em_andamento"])
    .is("edited_at", null)
    .not("action", "is", null)
    .in("project_id", [...rulesOf.keys()]);

  const since = new Date(now.getTime() - DAY).toISOString();
  const applied: OptimizationLogDTO[] = [];
  let skipped = 0;
  for (const t of tasks ?? []) {
    const action = parseAction(t.action);
    const rules = t.project_id ? rulesOf.get(t.project_id) : undefined;
    if (!action || !rules) continue;
    // não tenta de novo uma tarefa que já falhou no automático
    const { data: prev } = await db.from("optimization_runs").select("action, status, task_id, mode").eq("campaign_id", action.campaignId).gte("applied_at", since);
    if ((prev ?? []).some((p) => p.task_id === t.id && p.mode === "auto")) continue;
    const changedToday = (prev ?? []).filter((p) => p.status === "applied").reduce((sum, p) => sum + (parseAction(p.action) ? budgetChange(parseAction(p.action)!) : 0), 0);
    const { data: camp } = await db.from("ad_campaigns").select("started_on").eq("id", action.campaignId).maybeSingle();
    const daysRunning = camp?.started_on ? Math.floor((now.getTime() - Date.parse(`${camp.started_on}T12:00:00Z`)) / DAY) : null;
    const check = checkAutopilot(action, rules, { changedToday, daysRunning });
    if (!check.ok) {
      skipped++;
      continue;
    }
    const log = await applyAction(db, {
      workspaceId,
      action: check.action,
      taskId: t.id,
      mode: "auto",
      userId: null,
    });
    if (log.status === "applied") applied.push(log);
  }
  if (applied.length) await notifyApplied(db, workspaceId, applied);
  return { applied: applied.length, skipped };
}

/** Avisa pelo app (push) e pelo WhatsApp (quem escolheu alertas) o que o automático aplicou. */
async function notifyApplied(db: DB, workspaceId: string, logs: OptimizationLogDTO[]) {
  const title = logs.length === 1 ? "O VYZ aplicou uma otimização" : `O VYZ aplicou ${logs.length} otimizações`;
  const body = logs.length === 1 ? `${logs[0].description}. Para desfazer, abra o A Fazer.` : `${logs[0].description} e mais ${logs.length - 1}. Veja e desfaça no A Fazer.`;
  const { data: members } = await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId);
  for (const m of members ?? []) {
    try {
      await sendPushToUser(m.user_id, {
        title,
        body,
        data: { screen: "a-fazer" },
      });
    } catch (err) {
      console.error("[vyz] otimização: push", err);
    }
  }
  const { data: ws } = await db.from("workspaces").select("name").eq("id", workspaceId).maybeSingle();
  const { data: subs } = await db.from("whatsapp_subscriptions").select("*").eq("workspace_id", workspaceId);
  for (const s of (subs ?? []).filter((s) => wants(s, "alertas"))) {
    const r = await sendTemplate(s.phone, "alertas", [ws?.name ?? "seu workspace", "Otimização automática", `${title}.`, body]);
    await recordOut(db, s.id, "alertas", r, `otimizacao:${logs[0].id}`);
  }
}

// ---- pelo usuário (Server Actions e API do app; quem chama já conferiu papel e plano) ----

/** Aplica a ação de uma tarefa: lê a tarefa com o cliente do usuário (RLS), aplica com o de serviço. */
export async function applyTaskFor(userDb: DB, workspaceId: string, userId: string, taskId: string): Promise<OptimizationLogDTO> {
  if (!z.uuid().safeParse(taskId).success) throw appError("task:not_found", "Tarefa não encontrada.");
  const task = unwrap(await userDb.from("tasks").select("id, status, action").eq("workspace_id", workspaceId).eq("id", taskId).maybeSingle());
  if (!task) throw appError("task:not_found", "Tarefa não encontrada.");
  const action = parseAction(task.action);
  if (!action || (task.status !== "planejado" && task.status !== "em_andamento")) throw appError("validation", "Esta tarefa não tem mudança para aplicar.");
  const log = await applyAction(createAdminSupabase({ actorId: userId }), {
    workspaceId,
    action,
    taskId,
    mode: "manual",
    userId,
  });
  if (log.status === "failed") throw appError("validation", log.error ?? "Não deu para aplicar.");
  return log;
}

export async function undoFor(workspaceId: string, userId: string, runId: string): Promise<OptimizationLogDTO> {
  if (!z.uuid().safeParse(runId).success) throw appError("optimization:not_found", "Mudança não encontrada.");
  return undoRun(createAdminSupabase({ actorId: userId }), workspaceId, runId, userId);
}

export async function saveAutopilotFor(userDb: DB, workspaceId: string, userId: string, projectId: string, rules: Partial<AutopilotRules>, allowed: boolean): Promise<AutopilotRules> {
  if (!allowed) throw appError("forbidden", availableIn("avancado"));
  if (!z.uuid().safeParse(projectId).success) throw appError("validation", "Projeto não encontrado.");
  const clean = cleanRules(rules);
  unwrap(
    await userDb
      .from("optimization_autopilot")
      .upsert({
        workspace_id: workspaceId,
        project_id: projectId,
        enabled: clean.enabled,
        max_budget_change_pct: clean.maxBudgetChangePct,
        allow_increase: clean.allowIncrease,
        allow_pause: clean.allowPause,
        min_campaign_age_days: clean.minCampaignAgeDays,
        updated_by: userId,
      })
      .select("project_id"),
  );
  return clean;
}
