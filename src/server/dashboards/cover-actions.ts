"use server";

// Capa e planilha do lançamento (Server Actions). Quem edita o dashboard (member+) troca
// a capa e liga a planilha. O dashboard precisa ser deste workspace e ter um visual com
// capa. A imagem é conferida pelos bytes (só PNG, JPEG e WebP) e vai para a pasta do
// workspace no bucket dashboard-covers; a planilha é lida no servidor (server/import/launch.ts).

import { randomBytes } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { COVER_ADDRESS_MAX, COVER_MAX_BYTES } from "@/features/dashboards/cover";
import { hasCoverSkin } from "@/features/dashboards/skins/blocks";
import type { LaunchRow, LaunchSummary } from "@/features/import/launch-sheet";
import { DEFAULT_TIME_ZONE, localDate } from "@/features/sync/dates";
import { anyDashboardTemplate } from "@/features/templates/live";
import { sniffLogo } from "@/features/workspace/logo";
import { COVER_BUCKET, publicAssetUrl } from "@/lib/supabase/storage";
import { authorize } from "@/server/auth/workspace";
import { logActivity } from "@/server/history/log";
import { readLaunchLink } from "@/server/import/launch";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, toActionError, unwrap, type ActionResult } from "@/server/supabase/errors";
import type { Json } from "@/lib/supabase/database.types";
import { coverPath, pathFromUrl } from "./cover";

const Id = z.uuid();

/** O dashboard é deste workspace e tem um visual com capa? Devolve a capa salva. */
async function ownDashboard(dashboardId: string, workspaceId: string) {
  if (!Id.safeParse(dashboardId).success) throw appError("dashboard:not_found");
  const db = createAdminSupabase();
  const found = await db.from("dashboards").select("id, template_id, cover").eq("id", dashboardId).eq("workspace_id", workspaceId).maybeSingle();
  if (found.error) throw appError("unknown", "A capa ainda não está disponível neste ambiente.");
  if (!found.data) throw appError("dashboard:not_found");
  if (!hasCoverSkin(anyDashboardTemplate(found.data.template_id)?.skin)) throw appError("validation", "Este modelo não tem capa.");
  return { db, row: found.data };
}

async function removeCoverFile(db: ReturnType<typeof createAdminSupabase>, path: string | null) {
  if (!path) return;
  const gone = await db.storage.from(COVER_BUCKET).remove([path]);
  if (gone.error) console.error("[vyz] capa: apagar arquivo antigo", gone.error.message);
}

const CoverInput = z.object({
  image: z.string().max(1000).nullable(),
  fit: z.enum(["recorte", "foto"]),
  address: z.string().trim().max(COVER_ADDRESS_MAX),
});

/** Grava a capa (imagem já enviada, recorte ou foto, endereço). */
export async function saveDashboardCover(dashboardId: string, input: z.input<typeof CoverInput>): Promise<ActionResult> {
  try {
    const parsed = CoverInput.safeParse(input);
    if (!parsed.success) throw appError("validation");
    const session = await authorize("member", { access: false });
    const ws = session.workspace.id;
    const { db, row } = await ownDashboard(dashboardId, ws);
    // a imagem só vale se for um arquivo deste workspace no bucket das capas
    const path = pathFromUrl(ws, parsed.data.image);
    if (parsed.data.image && !path) throw appError("validation", "Envie a imagem pela própria capa.");
    const old = coverPath(ws, row.cover);
    unwrap(await db.from("dashboards").update({ cover: { path, fit: parsed.data.fit, address: parsed.data.address } as Json }).eq("id", dashboardId).eq("workspace_id", ws));
    if (old && old !== path) await removeCoverFile(db, old);
    await logActivity({ workspaceId: ws, actorId: session.user.id, event: "dashboard.cover_changed", entityType: "dashboard", entityId: dashboardId, metadata: { image: !!path, fit: parsed.data.fit } });
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Envia a imagem da capa e já a grava no dashboard. Devolve o endereço público. */
export async function uploadDashboardCover(dashboardId: string, formData: FormData): Promise<ActionResult<{ url: string }>> {
  try {
    const file = formData.get("capa");
    if (!(file instanceof File) || file.size === 0) throw appError("validation", "Escolha uma imagem.");
    if (file.size > COVER_MAX_BYTES) throw appError("validation", "A imagem passa de 4 MB. Reduza e tente de novo.");
    const session = await authorize("member");
    const ws = session.workspace.id;
    const { db, row } = await ownDashboard(dashboardId, ws);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffLogo(bytes);
    if (!type) throw appError("validation", "Use uma imagem PNG, WebP ou JPG.");
    const path = `${ws}/capa-${randomBytes(8).toString("hex")}.${type.ext}`;
    const up = await db.storage.from(COVER_BUCKET).upload(path, bytes, { contentType: type.mime, cacheControl: "31536000", upsert: false });
    if (up.error) {
      console.error("[vyz] capa: enviar", up.error.message);
      throw appError("unknown", "Não foi possível enviar a imagem. Tente de novo.");
    }
    const current = (typeof row.cover === "object" && row.cover && !Array.isArray(row.cover) ? row.cover : {}) as Record<string, unknown>;
    const saved = await db.from("dashboards").update({ cover: { ...current, path } as Json }).eq("id", dashboardId).eq("workspace_id", ws);
    if (saved.error) {
      await removeCoverFile(db, path);
      unwrap(saved);
    }
    const old = coverPath(ws, row.cover);
    if (old && old !== path) await removeCoverFile(db, old);
    await logActivity({ workspaceId: ws, actorId: session.user.id, event: "dashboard.cover_uploaded", entityType: "dashboard", entityId: dashboardId, metadata: { type: type.mime, bytes: bytes.length } });
    return { ok: true, data: { url: publicAssetUrl(path, COVER_BUCKET) ?? "" } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Liga (ou troca) a planilha do lançamento pelo link. A planilha inteira precisa estar válida. */
export async function connectLaunchSheet(dashboardId: string, link: string): Promise<ActionResult<{ rows: LaunchRow[]; summary: LaunchSummary }>> {
  try {
    if (typeof link !== "string" || link.length > 600) throw appError("validation");
    const session = await authorize("member");
    const ws = session.workspace.id;
    const { db } = await ownDashboard(dashboardId, ws);
    const read = await readLaunchLink(link.trim(), { workspaceId: ws, today: localDate(new Date(), session.workspace.timezone || DEFAULT_TIME_ZONE) });
    const now = new Date().toISOString();
    unwrap(
      await db.from("dashboard_launch_sheets").upsert({
        dashboard_id: dashboardId,
        workspace_id: ws,
        link: link.trim(),
        spreadsheet_id: read.spreadsheetId,
        gid: read.gid,
        via: read.via,
        rows: read.rows as unknown as Json,
        summary: read.summary as unknown as Json,
        read_at: now,
        last_attempt_at: now,
        last_error: null,
        created_by: session.user.id,
        updated_at: now,
      }),
    );
    await logActivity({ workspaceId: ws, actorId: session.user.id, event: "dashboard.launch_sheet_connected", entityType: "dashboard", entityId: dashboardId, metadata: { via: read.via, rows: read.summary.rows, from: read.summary.from, to: read.summary.to } });
    return { ok: true, data: { rows: read.rows, summary: read.summary } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

/** Desliga a planilha: o funil volta a ser o das plataformas. */
export async function disconnectLaunchSheet(dashboardId: string): Promise<ActionResult> {
  try {
    const session = await authorize("member", { access: false });
    const ws = session.workspace.id;
    const { db } = await ownDashboard(dashboardId, ws);
    unwrap(await db.from("dashboard_launch_sheets").delete().eq("dashboard_id", dashboardId).eq("workspace_id", ws));
    await logActivity({ workspaceId: ws, actorId: session.user.id, event: "dashboard.launch_sheet_removed", entityType: "dashboard", entityId: dashboardId });
    return { ok: true, data: undefined };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}
