import "server-only";

// Leitura de planilhas FECHADAS do Google pela conta de serviço da VYZ. A pessoa
// compartilha a planilha com o e-mail da conta (como Leitor) e o servidor lê pela
// Sheets API, sem abrir a planilha para "qualquer pessoa com o link".
//
// O que é segredo e o que não é:
//   - o e-mail da conta de serviço NÃO é segredo: vai na tela, é o que o cliente digita
//     no Compartilhar. Sozinho ele não dá acesso a nada.
//   - o segredo é a chave privada (o JSON), que fica só na variável de ambiente do
//     servidor (GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON), nunca no navegador nem no log.
//
// Regras que mantêm isso seguro:
//   1. Conta de serviço SÓ para isto, sem papel nenhum no projeto do Google Cloud. Não
//      reaproveitar a do painel interno (GOOGLE_SERVICE_ACCOUNT_JSON_B64): aquela lê o
//      GA4 e os relatórios da própria VYZ, e o e-mail dela não deve ir para a tela.
//   2. Escopo só de leitura de planilhas (spreadsheets.readonly): a conta não edita nada
//      e não enxerga o resto do Drive de ninguém.
//   3. A mesma conta lê as planilhas de todos os clientes. Por isso, quem chama precisa
//      conferir o código do workspace no cabeçalho (hasLaunchCode, launch-sheet.ts): sem
//      ele, um cliente que soubesse o link da planilha de outro poderia importá-la.
//   4. O endereço buscado é sempre o da Sheets API, montado aqui a partir do id da
//      planilha (já validado por sheetsCsvUrl): nada do que a pessoa digita vira URL.

import { createSign } from "node:crypto";
import { IMPORT_MAX_ROWS } from "@/features/import/spreadsheet";

const TIMEOUT_MS = 15_000;
const SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://sheets.googleapis.com/v4/spreadsheets";
/** Última coluna lida (o modelo tem 9; sobra para colunas a mais do cliente). */
const LAST_COLUMN = "AZ";

export type SheetsAccount = { client_email: string; private_key: string };
export type SheetCell = string | number | boolean | null;
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** A conta de serviço das planilhas (JSON cru ou em base64). null = não configurada: vale só o link aberto. */
export function sheetsServiceAccount(raw: string | undefined = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON): SheetsAccount | null {
  const text = raw?.trim();
  if (!text) return null;
  try {
    const json = JSON.parse(text.startsWith("{") ? text : Buffer.from(text, "base64").toString("utf8")) as Partial<SheetsAccount>;
    if (typeof json.client_email !== "string" || typeof json.private_key !== "string" || !json.client_email.includes("@")) return null;
    return { client_email: json.client_email, private_key: json.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

/** O e-mail que o cliente adiciona no Compartilhar (pode ir para a tela). */
export const sheetsServiceEmail = (): string | null => sheetsServiceAccount()?.client_email ?? null;

const tokens = new Map<string, { token: string; exp: number }>();
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** Token de acesso da conta (1 h), guardado em memória até perto de vencer. */
export async function sheetsAccessToken(account: SheetsAccount, fetcher: Fetcher = fetch, now: number = Date.now()): Promise<string> {
  const hit = tokens.get(account.client_email);
  if (hit && hit.exp > now + 60_000) return hit.token;
  const iat = Math.floor(now / 1000);
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: account.client_email, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key).toString("base64url");
  const res = await fetcher(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  // nada da resposta vai para o erro (pode trazer detalhes da credencial)
  if (!res.ok || !json.access_token) throw new Error(`conta de serviço das planilhas recusada (HTTP ${res.status})`);
  tokens.set(account.client_email, { token: json.access_token, exp: now + (json.expires_in ?? 3600) * 1000 });
  return json.access_token;
}

/** Só para os testes: esquece os tokens guardados. */
export const forgetSheetsTokens = () => tokens.clear();

export type SheetRead =
  | { status: "ok"; table: SheetCell[][]; title: string }
  /** A planilha não foi compartilhada com a conta de serviço. */
  | { status: "denied" }
  /** A planilha ou a aba não existe. */
  | { status: "not_found" };

/** Nome da aba em notação A1: entre aspas simples, com as aspas de dentro dobradas. */
const quoteTitle = (title: string) => `'${title.replace(/'/g, "''")}'`;

/**
 * A aba `gid` da planilha, como tabela. Os valores vêm crus (número como número, data
 * como número de série): não dependem do idioma da planilha, ao contrário do CSV.
 * Lança só em falha de rede ou do Google; planilha não compartilhada e aba que não
 * existe voltam como estado, para quem chama decidir a mensagem.
 */
export async function readSheetValues(input: { spreadsheetId: string; gid: string }, opts: { account: SheetsAccount; fetcher?: Fetcher; now?: number }): Promise<SheetRead> {
  const fetcher = opts.fetcher ?? fetch;
  if (!/^[A-Za-z0-9_-]{20,120}$/.test(input.spreadsheetId) || !/^\d{1,12}$/.test(input.gid)) return { status: "not_found" };
  const token = await sheetsAccessToken(opts.account, fetcher, opts.now);
  const get = (url: string) => fetcher(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  const status = (res: Response): "denied" | "not_found" | null => (res.status === 403 || res.status === 401 ? "denied" : res.status === 404 ? "not_found" : null);

  const meta = await get(`${API}/${input.spreadsheetId}?fields=${encodeURIComponent("sheets.properties(sheetId,title)")}`);
  const metaStatus = status(meta);
  if (metaStatus) return { status: metaStatus };
  if (!meta.ok) throw new Error(`Sheets API recusou (HTTP ${meta.status})`);
  const sheets = ((await meta.json()) as { sheets?: { properties?: { sheetId?: number; title?: string } }[] }).sheets ?? [];
  const sheet = sheets.find((s) => String(s.properties?.sheetId) === input.gid);
  const title = sheet?.properties?.title;
  if (typeof title !== "string" || !title) return { status: "not_found" };

  // o intervalo limita o que volta: as linhas do limite da importação (mais o cabeçalho e uma de folga, que acusa o excesso)
  const range = `${quoteTitle(title)}!A1:${LAST_COLUMN}${IMPORT_MAX_ROWS + 2}`;
  const values = await get(`${API}/${input.spreadsheetId}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`);
  const valuesStatus = status(values);
  if (valuesStatus) return { status: valuesStatus };
  if (!values.ok) throw new Error(`Sheets API recusou (HTTP ${values.status})`);
  const rows = ((await values.json()) as { values?: unknown[][] }).values ?? [];
  const cell = (v: unknown): SheetCell => (typeof v === "number" || typeof v === "boolean" || typeof v === "string" ? v : v == null ? null : String(v));
  return { status: "ok", title, table: rows.map((r) => (Array.isArray(r) ? r.map(cell) : [])) };
}
