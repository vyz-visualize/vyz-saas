"use server";

// Server Actions das otimizações: aplicar a mudança de uma tarefa, desfazer e
// salvar o automático de um projeto. Aplicar: membros, em todos os planos.
// Automático: admins, só no plano com autoOptimize.

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { AutopilotRules, OptimizationLogDTO } from "@/features/optimize/actions";
import { ENTITLEMENTS } from "@/features/pricing/entitlements";
import { authorize } from "@/server/auth/workspace";
import { toActionError, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";
import { applyTaskFor, saveAutopilotFor, undoFor } from "./service";

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    refresh();
    return { ok: true, data };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Aplica na plataforma a mudança proposta pela tarefa. */
export async function applyTaskAction(taskId: string): Promise<ActionResult<OptimizationLogDTO>> {
  return run(async () => {
    const session = await authorize("member");
    return applyTaskFor(await createServerSupabase(), session.workspace.id, session.user.id, taskId);
  });
}

/** Desfaz uma mudança aplicada. */
export async function undoOptimization(runId: string): Promise<ActionResult<OptimizationLogDTO>> {
  return run(async () => {
    const session = await authorize("member");
    return undoFor(session.workspace.id, session.user.id, runId);
  });
}

/** Liga, desliga ou ajusta o automático de um projeto (admin, Avançado). */
export async function saveAutopilot(projectId: string, rules: Partial<AutopilotRules>): Promise<ActionResult<AutopilotRules>> {
  return run(async () => {
    const session = await authorize("admin");
    const ent = session.access.entitlements ?? ENTITLEMENTS[session.access.tier ?? "base"];
    return saveAutopilotFor(await createServerSupabase(), session.workspace.id, session.user.id, projectId, rules, !!ent.autoOptimize);
  });
}
