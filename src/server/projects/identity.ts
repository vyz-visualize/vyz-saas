"use server";

// Identidade de um workspace (member com acesso a ele): a cor e a logo. A logo vai para o
// bucket brand-assets com a chave de serviço depois de autorizar (o nome do arquivo é do
// servidor e a pasta é a do workspace, dentro da pasta da organização); o caminho vai para o
// banco com o RLS de quem pediu (a regra do banco só aceita caminhos dessa pasta) e a logo
// anterior é apagada. O tipo da imagem sai dos bytes, nunca do nome nem do Content-Type.

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { isOwnProjectLogo, normalizeProjectColor, projectLogoPath } from "@/features/projects/identity";
import { LOGO_MAX_BYTES, LOGO_MESSAGES, sniffLogo } from "@/features/workspace/logo";
import { BRAND_BUCKET, publicAssetUrl } from "@/lib/supabase/storage";
import { authorize } from "@/server/auth/workspace";
import { logActivity } from "@/server/history/log";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";
import { createServerSupabase } from "@/server/supabase/server";

const Id = z.uuid();

async function removeStored(path: string, actorId: string) {
  const { error } = await createAdminSupabase({ actorId }).storage.from(BRAND_BUCKET).remove([path]);
  if (error) console.error("[vyz] apagar logo antiga do workspace", error);
}

/** Troca a cor do workspace (null volta à padrão). */
export async function setProjectColor(projectId: string, color: string | null): Promise<ActionResult> {
  try {
    if (!Id.safeParse(projectId).success) throw appError("project:not_found");
    const value = color === null ? null : normalizeProjectColor(color);
    if (color !== null && !value) throw appError("validation", "Escolha uma cor válida.");
    const session = await authorize("member");
    const db = await createServerSupabase();
    const rows = unwrap(await db.from("projects").update({ color: value }).eq("id", projectId).eq("workspace_id", session.workspace.id).is("archived_at", null).select("id"));
    if (!rows?.length) throw appError("project:not_found");
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "project.color_changed", entityType: "project", entityId: projectId, metadata: { color: value } });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Envia a logo do workspace (PNG, JPEG ou WebP, até 2 MB). */
export async function uploadProjectLogo(formData: FormData): Promise<ActionResult<{ url: string }>> {
  try {
    const projectId = String(formData.get("projectId") ?? "");
    const file = formData.get("logo");
    if (!Id.safeParse(projectId).success) throw appError("project:not_found");
    if (!(file instanceof File)) throw appError("validation", LOGO_MESSAGES.missing);
    if (file.size === 0) throw appError("validation", LOGO_MESSAGES.empty);
    if (file.size > LOGO_MAX_BYTES) throw appError("validation", LOGO_MESSAGES.tooBig);

    const session = await authorize("member");
    const ws = session.workspace.id;
    const db = await createServerSupabase();
    // o workspace existe e a pessoa acessa (RLS) antes de gravar qualquer arquivo
    const current = unwrap(await db.from("projects").select("id, logo_path").eq("id", projectId).eq("workspace_id", ws).is("archived_at", null).maybeSingle());
    if (!current) throw appError("project:not_found");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffLogo(bytes);
    if (!type) throw appError("validation", LOGO_MESSAGES.type);

    const path = projectLogoPath(ws, projectId, randomBytes(8).toString("hex"), type.ext);
    const uploaded = await createAdminSupabase({ actorId: session.user.id }).storage.from(BRAND_BUCKET).upload(path, bytes, { contentType: type.mime, cacheControl: "31536000", upsert: false });
    if (uploaded.error) {
      console.error("[vyz] enviar logo do workspace", uploaded.error);
      throw appError("unknown", "Não foi possível enviar a logo. Tente de novo.");
    }

    const saved = await db.from("projects").update({ logo_path: path }).eq("id", projectId).eq("workspace_id", ws).select("id").maybeSingle();
    if (saved.error || !saved.data) {
      // não ficou no workspace: o arquivo não serve para nada
      await removeStored(path, session.user.id);
      if (saved.error) unwrap(saved);
      throw appError("forbidden");
    }
    if (current.logo_path !== path && isOwnProjectLogo(ws, projectId, current.logo_path)) await removeStored(current.logo_path, session.user.id);

    await logActivity({ workspaceId: ws, actorId: session.user.id, event: "project.logo_updated", entityType: "project", entityId: projectId, metadata: { type: type.mime, bytes: bytes.length } });
    refresh();
    return { ok: true, data: { url: publicAssetUrl(path) ?? "" } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Tira a logo do workspace (volta às iniciais na cor dele). */
export async function removeProjectLogo(projectId: string): Promise<ActionResult> {
  try {
    if (!Id.safeParse(projectId).success) throw appError("project:not_found");
    const session = await authorize("member");
    const ws = session.workspace.id;
    const db = await createServerSupabase();
    const current = unwrap(await db.from("projects").select("logo_path").eq("id", projectId).eq("workspace_id", ws).maybeSingle());
    if (!current) throw appError("project:not_found");
    if (!current.logo_path) return { ok: true, data: undefined };
    const rows = unwrap(await db.from("projects").update({ logo_path: null }).eq("id", projectId).eq("workspace_id", ws).select("id"));
    if (!rows?.length) throw appError("forbidden");
    if (isOwnProjectLogo(ws, projectId, current.logo_path)) await removeStored(current.logo_path, session.user.id);
    await logActivity({ workspaceId: ws, actorId: session.user.id, event: "project.logo_removed", entityType: "project", entityId: projectId });
    refresh();
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}
