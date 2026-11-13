// Planilha do lançamento (funil de vendas do empreendimento): o que a mídia paga não
// enxerga. A pessoa mantém uma planilha do Google com uma linha por dia (ou por dia e
// origem) e o dashboard relê. Puro: a mesma regra confere o que foi colado na tela e o
// que o servidor lê do link.
//
// Colunas: data e leads são obrigatórias; origem, atendimentos, visitas, propostas,
// vendas e valor vendido são opcionais (ausentes = 0). Não leva nome, telefone nem
// e-mail de ninguém: só contagens (nada de dado pessoal na planilha).
//
// Mesmos formatos da importação de mídia (spreadsheet.ts): vírgula, ponto e vírgula ou
// tabulação, números brasileiros ou americanos, datas dd/mm/aaaa ou aaaa-mm-dd. Aceita
// o texto colado direto das células do Google Sheets (vem separado por tabulação).

import { IMPORT_MAX_BYTES, IMPORT_MAX_ERRORS, IMPORT_MAX_ROWS, parseCsv, parseDate, parseNumber, type ImportError } from "./spreadsheet";

export const LAUNCH_MAX_ORIGINS = 40;
/** Origem das linhas sem a coluna (ou com ela em branco). */
export const LAUNCH_NO_ORIGIN = "Sem origem";

export type LaunchColumn = "date" | "origin" | "leads" | "attended" | "visits" | "proposals" | "sales" | "value";
type CountColumn = "leads" | "attended" | "visits" | "proposals" | "sales";
const COUNTS: CountColumn[] = ["leads", "attended", "visits", "proposals", "sales"];

type ColumnDef = { key: LaunchColumn; label: string; required: boolean; aliases: string[]; hint: string };

export const LAUNCH_COLUMNS: ColumnDef[] = [
  { key: "date", label: "data", required: true, aliases: ["data", "dia", "date", "day"], hint: "O dia (dd/mm/aaaa)." },
  { key: "origin", label: "origem", required: false, aliases: ["origem", "canal", "fonte", "midia", "plataforma", "source", "origin"], hint: "De onde veio: Meta Ads, Google Ads, portal, indicação, plantão..." },
  { key: "leads", label: "leads", required: true, aliases: ["leads", "cadastros", "contatos", "leads novos", "novos leads"], hint: "Cadastros novos no dia." },
  { key: "attended", label: "atendimentos", required: false, aliases: ["atendimentos", "atendidos", "qualificados", "leads qualificados", "leads atendidos", "contatos feitos"], hint: "Leads que o corretor atendeu e qualificou." },
  { key: "visits", label: "visitas", required: false, aliases: ["visitas", "visitas agendadas", "visitas realizadas", "visitas ao estande", "visitas ao decorado", "agendamentos"], hint: "Visitas ao estande ou ao decorado." },
  { key: "proposals", label: "propostas", required: false, aliases: ["propostas", "propostas enviadas", "propostas feitas"], hint: "Propostas entregues." },
  { key: "sales", label: "vendas", required: false, aliases: ["vendas", "contratos", "unidades vendidas", "fechamentos", "vendas fechadas"], hint: "Contratos assinados no dia." },
  { key: "value", label: "valor vendido", required: false, aliases: ["valor vendido", "valor", "vgv", "vgv vendido", "valor das vendas", "receita"], hint: "Soma em reais das vendas do dia." },
];

const EXAMPLE: string[][] = [
  ["03/11/2026", "Meta Ads", "42", "25", "6", "2", "1", "684.000,00"],
  ["03/11/2026", "Google Ads", "18", "12", "4", "1", "0", "0"],
  ["04/11/2026", "Meta Ads", "37", "21", "5", "2", "0", "0"],
];

/** Cabeçalho do modelo, na ordem das colunas; com o código do workspace, ele entra como última coluna. */
export const launchHeader = (code?: string) => [...LAUNCH_COLUMNS.map((c) => c.label), ...(code ? [code] : [])];

/**
 * Modelo para colar na célula A1 de uma planilha nova (separado por tabulação: o Google
 * Sheets distribui nas colunas). O código do workspace vai junto, como última coluna.
 */
export function launchTemplateTsv(code?: string): string {
  return [launchHeader(code), ...EXAMPLE.map((r) => (code ? [...r, ""] : r))].map((r) => r.join("\t")).join("\n");
}

/** O mesmo modelo em CSV (ponto e vírgula), para baixar. */
export function launchTemplateCsv(code?: string): string {
  return [launchHeader(code), ...EXAMPLE.map((r) => (code ? [...r, ""] : r))].map((r) => r.join(";")).join("\n") + "\n";
}

/** Minúsculas, sem acento e sem pontuação. */
const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// ---- código do workspace --------------------------------------------------------------

/**
 * Código curto e estável de um workspace ("vyz-7k2m9qxp"). Vai no cabeçalho da planilha
 * e prova que quem edita a planilha quis ligá-la a este workspace: sem isso, qualquer
 * cliente que soubesse o link de uma planilha compartilhada com a conta de serviço
 * poderia importá-la. Não é segredo (quem vê a planilha vê o código): é só o vínculo.
 */
export function launchCode(workspaceId: string): string {
  let a = 2166136261;
  let b = 0x9e3779b9;
  for (const ch of workspaceId) {
    a = Math.imul(a ^ ch.charCodeAt(0), 16777619);
    b = Math.imul(b ^ ch.charCodeAt(0), 2246822519);
  }
  const part = (n: number) => (n >>> 0).toString(36).padStart(7, "0").slice(-4);
  return `vyz-${part(a)}${part(b)}`;
}

/** O cabeçalho traz o código deste workspace (em qualquer coluna)? */
export function hasLaunchCode(header: readonly string[], code: string): boolean {
  const want = code.trim().toLowerCase();
  return !!want && header.some((h) => h.trim().toLowerCase() === want);
}

// ---- leitura --------------------------------------------------------------------------

export type LaunchRow = { date: string; origin: string; leads: number; attended: number; visits: number; proposals: number; sales: number; /** Em reais. */ value: number };

export type LaunchSummary = {
  rows: number;
  from: string;
  to: string;
  days: number;
  origins: string[];
  leads: number;
  attended: number;
  visits: number;
  proposals: number;
  sales: number;
  value: number;
  /** Colunas opcionais que a planilha não trouxe (o funil pula essas etapas). */
  missing: LaunchColumn[];
  /** Linhas repetidas (mesma data e origem) que foram somadas. */
  merged: number;
};

export type LaunchResult = { ok: true; rows: LaunchRow[]; summary: LaunchSummary; header: string[] } | { ok: false; errors: ImportError[]; more: number };

const fail = (errors: ImportError[]): LaunchResult => ({ ok: false, errors: errors.slice(0, IMPORT_MAX_ERRORS), more: Math.max(0, errors.length - IMPORT_MAX_ERRORS) });

/** Em que posição do cabeçalho está cada coluna (a primeira que casar com um dos nomes aceitos). */
export function mapLaunchHeader(header: readonly string[]): Partial<Record<LaunchColumn, number>> {
  const names = header.map(plain);
  const map: Partial<Record<LaunchColumn, number>> = {};
  for (const col of LAUNCH_COLUMNS) {
    const accepted = [plain(col.label), ...col.aliases];
    const at = names.findIndex((n, i) => accepted.includes(n) && !Object.values(map).includes(i));
    if (at >= 0) map[col.key] = at;
  }
  return map;
}

/** Célula como vem do texto (CSV, colado) ou da Sheets API (número e data crus). */
export type LaunchCell = string | number | boolean | null | undefined;

const cellText = (c: LaunchCell) => (typeof c === "string" ? c.trim() : c == null ? "" : String(c));

/** Data crua do Google Sheets (dias desde 30/12/1899) → "2026-11-03". Fora de 2015 a 2100, null. */
export function serialDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
  const y = d.getUTCFullYear();
  if (y < 2015 || y > 2100) return null;
  return `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Número cru: não passa pela leitura de texto (um 150.125 de fórmula não vira 150 mil). Contagem precisa ser inteira. */
function numberCell(n: number, integer: boolean): number | null {
  if (!Number.isFinite(n) || n < 0) return null;
  if (!integer) return n;
  return Math.abs(n - Math.round(n)) < 1e-9 ? Math.round(n) : null;
}

/**
 * Lê e valida a tabela (a primeira linha é o cabeçalho). `today` (YYYY-MM-DD) barra
 * datas no futuro. Linhas com a mesma data e origem são somadas. Uma linha inválida
 * recusa a planilha inteira: funil pela metade conta uma história errada.
 */
export function readLaunchTable(table: readonly (readonly LaunchCell[])[], opts: { today?: string } = {}): LaunchResult {
  const rowsIn = table.filter((r) => r.some((c) => cellText(c) !== ""));
  if (rowsIn.length < 2) return fail([{ line: 0, message: "A planilha precisa do cabeçalho e de pelo menos uma linha de dados." }]);
  if (rowsIn.length - 1 > IMPORT_MAX_ROWS) return fail([{ line: 0, message: `A planilha passa de ${IMPORT_MAX_ROWS.toLocaleString("pt-BR")} linhas. Deixe na aba só o período do lançamento.` }]);

  const header = rowsIn[0].map(cellText);
  const map = mapLaunchHeader(header);
  const absent = LAUNCH_COLUMNS.filter((c) => c.required && map[c.key] === undefined);
  if (absent.length) return fail([{ line: 1, message: `Falta a coluna ${absent.map((c) => `"${c.label}"`).join(", ")} no cabeçalho.` }]);

  const errors: ImportError[] = [];
  const merged = new Map<string, LaunchRow>();
  let repeats = 0;
  const rawOf = (row: readonly LaunchCell[], key: LaunchColumn): LaunchCell => (map[key] === undefined ? "" : row[map[key]]);
  const cellOf = (row: readonly LaunchCell[], key: LaunchColumn) => cellText(rawOf(row, key));
  const labelOf = (key: LaunchColumn) => LAUNCH_COLUMNS.find((c) => c.key === key)!.label;
  const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  rowsIn.slice(1).forEach((row, i) => {
    const line = i + 2;
    const rawDate = rawOf(row, "date");
    const date = typeof rawDate === "number" ? serialDate(rawDate) : parseDate(cellOf(row, "date"));
    if (!date) return void errors.push({ line, message: `Data "${cellOf(row, "date")}" inválida. Use dd/mm/aaaa.` });
    if (opts.today && date > opts.today) return void errors.push({ line, message: `Data ${ddmm(date)} está no futuro.` });
    const origin = cellOf(row, "origin").replace(/\s+/g, " ").slice(0, 60) || LAUNCH_NO_ORIGIN;
    const values = {} as Record<CountColumn | "value", number>;
    for (const key of [...COUNTS, "value"] as const) {
      const raw = rawOf(row, key);
      const n = typeof raw === "number" ? numberCell(raw, key !== "value") : parseNumber(cellOf(row, key), { integer: key !== "value" });
      if (n === null) return void errors.push({ line, message: `Valor "${cellOf(row, key)}" inválido na coluna "${labelOf(key)}".` });
      values[key] = n;
    }
    const id = `${date}|${plain(origin)}`;
    const seen = merged.get(id);
    if (seen) {
      repeats++;
      for (const key of [...COUNTS, "value"] as const) seen[key] += values[key];
    } else merged.set(id, { date, origin, ...values });
  });
  if (errors.length) return fail(errors);

  const rows = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date) || a.origin.localeCompare(b.origin, "pt-BR"));
  const origins = [...new Map(rows.map((r) => [plain(r.origin), r.origin])).values()];
  if (origins.length > LAUNCH_MAX_ORIGINS) return fail([{ line: 0, message: `A planilha tem mais de ${LAUNCH_MAX_ORIGINS} origens. Agrupe as menores (por exemplo, em "Outros").` }]);
  for (const r of rows) r.value = Math.round(r.value * 100) / 100;
  const sum = (key: CountColumn | "value") => Math.round(rows.reduce((a, r) => a + r[key], 0) * 100) / 100;
  const from = rows[0].date;
  const to = rows[rows.length - 1].date;
  return {
    ok: true,
    rows,
    header,
    summary: {
      rows: rows.length,
      from,
      to,
      days: Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1,
      origins,
      leads: sum("leads"),
      attended: sum("attended"),
      visits: sum("visits"),
      proposals: sum("proposals"),
      sales: sum("sales"),
      value: sum("value"),
      missing: LAUNCH_COLUMNS.filter((c) => !c.required && map[c.key] === undefined).map((c) => c.key),
      merged: repeats,
    },
  };
}

/** Lê o texto da planilha: CSV exportado ou as células coladas do Google Sheets. */
export function readLaunchSheet(text: string, opts: { today?: string } = {}): LaunchResult {
  if (new TextEncoder().encode(text).length > IMPORT_MAX_BYTES) return fail([{ line: 0, message: "A planilha passa de 2 MB. Deixe na aba só o período do lançamento." }]);
  return readLaunchTable(parseCsv(text), opts);
}

/** O que a planilha traz, em uma frase. */
export function launchSummaryText(s: LaunchSummary): string {
  const n = (v: number) => v.toLocaleString("pt-BR");
  const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
  const parts = [`${n(s.leads)} ${s.leads === 1 ? "lead" : "leads"}`];
  if (!s.missing.includes("visits")) parts.push(`${n(s.visits)} ${s.visits === 1 ? "visita" : "visitas"}`);
  if (!s.missing.includes("sales")) parts.push(`${n(s.sales)} ${s.sales === 1 ? "venda" : "vendas"}`);
  return `${n(s.days)} ${s.days === 1 ? "dia" : "dias"}, de ${ddmm(s.from)} a ${ddmm(s.to)}: ${parts.join(", ")}.`;
}
