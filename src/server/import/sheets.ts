import "server-only";

// Busca o CSV de uma planilha do Google compartilhada por link. O endereço vem
// sempre de sheetsCsvUrl (só docs.google.com/spreadsheets/d/<id>): o servidor
// nunca busca o que a pessoa digitou livremente. Os redirecionamentos são
// seguidos à mão e só para o próprio Google; tempo e tamanho têm limite.

import { IMPORT_MAX_BYTES, sheetsCsvUrl } from "@/features/import/spreadsheet";
import { appError } from "@/server/supabase/errors";

const TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 4;
const NOT_SHARED = 'Não consegui abrir a planilha: ela não está aberta para leitura. No Google Sheets, clique em Compartilhar, em "Acesso geral" escolha "Qualquer pessoa com o link" como Leitor e tente de novo.';

/** Para onde a exportação pode redirecionar: o próprio Google Docs e o servidor de arquivos dele. */
export function isSheetsHost(hostname: string): boolean {
  return hostname === "docs.google.com" || hostname.endsWith(".googleusercontent.com");
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** Lê o corpo até o limite; passou, interrompe (não confia no Content-Length). */
async function readLimited(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw appError("import:too_large", "A planilha passa de 2 MB. Deixe na aba só o período que quer importar.");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder("utf-8").decode(all);
}

/** O CSV da aba indicada no link. Lança AppError com a mensagem que a tela mostra. */
export async function fetchSheetCsv(link: string, fetcher: Fetcher = fetch): Promise<{ text: string; spreadsheetId: string; gid: string }> {
  const parsed = sheetsCsvUrl(link);
  if (!parsed.ok) throw appError("import:link", parsed.error);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = parsed.csvUrl;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetcher(url, { redirect: "manual", signal, headers: { Accept: "text/csv" }, cache: "no-store" });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        const target = next ? new URL(next, url) : null;
        // login do Google (planilha fechada) ou qualquer outro destino: não segue
        if (!target || target.protocol !== "https:" || !isSheetsHost(target.hostname)) throw appError("import:not_shared", NOT_SHARED);
        url = target.toString();
        continue;
      }
      if (res.status === 404) throw appError("import:not_found", "Não achei essa planilha ou essa aba. Confira o link.");
      if (!res.ok) throw appError("import:not_shared", NOT_SHARED);
      if (!(res.headers.get("content-type") ?? "").toLowerCase().includes("text/csv")) throw appError("import:not_shared", NOT_SHARED);
      return { text: await readLimited(res, IMPORT_MAX_BYTES), spreadsheetId: parsed.spreadsheetId, gid: parsed.gid };
    }
    throw appError("import:not_shared", NOT_SHARED);
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) throw appError("import:timeout", "O Google demorou para responder. Tente de novo em instantes.");
    throw err;
  }
}
