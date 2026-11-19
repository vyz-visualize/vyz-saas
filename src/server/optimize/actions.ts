"use server";

// Server Actions das otimizações: aplicar a mudança de uma tarefa, desfazer e
// salvar o automático de um projeto. Aplicar: membros, em todos os planos.
// Automático: admins, só no plano com autoOptimize.

import type { AutopilotRules, OptimizationLogDTO } from "@/features/optimize/actions";
import { ENTITLEMENTS } from "@/features/pricing/entitlements";
import { runAndRefresh } from "@/server/actions/run";
import { authorize } from "@/server/auth/workspace";
import { type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";
import { applyTaskFor, saveAutopilotFor, undoFor } from "./service";
import { logActivity } from "@/server/history/log";

/** Aplica na plataforma a mudança proposta pela tarefa. */
export async function applyTaskAction(taskId: string): Promise<ActionResult<OptimizationLogDTO>> {
  return runAndRefresh(async () => {
    const session = await authorize("member");
    const log = await applyTaskFor(await createServerSupabase(), session.workspace.id, session.user.id, taskId);
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "optimization.applied", entityType: "task", entityId: taskId });
    return log;
  });
}

/** Desfaz uma mudança aplicada. */
export async function undoOptimization(runId: string): Promise<ActionResult<OptimizationLogDTO>> {
  return runAndRefresh(async () => {
    const session = await authorize("member");
    const log = await undoFor(session.workspace.id, session.user.id, runId);
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "optimization.undone", entityType: "optimization_run", entityId: runId });
    return log;
  });
}

/** Liga, desliga ou ajusta o automático de um projeto (admin, Avançado). */
export async function saveAutopilot(projectId: string, rules: Partial<AutopilotRules>): Promise<ActionResult<AutopilotRules>> {
  return runAndRefresh(async () => {
    const session = await authorize("admin");
    const ent = session.access.entitlements ?? ENTITLEMENTS[session.access.tier ?? "base"];
    const saved = await saveAutopilotFor(await createServerSupabase(), session.workspace.id, session.user.id, projectId, rules, !!ent.autoOptimize);
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "optimization.autopilot_saved", entityType: "project", entityId: projectId, metadata: { fields: Object.keys(rules ?? {}).slice(0, 20) } });
    return saved;
  });
}
