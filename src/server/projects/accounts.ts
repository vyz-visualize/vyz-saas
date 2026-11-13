"use server";

// Contas vistas de dentro de um workspace (admin): trazer contas dos logins para ele e ligar ou
// desligar uma conta. Por baixo, a mesma ação da tela de Conexões (setEnabledAccounts): ela
// define as contas ligadas de uma plataforma na organização inteira, então aqui a lista é
// montada no servidor (as ligadas de hoje, mais ou menos a escolhida). O limite de contas por
// workspace e o do plano valem no banco.

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/server/auth/workspace";
import { logActivity } from "@/server/history/log";
import { setEnabledAccounts } from "@/server/integrations/actions";
import { appError, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

const Id = z.uuid();
const Platform = z.string().regex(/^[a-z0-9_-]{2,40}$/);

async function enabledOf(workspaceId: string, platformId: string): Promise<string[]> {
  const db = await createServerSupabase();
  const rows = unwrap(await db.from("ad_accounts").select("id").eq("workspace_id", workspaceId).eq("platform_id", platformId).eq("is_enabled", true)) ?? [];
  return rows.map((r) => r.id);
}

/** Traz contas (dos logins da organização) para o workspace e liga. As de outros workspaces mudam para cá. */
export async function addAccountsToProject(projectId: string, platformId: string, accountIds: string[]): Promise<ActionResult<{ added: number }>> {
  try {
    const ids = [...new Set(accountIds)];
    if (!Id.safeParse(projectId).success || !Platform.safeParse(platformId).success || !ids.length || ids.length > 100 || ids.some((id) => !Id.safeParse(id).success)) throw appError("validation");
    const session = await authorize("admin");
    const ws = session.workspace.id;
    const db = await createServerSupabase();
    const before = unwrap(await db.from("ad_accounts").select("id, project_id").eq("workspace_id", ws).in("id", ids)) ?? [];
    const enabled = await enabledOf(ws, platformId);
    // ligar/desligar fica no histórico por setEnabledAccounts; a troca de workspace, aqui
    const res = await setEnabledAccounts(platformId, [...new Set([...enabled, ...ids])], Object.fromEntries(ids.map((id) => [id, projectId])));
    if (!res.ok) return res;
    for (const r of before.filter((a) => a.project_id !== projectId)) {
      await logActivity({ workspaceId: ws, actorId: session.user.id, event: "ad_account.moved_to_project", entityType: "ad_account", entityId: r.id, metadata: { project_id: projectId } });
    }
    return { ok: true, data: { added: ids.length } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Liga ou desliga uma conta (as outras da plataforma ficam como estão). */
export async function setAccountActive(accountId: string, active: boolean): Promise<ActionResult> {
  try {
    if (!Id.safeParse(accountId).success) throw appError("validation");
    const session = await authorize("admin");
    const db = await createServerSupabase();
    const row = unwrap(await db.from("ad_accounts").select("platform_id").eq("id", accountId).eq("workspace_id", session.workspace.id).maybeSingle());
    if (!row) throw appError("not_found", "Conta não encontrada.");
    const enabled = await enabledOf(session.workspace.id, row.platform_id);
    const next = active ? [...new Set([...enabled, accountId])] : enabled.filter((id) => id !== accountId);
    const res = await setEnabledAccounts(row.platform_id, next);
    if (!res.ok) return res;
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}
