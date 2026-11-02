"use server";

// Ações do workspace e da conta: nome e marca, logo (Storage), perfil e troca
// de workspace aberto.

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { normalizePhone } from "@/features/checkout/phone";
import { LOGO_MAX_BYTES, LOGO_MESSAGES, sniffLogo } from "@/features/workspace/logo";
import { ACTIVE_WORKSPACE_COOKIE, WORKSPACE_COOKIE_OPTIONS } from "@/lib/supabase/cookies";
import { BRAND_BUCKET, publicAssetUrl } from "@/lib/supabase/storage";
import { getSessionUser } from "@/server/auth/session";
import { authorize, getViewer } from "@/server/auth/workspace";
import { logActivity } from "@/server/history/log";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

const WorkspacePatch = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    brandColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .optional(),
    hideVyzBrand: z.boolean().optional(),
  })
  .strict();

export type WorkspacePatchInput = z.input<typeof WorkspacePatch>;

/** Nome e marca do workspace (admin). Marca própria exige o plano certo (o banco confere). */
export async function updateWorkspace(input: WorkspacePatchInput): Promise<ActionResult> {
  try {
    const parsed = WorkspacePatch.safeParse(input);
    if (!parsed.success) throw appError("validation");
    const session = await authorize("admin", { access: false });
    const p = parsed.data;
    const supabase = await createServerSupabase();
    unwrap(
      await supabase
        .from("workspaces")
        .update({
          ...(p.name !== undefined ? { name: p.name } : {}),
          ...(p.brandColor !== undefined ? { brand_color: p.brandColor } : {}),
          ...(p.hideVyzBrand !== undefined ? { hide_vyz_brand: p.hideVyzBrand } : {}),
        })
        .eq("id", session.workspace.id),
    );
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

// ---- logo ---------------------------------------------------------------------------

/** Caminho que o servidor gravou (<workspace>/logo-<aleatório>.<ext>): só esses são apagados daqui. */
const ownLogo = (workspaceId: string, path: string | null): path is string => !!path && new RegExp(`^${workspaceId}/logo-[0-9a-f]{16}\\.(png|jpg|webp)$`).test(path);

async function removeStoredLogo(path: string, actorId: string) {
  const { error } = await createAdminSupabase({ actorId }).storage.from(BRAND_BUCKET).remove([path]);
  if (error) console.error("[vyz] apagar logo antigo", error);
}

/**
 * Envia o logo da marca própria (admin, plano com white-label). O tipo sai
 * dos bytes (números mágicos), não do nome nem do Content-Type. O envio usa
 * a chave de serviço depois de autorizar: o nome do arquivo é do servidor e
 * a pasta é sempre a do workspace aberto. O caminho vai para o workspace
 * com o RLS de quem pediu; o logo anterior é apagado.
 */
export async function uploadBrandLogo(formData: FormData): Promise<ActionResult<{ url: string }>> {
  try {
    const file = formData.get("logo");
    if (!(file instanceof File)) throw appError("validation", LOGO_MESSAGES.missing);
    if (file.size === 0) throw appError("validation", LOGO_MESSAGES.empty);
    if (file.size > LOGO_MAX_BYTES) throw appError("validation", LOGO_MESSAGES.tooBig);

    const session = await authorize("admin");
    if (!session.access.entitlements?.whiteLabel) throw appError("plan:white_label", LOGO_MESSAGES.plan);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffLogo(bytes);
    if (!type) throw appError("validation", LOGO_MESSAGES.type);

    const ws = session.workspace.id;
    const path = `${ws}/logo-${randomBytes(8).toString("hex")}.${type.ext}`;
    const admin = createAdminSupabase({ actorId: session.user.id });
    const uploaded = await admin.storage.from(BRAND_BUCKET).upload(path, bytes, { contentType: type.mime, cacheControl: "31536000", upsert: false });
    if (uploaded.error) {
      console.error("[vyz] enviar logo", uploaded.error);
      throw appError("unknown", "Não foi possível enviar o logo. Tente de novo.");
    }

    const supabase = await createServerSupabase();
    const previous = await supabase.from("workspaces").select("brand_logo_path").eq("id", ws).maybeSingle();
    const saved = await supabase.from("workspaces").update({ brand_logo_path: path }).eq("id", ws).select("id").maybeSingle();
    if (saved.error || !saved.data) {
      // não ficou no workspace: o arquivo não serve para nada
      await removeStoredLogo(path, session.user.id);
      if (saved.error) unwrap(saved);
      throw appError("forbidden");
    }
    const old = previous.data?.brand_logo_path ?? null;
    if (old !== path && ownLogo(ws, old)) await removeStoredLogo(old, session.user.id);

    await logActivity({ workspaceId: ws, actorId: session.user.id, event: "workspace.logo_updated", entityType: "workspace", entityId: ws, metadata: { type: type.mime, bytes: bytes.length } });
    refresh();
    return { ok: true, data: { url: publicAssetUrl(path) ?? "" } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Tira o logo (admin). Tirar a marca nunca exige plano. */
export async function removeBrandLogo(): Promise<ActionResult> {
  try {
    const session = await authorize("admin", { access: false });
    const ws = session.workspace.id;
    const supabase = await createServerSupabase();
    const current = await supabase.from("workspaces").select("brand_logo_path").eq("id", ws).maybeSingle();
    const path = current.data?.brand_logo_path ?? null;
    if (!path) return { ok: true, data: undefined };
    unwrap(await supabase.from("workspaces").update({ brand_logo_path: null }).eq("id", ws));
    if (ownLogo(ws, path)) await removeStoredLogo(path, session.user.id);
    await logActivity({ workspaceId: ws, actorId: session.user.id, event: "workspace.logo_removed", entityType: "workspace", entityId: ws });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

// ---- perfil ---------------------------------------------------------------------------

const PROFILE_MESSAGES = { name: "Diga como podemos te chamar.", nameLong: "Use até 120 caracteres.", phone: "Confira o WhatsApp com DDD." } as const;

const ProfileInput = z
  .object({
    fullName: z.string().trim().min(1, PROFILE_MESSAGES.name).max(120, PROFILE_MESSAGES.nameLong),
    phone: z
      .string()
      .trim()
      .max(30, PROFILE_MESSAGES.phone)
      .transform((v, ctx) => {
        if (!v) return null;
        const phone = normalizePhone(v);
        if (!phone) ctx.addIssue({ code: "custom", message: PROFILE_MESSAGES.phone });
        return phone;
      }),
  })
  .strict();

export type ProfileInput = z.input<typeof ProfileInput>;

/** Nome e WhatsApp da própria conta (qualquer membro; o RLS só deixa mexer no próprio perfil). */
export async function updateProfile(input: ProfileInput): Promise<ActionResult<{ fullName: string; phone: string | null }>> {
  try {
    const parsed = ProfileInput.safeParse(input);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? "form")] ??= issue.message;
      throw appError("validation", undefined, fields);
    }
    const user = await getSessionUser();
    if (!user) throw appError("auth:required");
    const supabase = await createServerSupabase();
    const saved = unwrap(await supabase.from("profiles").update({ full_name: parsed.data.fullName, phone: parsed.data.phone }).eq("id", user.id).select("full_name, phone").maybeSingle());
    if (!saved) throw appError("not_found");
    refresh();
    return { ok: true, data: { fullName: saved.full_name, phone: saved.phone } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

// ---- workspace aberto ------------------------------------------------------------------

/** Abre outro workspace do usuário. */
export async function switchWorkspace(workspaceId: string) {
  const viewer = await getViewer();
  if (!viewer) redirect("/entrar");
  if (!z.uuid().safeParse(workspaceId).success || !viewer.memberships.some((m) => m.workspace.id === workspaceId)) redirect("/painel");
  (await cookies()).set(ACTIVE_WORKSPACE_COOKIE, workspaceId, WORKSPACE_COOKIE_OPTIONS);
  const supabase = await createServerSupabase();
  await supabase.from("profiles").update({ default_workspace_id: workspaceId }).eq("id", viewer.user.id);
  redirect("/painel");
}
