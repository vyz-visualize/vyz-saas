"use server";

// Ações do gerenciador de usuários. Cada uma confere de novo, no servidor, que quem
// chama é admin (ADMIN_EMAILS): o botão escondido não é proteção.

import { revalidatePath } from "next/cache";
import { GRANT_MONTHS, GRANT_TIERS, type ActionResult, type GrantTier } from "@/features/admin/users";
import { getSessionUser } from "@/server/auth/session";
import { isAdminEmail } from "./report";
import { logActivity } from "@/server/history/log";
import { applyDeletion, grantPlan, previewDeletion, primaryWorkspaceOf, removePlan, setInactive, type DeletionPreview } from "./user-admin";

const PATH = "/painel/interno/usuarios";
const DENIED: ActionResult = { ok: false, message: "Sem permissão." };
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

async function admin() {
  const user = await getSessionUser();
  return user && isAdminEmail(user.email) ? user : null;
}

export async function grantPlanAction(userId: string, tier: GrantTier, months: number): Promise<ActionResult> {
  const me = await admin();
  if (!me) return DENIED;
  if (!isUuid(userId) || !GRANT_TIERS.includes(tier) || !(GRANT_MONTHS as readonly number[]).includes(months)) return { ok: false, message: "Dados inválidos." };
  const res = await grantPlan(userId, tier, months, me.email!);
  if (res.ok) {
    const ws = await primaryWorkspaceOf(userId);
    if (ws) await logActivity({ workspaceId: ws, actorId: me.id, event: "admin.plan_granted", entityType: "user", entityId: userId, metadata: { tier, months } });
  }
  revalidatePath(PATH);
  return res;
}

export async function removePlanAction(userId: string): Promise<ActionResult> {
  const me = await admin();
  if (!me) return DENIED;
  if (!isUuid(userId)) return { ok: false, message: "Dados inválidos." };
  const res = await removePlan(userId);
  if (res.ok) {
    const ws = await primaryWorkspaceOf(userId);
    if (ws) await logActivity({ workspaceId: ws, actorId: me.id, event: "admin.plan_removed", entityType: "user", entityId: userId, metadata: {} });
  }
  revalidatePath(PATH);
  return res;
}

export async function setInactiveAction(userId: string, inactive: boolean): Promise<ActionResult> {
  const me = await admin();
  if (!me) return DENIED;
  if (!isUuid(userId)) return { ok: false, message: "Dados inválidos." };
  if (userId === me.id) return { ok: false, message: "Você não pode inativar a própria conta." };
  const res = await setInactive(userId, inactive);
  if (res.ok) {
    const ws = await primaryWorkspaceOf(userId);
    if (ws) await logActivity({ workspaceId: ws, actorId: me.id, event: inactive ? "admin.user_inactivated" : "admin.user_reactivated", entityType: "user", entityId: userId, metadata: {} });
  }
  revalidatePath(PATH);
  return res;
}

export async function previewDeletionAction(email: string): Promise<DeletionPreview> {
  const me = await admin();
  if (!me) return { ok: false, message: DENIED.message };
  if (email.trim().toLowerCase() === me.email?.toLowerCase()) return { ok: false, message: "Você não pode excluir a própria conta por aqui." };
  return previewDeletion(email);
}

export async function applyDeletionAction(email: string, confirmEmail: string, code: string): Promise<ActionResult> {
  const me = await admin();
  if (!me) return DENIED;
  if (email.trim().toLowerCase() === me.email?.toLowerCase()) return { ok: false, message: "Você não pode excluir a própria conta por aqui." };
  const res = await applyDeletion(email, confirmEmail, code);
  if (res.ok) console.info("[vyz] admin.user_deleted", { by: me.id });
  revalidatePath(PATH);
  return res;
}
