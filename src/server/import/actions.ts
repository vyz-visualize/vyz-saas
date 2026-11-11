"use server";

// Importação por planilha (Server Actions) das plataformas sem API: arquivo CSV
// ou link do Google Sheets. O papel (admin) e o plano são conferidos aqui; o
// limite de contas vale no banco (gatilho do plano). A conta de planilha não
// tem conexão: só o servidor a cria já ativa, com a chave de serviço, depois
// de conferir quem pede. O uso fica em activity_events; as mudanças, na auditoria.

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { isImportPlatform } from "@/features/accounts/connection-modes";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { IMPORT_MAX_BYTES, readSpreadsheet, type ImportSummary } from "@/features/import/spreadsheet";
import { canUse } from "@/features/pricing/entitlements";
import { DEFAULT_TIME_ZONE, localDate } from "@/features/sync/dates";
import { authorize } from "@/server/auth/workspace";
import { logActivity } from "@/server/history/log";
import { createAdminSupabase } from "@/server/supabase/admin";
import { appError, fromPostgrest, toActionError, type ActionResult } from "@/server/supabase/errors";
import { writeImport, type ImportAccount } from "./run";
import { fetchSheetCsv } from "./sheets";

const Input = z.object({
  platformId: z.string().max(40),
  /** Nome da conta (nova) ou novo nome (existente). */
  name: z.string().trim().min(1).max(120).optional(),
  /** Conta de planilha que já existe: nova importação nela. */
  accountId: z.uuid().optional(),
  /** Conteúdo do arquivo CSV. */
  csv: z.string().max(IMPORT_MAX_BYTES + 4096).optional(),
  /** Link do Google Sheets (compartilhado por link). Fica salvo para a atualização diária. */
  sheetLink: z.string().trim().max(600).optional(),
});

export type ImportSpreadsheetInput = z.input<typeof Input>;
export type ImportSpreadsheetResult = { accountId: string; name: string; platformId: PlatformId; summary: ImportSummary; rowsWritten: number; source: "csv" | "sheet" };

type Sheet = { spreadsheetId: string; gid: string; link: string };
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const sheetOf = (metadata: unknown): Sheet | null => {
  const s = isRecord(metadata) && isRecord(metadata.sheet) ? metadata.sheet : null;
  return s && typeof s.spreadsheetId === "string" && typeof s.gid === "string" && typeof s.link === "string" ? { spreadsheetId: s.spreadsheetId, gid: s.gid, link: s.link } : null;
};

/** Id da conta de planilha a partir do nome: o mesmo nome cai na mesma conta. */
const externalIdOf = (name: string) =>
  `planilha-${
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "conta"
  }`;

/**
 * Importa uma planilha (admin). Conta nova: cria já ativa (entra no limite do
 * plano). Conta existente: regrava o período da planilha. Sem arquivo nem link
 * novo, relê o link salvo. A planilha inteira precisa estar válida.
 */
export async function importSpreadsheet(input: ImportSpreadsheetInput): Promise<ActionResult<ImportSpreadsheetResult>> {
  try {
    const parsed = Input.safeParse(input);
    if (!parsed.success) throw appError("validation");
    const { platformId, name, accountId, csv, sheetLink } = parsed.data;
    if (!isImportPlatform(platformId)) throw appError("validation", "Esta plataforma não entra por planilha.");
    if (csv && sheetLink) throw appError("validation", "Envie o arquivo ou o link, não os dois.");

    const session = await authorize("admin");
    if (!canUse(session.access.tier ?? "base", PLATFORMS[platformId].tier)) throw appError("plan:platform");
    const workspaceId = session.workspace.id;
    const db = createAdminSupabase();

    // conta existente: precisa ser deste workspace, desta plataforma e de planilha
    let existing: { id: string; name: string; external_id: string; currency: string; metadata: unknown } | null = null;
    if (accountId) {
      const found = await db.from("ad_accounts").select("id, name, external_id, currency, metadata, platform_id, connection_id").eq("id", accountId).eq("workspace_id", workspaceId).maybeSingle();
      if (found.error) throw fromPostgrest(found.error);
      const meta = isRecord(found.data?.metadata) ? found.data.metadata : {};
      if (!found.data || found.data.platform_id !== platformId || found.data.connection_id !== null || meta.source !== "import") throw appError("not_found", "Conta de planilha não encontrada.");
      existing = found.data;
    } else if (!name) throw appError("validation", "Dê um nome para a conta.", { name: "Preencha este campo." });

    // de onde vem o texto: arquivo, link novo ou o link salvo da conta
    const saved = existing ? sheetOf(existing.metadata) : null;
    const link = sheetLink || (!csv ? saved?.link : undefined);
    if (!csv && !link) throw appError("validation", "Envie um arquivo CSV ou cole o link da planilha.");
    const sheet = link ? await fetchSheetCsv(link) : null;
    const text = sheet ? sheet.text : (csv ?? "");

    const read = readSpreadsheet(text, { today: localDate(new Date(), session.workspace.timezone || DEFAULT_TIME_ZONE) });
    if (!read.ok) {
      const lines = read.errors.slice(0, 6).map((e) => (e.line > 0 ? `Linha ${e.line}: ${e.message}` : e.message));
      const rest = read.errors.length - lines.length + read.more;
      throw appError("import:invalid", [...lines, ...(rest > 0 ? [`E mais ${rest} ${rest === 1 ? "linha com erro" : "linhas com erro"}.`] : [])].join("\n"));
    }

    const metadata = {
      source: "import",
      ...(sheet && link ? { sheet: { spreadsheetId: sheet.spreadsheetId, gid: sheet.gid, link } } : csv ? {} : saved ? { sheet: saved } : {}),
      last: { at: new Date().toISOString(), by: sheet ? "sheet" : "csv", rows: read.summary.rows, from: read.summary.from, to: read.summary.to },
    };

    let account: ImportAccount;
    let accountName: string;
    let created = false;
    if (existing) {
      account = { id: existing.id, workspaceId, platformId, externalId: existing.external_id, currency: existing.currency };
      accountName = name ?? existing.name;
    } else {
      const now = new Date().toISOString();
      const inserted = await db
        .from("ad_accounts")
        .insert({ workspace_id: workspaceId, platform_id: platformId, external_id: externalIdOf(name!), name: name!, status: "active", is_enabled: true, enabled_at: now, metadata })
        .select("id, name, external_id, currency")
        .single();
      if (inserted.error) throw inserted.error.code === "23505" ? appError("conflict", "Já existe uma conta com esse nome nesta plataforma. Use outro nome ou atualize a conta que já existe.") : fromPostgrest(inserted.error);
      account = { id: inserted.data.id, workspaceId, platformId, externalId: inserted.data.external_id, currency: inserted.data.currency };
      accountName = inserted.data.name;
      created = true;
    }

    let rowsWritten: number;
    try {
      rowsWritten = (await writeImport(db, account, read.rows, "manual")).rowsWritten;
    } catch (err) {
      // conta nova que não recebeu os dados não fica ocupando lugar no plano
      if (created) {
        const gone = await db.from("ad_accounts").delete().eq("id", account.id).eq("workspace_id", workspaceId);
        if (gone.error) console.error("[vyz] importação: desfazer conta nova", gone.error.code, gone.error.message);
      }
      throw err;
    }

    if (existing) {
      const saveMeta = await db.from("ad_accounts").update({ metadata, name: accountName }).eq("id", account.id).eq("workspace_id", workspaceId);
      if (saveMeta.error) console.error("[vyz] importação: salvar origem", saveMeta.error.code, saveMeta.error.message);
    }

    await logActivity({
      workspaceId,
      actorId: session.user.id,
      event: created ? "ad_account.import_created" : "ad_account.imported",
      entityType: "ad_account",
      entityId: account.id,
      metadata: { platform: platformId, source: sheet ? "sheet" : "csv", rows: read.summary.rows, campaigns: read.summary.campaigns, from: read.summary.from, to: read.summary.to, rowsWritten },
    });
    refresh();
    return { ok: true, data: { accountId: account.id, name: accountName, platformId, summary: read.summary, rowsWritten, source: sheet ? "sheet" : "csv" } };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}
