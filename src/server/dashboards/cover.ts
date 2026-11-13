import "server-only";

// Capa e planilha do lançamento de um dashboard (visuais com capa). Consulta à parte do
// getDashboard: com o banco ainda sem a migração 20261118150000, o dashboard abre com a
// capa padrão e sem planilha, em vez de quebrar.

import { launchCode, type LaunchRow, type LaunchSummary } from "@/features/import/launch-sheet";
import { NO_COVER, parseCover, type DashboardCover } from "@/features/dashboards/cover";
import { COVER_BUCKET, publicAssetUrl } from "@/lib/supabase/storage";
import { sheetsServiceEmail } from "@/server/import/sheets-service";
import type { DB } from "@/server/supabase/server";

/** O que a página entrega ao dashboard (tudo serializável). */
export type CoverData = {
  cover: DashboardCover;
  sheet: { link: string | null; rows: LaunchRow[]; summary: LaunchSummary; error: string | null; readAt: string | null } | null;
  code: string;
  serviceEmail: string | null;
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Caminho do arquivo da capa, só se estiver na pasta do workspace. */
export function coverPath(workspaceId: string, raw: unknown): string | null {
  const path = isRecord(raw) && typeof raw.path === "string" ? raw.path : null;
  return path && path.startsWith(`${workspaceId}/`) && !path.includes("..") && /^[0-9a-f-]{36}\/capa-[0-9a-f]{16}\.(png|jpg|webp)$/.test(path) ? path : null;
}

/** Capa salva (com o caminho do arquivo) → a capa da tela (com o endereço público da imagem). */
export function coverFromDb(workspaceId: string, raw: unknown): DashboardCover {
  if (!isRecord(raw)) return NO_COVER;
  const path = coverPath(workspaceId, raw);
  return parseCover({ ...raw, image: path ? publicAssetUrl(path, COVER_BUCKET) : null });
}

/** Endereço público que a tela mandou → caminho do arquivo deste workspace (ou null). */
export function pathFromUrl(workspaceId: string, url: string | null): string | null {
  if (!url) return null;
  const prefix = publicAssetUrl("x", COVER_BUCKET)!.slice(0, -1);
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length).split("/").map(decodeURIComponent).join("/");
  return coverPath(workspaceId, { path });
}

export async function loadCoverData(db: DB, dashboardId: string, workspaceId: string): Promise<CoverData> {
  const base: CoverData = { cover: NO_COVER, sheet: null, code: launchCode(workspaceId), serviceEmail: sheetsServiceEmail() };
  const [cover, sheet] = await Promise.all([
    db.from("dashboards").select("cover").eq("id", dashboardId).maybeSingle(),
    db.from("dashboard_launch_sheets").select("link, via, rows, summary, read_at, last_error").eq("dashboard_id", dashboardId).maybeSingle(),
  ]);
  // sem a migração (coluna ou tabela ausente): a capa padrão, sem planilha
  if (!cover.error && cover.data) base.cover = coverFromDb(workspaceId, cover.data.cover);
  if (!sheet.error && sheet.data && Array.isArray(sheet.data.rows) && isRecord(sheet.data.summary)) {
    base.sheet = {
      link: sheet.data.link,
      rows: sheet.data.rows as unknown as LaunchRow[],
      summary: sheet.data.summary as unknown as LaunchSummary,
      error: sheet.data.last_error,
      readAt: sheet.data.read_at,
    };
  }
  return base;
}
