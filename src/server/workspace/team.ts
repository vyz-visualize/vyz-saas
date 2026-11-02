"use server";

// Equipe do workspace: convidar por e-mail, cancelar convite, trocar papel,
// remover membro e aceitar convite. O token do convite (32 bytes) só existe
// no link; o banco guarda o sha256 (hex).

import { createHash, randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { canRemoveMember, checkRoleChange, INVITE_MAX_PENDING, INVITE_ROLES, INVITE_TTL_DAYS, invitePath, isInviteToken, normalizeEmail } from "@/features/workspace/team";
import type { MemberRole } from "@/features/workspace/session";
import { ACTIVE_WORKSPACE_COOKIE, WORKSPACE_COOKIE_OPTIONS } from "@/lib/supabase/cookies";
import { getSessionUser } from "@/server/auth/session";
import { authorize } from "@/server/auth/workspace";
import { logActivity } from "@/server/history/log";
import { appOrigin } from "@/server/http/request";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

const InviteInput = z
  .object({
    email: z.email("Confira o e-mail.").max(254, "Confira o e-mail."),
    role: z.enum(INVITE_ROLES),
    sendEmail: z.boolean().default(true),
  })
  .strict();

export type InviteResult = { link: string; emailed: boolean; expiresAt: string };

/**
 * Convida por e-mail (admin). O convite vai pelo RLS de quem convida. O link
 * sempre volta para a tela (o SMTP padrão do Supabase tem limite baixo);
 * para quem ainda não tem conta, tentamos também o e-mail de convite do
 * Supabase Auth (chave de serviço: só o admin da API cria usuário convidado).
 */
export async function inviteMember(input: z.input<typeof InviteInput>): Promise<ActionResult<InviteResult>> {
  try {
    const parsed = InviteInput.safeParse(input);
    if (!parsed.success) throw appError("validation", parsed.error.issues[0]?.message, { email: parsed.error.issues[0]?.message ?? "Confira o e-mail." });
    const session = await authorize("admin", { access: false });
    const ws = session.workspace.id;
    const email = normalizeEmail(parsed.data.email);
    const supabase = await createServerSupabase();

    // já faz parte? (o RLS mostra os perfis de quem divide workspace)
    const members = unwrap(await supabase.from("workspace_members").select("user_id").eq("workspace_id", ws)) ?? [];
    const ids = members.map((m) => m.user_id);
    if (ids.length) {
      const same = unwrap(await supabase.from("profiles").select("id").in("id", ids).ilike("email", email.replace(/[\\%_]/g, "\\$&")).limit(1)) ?? [];
      if (same.length) throw appError("conflict", "Esta pessoa já está na equipe.", { email: "Esta pessoa já está na equipe." });
    }

    const pending = unwrap(
      await supabase.from("workspace_invitations").select("id, email").eq("workspace_id", ws).is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()),
    ) ?? [];
    if (pending.length >= INVITE_MAX_PENDING) throw appError("validation", `Limite de ${INVITE_MAX_PENDING} convites pendentes. Cancele algum antes.`);
    // reenviar = cancelar o anterior do mesmo e-mail (um pendente por e-mail)
    unwrap(
      await supabase
        .from("workspace_invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("workspace_id", ws)
        .ilike("email", email.replace(/[\\%_]/g, "\\$&"))
        .is("accepted_at", null)
        .is("revoked_at", null),
    );

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString();
    const created = unwrap(
      await supabase
        .from("workspace_invitations")
        .insert({ workspace_id: ws, email, role: parsed.data.role, token_hash: hashToken(token), invited_by: session.user.id, expires_at: expiresAt })
        .select("id")
        .single(),
    );
    const link = `${await appOrigin()}${invitePath(token)}`;

    let emailed = false;
    if (parsed.data.sendEmail) {
      const admin = createAdminSupabase({ actorId: session.user.id });
      const existing = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
      if (!existing.data && !existing.error) {
        const sent = await admin.auth.admin.inviteUserByEmail(email, {
          // e-mail → /auth/callback (sessão) → criar senha → volta ao convite
          redirectTo: `${await appOrigin()}/auth/callback?next=${encodeURIComponent(`/redefinir-senha?next=${encodeURIComponent(invitePath(token))}`)}`, data: { invited_to_workspace: ws } });
        emailed = !sent.error;
        if (sent.error) console.warn("[vyz] e-mail de convite não saiu", sent.error.code ?? sent.error.status);
      }
    }

    await logActivity({ workspaceId: ws, actorId: session.user.id, event: "team.invited", entityType: "workspace_invitation", entityId: created?.id ?? null, metadata: { role: parsed.data.role, emailed } });
    refresh();
    return { ok: true, data: { link, emailed, expiresAt } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Cancela um convite pendente (admin, pelo RLS). */
export async function revokeInvitation(id: string): Promise<ActionResult> {
  try {
    if (!z.uuid().safeParse(id).success) throw appError("validation");
    const session = await authorize("admin", { access: false });
    const supabase = await createServerSupabase();
    const row = unwrap(
      await supabase
        .from("workspace_invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("workspace_id", session.workspace.id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .select("id")
        .maybeSingle(),
    );
    if (!row) throw appError("not_found", "Este convite já foi usado ou cancelado.");
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "team.invitation_revoked", entityType: "workspace_invitation", entityId: id });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

async function teamRoles(workspaceId: string) {
  const supabase = await createServerSupabase();
  const rows = unwrap(await supabase.from("workspace_members").select("user_id, role").eq("workspace_id", workspaceId)) ?? [];
  return { roles: new Map(rows.map((r) => [r.user_id, r.role as MemberRole])), owners: rows.filter((r) => r.role === "owner").length };
}

const RoleInput = z.object({ userId: z.uuid(), role: z.enum(["viewer", "member", "admin", "owner"]) }).strict();

/**
 * Troca o papel de um membro. authenticated não tem UPDATE em
 * workspace_members.role: depois de autorizar e conferir as regras (admin
 * não mexe em dono nem dá posse), grava com a chave de serviço. O banco
 * ainda recusa tirar o último dono.
 */
export async function changeMemberRole(input: z.input<typeof RoleInput>): Promise<ActionResult> {
  try {
    const parsed = RoleInput.safeParse(input);
    if (!parsed.success) throw appError("validation");
    const session = await authorize("admin", { access: false });
    const ws = session.workspace.id;
    const { roles, owners } = await teamRoles(ws);
    const target = roles.get(parsed.data.userId);
    if (!target) throw appError("not_found", "Esta pessoa não está mais na equipe.");
    const check = checkRoleChange({ actor: session.role, target, next: parsed.data.role, owners });
    if (!check.ok) {
      if (check.reason === "same") return { ok: true, data: undefined };
      throw appError(check.reason === "last_owner" ? "workspace:last_owner" : "forbidden");
    }
    const admin = createAdminSupabase({ actorId: session.user.id });
    const saved = unwrap(
      await admin.from("workspace_members").update({ role: parsed.data.role }).eq("workspace_id", ws).eq("user_id", parsed.data.userId).eq("role", target).select("user_id").maybeSingle(),
    );
    if (!saved) throw appError("conflict", "O papel mudou enquanto você editava. Recarregue a página.");
    await logActivity({
      workspaceId: ws,
      actorId: session.user.id,
      event: "team.role_changed",
      entityType: "workspace_member",
      entityId: parsed.data.userId,
      metadata: { from: target, to: parsed.data.role },
    });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Remove um membro (admin tira quem não é dono; dono tira qualquer um). Pelo RLS. */
export async function removeMember(userId: string): Promise<ActionResult> {
  try {
    if (!z.uuid().safeParse(userId).success) throw appError("validation");
    const session = await authorize("admin", { access: false });
    const ws = session.workspace.id;
    const { roles, owners } = await teamRoles(ws);
    const target = roles.get(userId);
    if (!target) throw appError("not_found", "Esta pessoa não está mais na equipe.");
    if (!canRemoveMember({ actor: session.role, target, isSelf: userId === session.user.id, owners })) throw appError("forbidden");
    const supabase = await createServerSupabase();
    const removed = unwrap(await supabase.from("workspace_members").delete().eq("workspace_id", ws).eq("user_id", userId).select("user_id").maybeSingle());
    if (!removed) throw appError("forbidden");
    await logActivity({ workspaceId: ws, actorId: session.user.id, event: "team.member_removed", entityType: "workspace_member", entityId: userId, metadata: { role: target } });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Aceita o convite (RPC com a sessão de quem aceita) e abre o workspace. */
export async function acceptInvitation(token: string): Promise<ActionResult> {
  try {
    if (typeof token !== "string" || !isInviteToken(token)) throw appError("invitation:invalid");
    const user = await getSessionUser();
    if (!user) throw appError("auth:required");
    const supabase = await createServerSupabase();
    const workspaceId = unwrap(await supabase.rpc("accept_workspace_invitation", { p_token: token }));
    if (!workspaceId) throw appError("invitation:invalid");
    (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, WORKSPACE_COOKIE_OPTIONS);
    await supabase.from("profiles").update({ default_workspace_id: workspaceId }).eq("id", user.id);
    await logActivity({ workspaceId, actorId: user.id, event: "team.invitation_accepted", entityType: "workspace", entityId: workspaceId });
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
  redirect("/painel");
}

