import "server-only";

// Lê a planilha do lançamento a partir do link do Google Sheets. Dois caminhos:
//
//   conta de serviço  a planilha está fechada e foi compartilhada com o e-mail da conta
//                     de serviço da VYZ (sheets-service.ts). Exige o código do workspace
//                     no cabeçalho: é o que liga a planilha a esta conta.
//   link aberto       a planilha está em "qualquer pessoa com o link" (sheets.ts). Quem
//                     tem o link já lê a planilha de qualquer jeito: não pede código.
//
// Com a conta de serviço configurada, ela é tentada primeiro; se a planilha não foi
// compartilhada com ela, cai no link aberto. Quem chama já conferiu quem pede (papel e
// plano) e é quem grava o resultado: aqui é só a leitura.

import { hasLaunchCode, launchCode, readLaunchSheet, readLaunchTable, type LaunchResult, type LaunchRow, type LaunchSummary } from "@/features/import/launch-sheet";
import { sheetsCsvUrl } from "@/features/import/spreadsheet";
import { AppError, appError } from "@/server/supabase/errors";
import { fetchSheetCsv } from "./sheets";
import { readSheetValues, sheetsServiceAccount, type SheetsAccount } from "./sheets-service";

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export type LaunchRead = {
  rows: LaunchRow[];
  summary: LaunchSummary;
  /** Por onde a planilha foi lida. */
  via: "service" | "link";
  spreadsheetId: string;
  gid: string;
};

function unwrap(read: LaunchResult): Extract<LaunchResult, { ok: true }> {
  if (read.ok) return read;
  const lines = read.errors.slice(0, 6).map((e) => (e.line > 0 ? `Linha ${e.line}: ${e.message}` : e.message));
  const rest = read.errors.length - lines.length + read.more;
  throw appError("import:invalid", [...lines, ...(rest > 0 ? [`E mais ${rest} ${rest === 1 ? "linha com erro" : "linhas com erro"}.`] : [])].join("\n"));
}

/**
 * Lê e valida a planilha do link. `account`: a conta de serviço (padrão: a do ambiente;
 * null = só o link aberto). Lança AppError com a mensagem que a tela mostra.
 */
export async function readLaunchLink(link: string, opts: { workspaceId: string; today: string; account?: SheetsAccount | null; fetcher?: Fetcher }): Promise<LaunchRead> {
  const parsed = sheetsCsvUrl(link);
  if (!parsed.ok) throw appError("import:link", parsed.error);
  const account = opts.account === undefined ? sheetsServiceAccount() : opts.account;
  const code = launchCode(opts.workspaceId);

  if (account) {
    let service: Awaited<ReturnType<typeof readSheetValues>> | null = null;
    try {
      service = await readSheetValues({ spreadsheetId: parsed.spreadsheetId, gid: parsed.gid }, { account, fetcher: opts.fetcher });
    } catch (err) {
      // falha do Google ou da credencial: fica no log (sem detalhe da chave) e a leitura segue pelo link aberto
      console.error("[vyz] planilha do lançamento: conta de serviço", err instanceof Error ? err.message : err);
    }
    if (service?.status === "ok") {
      const read = unwrap(readLaunchTable(service.table, { today: opts.today }));
      // a mesma conta de serviço lê as planilhas de todos os clientes: só vale a que traz o código deste workspace
      if (!hasLaunchCode(read.header, code)) {
        throw appError("import:code", `Esta planilha não tem o código desta conta no cabeçalho. Acrescente uma coluna com o título ${code} (sem nada embaixo) ou copie o modelo de novo.`);
      }
      return { rows: read.rows, summary: read.summary, via: "service", spreadsheetId: parsed.spreadsheetId, gid: parsed.gid };
    }
    if (service?.status === "not_found") throw appError("import:not_found", "Não achei essa planilha ou essa aba. Confira o link.");
  }

  try {
    const sheet = await fetchSheetCsv(link, opts.fetcher);
    const read = unwrap(readLaunchSheet(sheet.text, { today: opts.today }));
    return { rows: read.rows, summary: read.summary, via: "link", spreadsheetId: sheet.spreadsheetId, gid: sheet.gid };
  } catch (err) {
    // com a conta de serviço, o pedido é compartilhar com ela (não abrir a planilha para todos)
    if (account && err instanceof AppError && err.code === "import:not_shared") {
      throw appError("import:not_shared", `Não consegui abrir a planilha. No Google Sheets, clique em Compartilhar e adicione ${account.client_email} como Leitor.`);
    }
    throw err;
  }
}
