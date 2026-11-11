"use server";

// Ações de projeto (Server Actions): criar, renomear e arquivar. O limite do
// plano (limit:projects) é conferido no banco; aqui só a validação e o papel.

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { authorize } from "@/server/auth/workspace";
import { logActivity } from "@/server/history/log";
import { appError, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

const Id = z.uuid();
const Name = z.string().trim().min(1, "Dê um nome ao projeto.").max(80, "Até 80 caracteres.");

function parseName(name: string): string {
  const r = Name.safeParse(name);
  if (!r.success) throw appError("validation", undefined, { name: r.error.issues[0].message });
  return r.data;
}

const duplicate = (err: unknown) => (err as { code?: string })?.code === "23505";

export async function createProject(name: string): Promise<ActionResult<{ id: string }>> {
  try {
    const clean = parseName(name);
    const session = await authorize("member");
    const db = await createServerSupabase();
    const res = await db.from("projects").insert({ workspace_id: session.workspace.id, name: clean, created_by: session.user.id }).select("id").single();
    if (res.error && duplicate(res.error)) throw appError("conflict", "Já existe um projeto com esse nome.");
    const row = unwrap(res)!;
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "project.created", entityType: "project", entityId: row.id });
    refresh();
    return { ok: true, data: { id: row.id } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

export async function renameProject(projectId: string, name: string): Promise<ActionResult> {
  try {
    if (!Id.safeParse(projectId).success) throw appError("project:not_found");
    const clean = parseName(name);
    const session = await authorize("member");
    const db = await createServerSupabase();
    const res = await db.from("projects").update({ name: clean }).eq("id", projectId).eq("workspace_id", session.workspace.id).select("id");
    if (res.error && duplicate(res.error)) throw appError("conflict", "Já existe um projeto com esse nome.");
    if (!unwrap(res)?.length) throw appError("project:not_found");
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "project.renamed", entityType: "project", entityId: projectId, metadata: { name: clean } });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Arquiva (admin): as contas do projeto saem do ar e liberam espaço no plano. Dashboards ficam. */
export async function archiveProject(projectId: string): Promise<ActionResult> {
  try {
    if (!Id.safeParse(projectId).success) throw appError("project:not_found");
    const session = await authorize("admin", { access: false });
    const db = await createServerSupabase();
    const ws = session.workspace.id;
    unwrap(await db.from("ad_accounts").update({ is_enabled: false, enabled_at: null }).eq("workspace_id", ws).eq("project_id", projectId).eq("is_enabled", true));
    const rows = unwrap(await db.from("projects").update({ archived_at: new Date().toISOString() }).eq("id", projectId).eq("workspace_id", ws).is("archived_at", null).select("id"));
    if (!rows?.length) throw appError("project:not_found");
    await logActivity({ workspaceId: ws, actorId: session.user.id, event: "project.archived", entityType: "project", entityId: projectId });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Move uma conta para outro projeto (admin). O banco confere o limite de contas por plataforma. */
export async function moveAccountToProject(adAccountId: string, projectId: string): Promise<ActionResult> {
  try {
    if (!Id.safeParse(adAccountId).success || !Id.safeParse(projectId).success) throw appError("validation");
    const session = await authorize("admin");
    const db = await createServerSupabase();
    const rows = unwrap(await db.from("ad_accounts").update({ project_id: projectId }).eq("id", adAccountId).eq("workspace_id", session.workspace.id).select("id"));
    if (!rows?.length) throw appError("not_found", "Conta não encontrada.");
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "ad_account.moved_to_project", entityType: "ad_account", entityId: adAccountId, metadata: { project_id: projectId } });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}
