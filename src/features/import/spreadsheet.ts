// Importação por planilha (CSV ou Google Sheets) das plataformas sem API aberta
// (modalidade "import" de accounts/connection-modes.ts): lê o texto, reconhece as
// colunas, valida linha por linha e devolve os dados no formato do armazém
// (campanhas + fatos diários, como em sync/dataset.ts). Puro: a mesma regra vale
// na prévia do navegador e na gravação do servidor.
//
// Colunas: data, campanha e investimento são obrigatórias; impressões, cliques,
// conversões e receita são opcionais (ausentes = 0). Aceita vírgula, ponto e
// vírgula ou tabulação como separador, números no formato brasileiro ou
// americano e datas em dd/mm/aaaa ou aaaa-mm-dd.

import type { PlatformId } from "@/features/accounts/platforms";
import type { AccountDay, CampaignDay, CampaignEntity, DailyMetrics } from "@/features/sync/dataset";

// ---- limites --------------------------------------------------------------------------

export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 20_000;
export const IMPORT_MAX_CAMPAIGNS = 500;
/** Quantos erros a tela mostra (o resto vira "e mais N"). */
export const IMPORT_MAX_ERRORS = 20;

// ---- colunas --------------------------------------------------------------------------

export type ImportColumn = "date" | "campaign" | "spend" | "impressions" | "clicks" | "conversions" | "revenue";

type ColumnDef = { key: ImportColumn; label: string; required: boolean; aliases: string[] };

export const IMPORT_COLUMNS: ColumnDef[] = [
  { key: "date", label: "data", required: true, aliases: ["data", "dia", "date", "day"] },
  { key: "campaign", label: "campanha", required: true, aliases: ["campanha", "nome da campanha", "campaign", "campaign name"] },
  { key: "spend", label: "investimento", required: true, aliases: ["investimento", "custo", "gasto", "valor gasto", "valor investido", "valor usado", "spend", "cost", "amount spent"] },
  { key: "impressions", label: "impressões", required: false, aliases: ["impressoes", "impressions", "impr"] },
  { key: "clicks", label: "cliques", required: false, aliases: ["cliques", "clicks"] },
  { key: "conversions", label: "conversões", required: false, aliases: ["conversoes", "conversions", "vendas", "compras", "pedidos", "leads", "resultados"] },
  { key: "revenue", label: "receita", required: false, aliases: ["receita", "faturamento", "valor de conversao", "valor das conversoes", "valor de vendas", "revenue", "conversion value", "sales"] },
];

/** Modelo para baixar: cabeçalho e duas linhas de exemplo. */
export const IMPORT_TEMPLATE_CSV = ["data;campanha;investimento;impressões;cliques;conversões;receita", "01/11/2026;Campanha de exemplo;150,00;12000;340;12;1890,00", "02/11/2026;Campanha de exemplo;162,50;13150;371;15;2310,40", ""].join("\n");

/** Minúsculas, sem acento e sem pontuação: "Impressões " e "impressoes" viram o mesmo. */
const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// ---- CSV ------------------------------------------------------------------------------

/** Separador do arquivo: o que mais aparece na primeira linha, fora das aspas. */
export function detectDelimiter(text: string): "," | ";" | "\t" {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  if (counts[";"] >= counts[","] && counts[";"] >= counts["\t"] && counts[";"] > 0) return ";";
  return counts["\t"] > counts[","] ? "\t" : ",";
}

/** Texto CSV → linhas de células. Aspas duplas protegem separador e quebra de linha; "" é uma aspa. */
export function parseCsv(input: string, delimiter: string = detectDelimiter(input)): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // linhas totalmente vazias (fim do arquivo, linhas em branco) não contam
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ""));
}

// ---- valores --------------------------------------------------------------------------

/**
 * Número em formato brasileiro ("1.234,56", "R$ 150,00") ou americano
 * ("1,234.56"). Com os dois separadores, o último é o decimal. Só vírgula: decimal
 * (padrão do Brasil), a não ser que sejam vários grupos de milhar ("1,234,567").
 * Só ponto: milhar quando forma grupos de três ("1.234"), decimal no resto ("1.5").
 * `integer`: contagens (impressões, cliques) não têm decimal, então qualquer
 * separador é de milhar. Vazio = 0. Inválido ou negativo = null.
 */
export function parseNumber(raw: string, opts: { integer?: boolean } = {}): number | null {
  const text = raw.replace(/[\s ]/g, "").replace(/^(R\$|US\$|\$|€)/i, "").replace(/%$/, "");
  if (text === "" || text === "-" || text === "—") return 0;
  if (!/^\d[\d.,]*$/.test(text)) return null;
  let normalized: string;
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (opts.integer) {
    // "12.000", "12,000" → 12000; "12000,00" ou "12000.00" (decimal zerado) → 12000
    const decimals = /[.,](\d{1,2})$/.exec(text);
    if (decimals && Number(decimals[1]) !== 0) return null;
    normalized = (decimals ? text.slice(0, decimals.index) : text).replace(/[.,]/g, "");
  } else if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normalized = text.split(thousands).join("").replace(decimal, ".");
  } else if (lastComma >= 0) {
    normalized = /^\d{1,3}(,\d{3}){2,}$/.test(text) ? text.replace(/,/g, "") : text.replace(",", ".");
    if ((normalized.match(/\./g) ?? []).length > 1) return null;
  } else if (lastDot >= 0) {
    normalized = /^\d{1,3}(\.\d{3})+$/.test(text) ? text.replace(/\./g, "") : text;
    if ((normalized.match(/\./g) ?? []).length > 1) return null;
  } else normalized = text;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "31/12/2026", "31-12-26", "2026-12-31" ou "2026/12/31" → "2026-12-31". Data que não existe = null. */
export function parseDate(raw: string): string | null {
  const text = raw.trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ].*)?$/.exec(text);
  const br = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(text);
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (br) [d, m, y] = [Number(br[1]), Number(br[2]), br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3])];
  else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 2015 || y > 2100) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

// ---- leitura --------------------------------------------------------------------------

export type ImportRow = { date: string; campaign: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number };

export type ImportError = { /** Linha do arquivo (1 = cabeçalho). 0 = o arquivo todo. */ line: number; message: string };

export type ImportSummary = {
  rows: number;
  campaigns: number;
  from: string;
  to: string;
  days: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  /** Colunas opcionais que o arquivo não trouxe (entram zeradas). */
  missing: ImportColumn[];
  /** Linhas repetidas (mesma data e campanha) que foram somadas. */
  merged: number;
};

export type ImportResult = { ok: true; rows: ImportRow[]; summary: ImportSummary } | { ok: false; errors: ImportError[]; /** Erros além dos mostrados. */ more: number };

const fail = (errors: ImportError[]): ImportResult => ({ ok: false, errors: errors.slice(0, IMPORT_MAX_ERRORS), more: Math.max(0, errors.length - IMPORT_MAX_ERRORS) });

/** Em que posição do cabeçalho está cada coluna (a primeira que casar com um dos nomes aceitos). */
export function mapHeader(header: string[]): Partial<Record<ImportColumn, number>> {
  const names = header.map(plain);
  const map: Partial<Record<ImportColumn, number>> = {};
  for (const col of IMPORT_COLUMNS) {
    const accepted = [plain(col.label), ...col.aliases];
    const at = names.findIndex((n, i) => accepted.includes(n) && !Object.values(map).includes(i));
    if (at >= 0) map[col.key] = at;
  }
  return map;
}

/**
 * Lê e valida a planilha. `today` (YYYY-MM-DD) barra datas no futuro. Linhas com a
 * mesma data e campanha são somadas. Qualquer linha inválida recusa o arquivo
 * inteiro: importar pela metade deixaria o período com números errados.
 */
export function readSpreadsheet(text: string, opts: { today?: string } = {}): ImportResult {
  if (new TextEncoder().encode(text).length > IMPORT_MAX_BYTES) return fail([{ line: 0, message: "O arquivo passa de 2 MB. Divida o período em arquivos menores." }]);
  const table = parseCsv(text);
  if (table.length < 2) return fail([{ line: 0, message: "A planilha precisa do cabeçalho e de pelo menos uma linha de dados." }]);
  if (table.length - 1 > IMPORT_MAX_ROWS) return fail([{ line: 0, message: `A planilha passa de ${IMPORT_MAX_ROWS.toLocaleString("pt-BR")} linhas. Divida o período em arquivos menores.` }]);

  const map = mapHeader(table[0]);
  const absent = IMPORT_COLUMNS.filter((c) => c.required && map[c.key] === undefined);
  if (absent.length) return fail([{ line: 1, message: `Falta a coluna ${absent.map((c) => `"${c.label}"`).join(", ")} no cabeçalho.` }]);

  const errors: ImportError[] = [];
  const merged = new Map<string, ImportRow>();
  let repeats = 0;
  const cellOf = (row: string[], key: ImportColumn) => (map[key] === undefined ? "" : (row[map[key]] ?? ""));
  table.slice(1).forEach((row, i) => {
    const line = i + 2;
    const date = parseDate(cellOf(row, "date"));
    const campaign = cellOf(row, "campaign").replace(/\s+/g, " ").slice(0, 200);
    if (!date) return void errors.push({ line, message: `Data "${cellOf(row, "date")}" inválida. Use dd/mm/aaaa.` });
    if (opts.today && date > opts.today) return void errors.push({ line, message: `Data ${cellOf(row, "date")} está no futuro.` });
    if (!campaign) return void errors.push({ line, message: "Falta o nome da campanha." });
    const values = {} as Record<Exclude<ImportColumn, "date" | "campaign">, number>;
    for (const key of ["spend", "impressions", "clicks", "conversions", "revenue"] as const) {
      const n = parseNumber(cellOf(row, key), { integer: key === "impressions" || key === "clicks" });
      if (n === null) return void errors.push({ line, message: `Valor "${cellOf(row, key)}" inválido na coluna "${IMPORT_COLUMNS.find((c) => c.key === key)!.label}".` });
      values[key] = n;
    }
    if (values.clicks > values.impressions && values.impressions > 0) return void errors.push({ line, message: "Há mais cliques do que impressões." });
    const id = `${date}|${plain(campaign)}`;
    const seen = merged.get(id);
    if (seen) {
      repeats++;
      for (const key of ["spend", "impressions", "clicks", "conversions", "revenue"] as const) seen[key] += values[key];
    } else merged.set(id, { date, campaign, ...values });
  });
  if (errors.length) return fail(errors);

  const rows = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date) || a.campaign.localeCompare(b.campaign, "pt-BR"));
  const campaigns = new Set(rows.map((r) => plain(r.campaign)));
  if (campaigns.size > IMPORT_MAX_CAMPAIGNS) return fail([{ line: 0, message: `A planilha tem mais de ${IMPORT_MAX_CAMPAIGNS} campanhas.` }]);
  const round = (n: number) => Math.round(n * 100) / 100;
  for (const r of rows) {
    r.spend = round(r.spend);
    r.revenue = round(r.revenue);
    r.conversions = round(r.conversions);
  }
  const sum = (key: keyof Omit<ImportRow, "date" | "campaign">) => round(rows.reduce((a, r) => a + r[key], 0));
  const from = rows[0].date;
  const to = rows[rows.length - 1].date;
  return {
    ok: true,
    rows,
    summary: {
      rows: rows.length,
      campaigns: campaigns.size,
      from,
      to,
      days: Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1,
      spend: sum("spend"),
      impressions: sum("impressions"),
      clicks: sum("clicks"),
      conversions: sum("conversions"),
      revenue: sum("revenue"),
      missing: IMPORT_COLUMNS.filter((c) => !c.required && map[c.key] === undefined).map((c) => c.key),
      merged: repeats,
    },
  };
}

// ---- formato do armazém ---------------------------------------------------------------

/** Id estável da campanha a partir do nome: importar de novo atualiza a mesma campanha. */
export function campaignExternalId(name: string): string {
  const slug = plain(name).replace(/ /g, "-") || "campanha";
  if (slug.length <= 56) return slug;
  // nome longo: corta e acrescenta um resumo do nome inteiro para não colidir
  let h = 2166136261;
  for (const ch of slug) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return `${slug.slice(0, 47)}-${(h >>> 0).toString(36)}`;
}

const metrics = (r: Pick<ImportRow, "spend" | "impressions" | "clicks" | "conversions" | "revenue">): DailyMetrics => ({
  spend: r.spend,
  impressions: r.impressions,
  reach: null,
  clicks: r.clicks,
  linkClicks: null,
  landingPageViews: null,
  addToCart: null,
  initiateCheckout: null,
  conversions: r.conversions,
  conversionValue: r.revenue,
  videoViews: null,
  videoThruplays: null,
  searchImpressionShare: null,
  searchLostIsBudget: null,
  searchLostIsRank: null,
});

/** Os dados da planilha no formato de sync/dataset.ts (campanhas + fatos por campanha e por conta). */
export type ImportedDataset = {
  platform: PlatformId;
  accountExternalId: string;
  currency: string;
  range: { from: string; to: string };
  campaigns: CampaignEntity[];
  campaignDaily: CampaignDay[];
  accountDaily: AccountDay[];
};

export function toDataset(rows: ImportRow[], account: { platform: PlatformId; externalId: string; currency?: string }): ImportedDataset {
  const names = new Map<string, { name: string; startedOn: string }>();
  for (const r of rows) {
    const id = campaignExternalId(r.campaign);
    const known = names.get(id);
    if (!known) names.set(id, { name: r.campaign, startedOn: r.date });
    else if (r.date < known.startedOn) known.startedOn = r.date;
  }
  const byDay = new Map<string, ImportRow>();
  for (const r of rows) {
    const day = byDay.get(r.date);
    if (!day) byDay.set(r.date, { ...r, campaign: "" });
    else for (const key of ["spend", "impressions", "clicks", "conversions", "revenue"] as const) day[key] = Math.round((day[key] + r[key]) * 100) / 100;
  }
  const dates = [...byDay.keys()].sort();
  return {
    platform: account.platform,
    accountExternalId: account.externalId,
    currency: account.currency ?? "BRL",
    range: { from: dates[0] ?? "", to: dates[dates.length - 1] ?? "" },
    campaigns: [...names].map(([externalId, c]) => ({ externalId, name: c.name, status: "active", objective: null, channel: null, funnelStage: null, dailyBudget: null, startedOn: c.startedOn })),
    campaignDaily: rows.map((r) => ({ campaignExternalId: campaignExternalId(r.campaign), date: r.date, ...metrics(r) })),
    accountDaily: dates.map((date) => ({ date, ...metrics(byDay.get(date)!) })),
  };
}

// ---- Google Sheets --------------------------------------------------------------------

export type SheetsLink = { ok: true; spreadsheetId: string; gid: string; /** Endereço que devolve a aba em CSV (a planilha precisa estar compartilhada por link). */ csvUrl: string } | { ok: false; error: string };

/**
 * Link de uma planilha do Google → endereço de exportação em CSV. Só aceita
 * https://docs.google.com/spreadsheets/d/<id>/...: o servidor nunca busca um
 * endereço que a pessoa digitou livremente.
 */
export function sheetsCsvUrl(link: string): SheetsLink {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return { ok: false, error: "Cole o link completo da planilha do Google Sheets." };
  }
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || url.username || url.password || url.port) return { ok: false, error: "O link precisa ser de uma planilha do Google Sheets (docs.google.com)." };
  const match = /^\/spreadsheets\/d\/([A-Za-z0-9_-]{20,120})(?:\/|$)/.exec(url.pathname);
  if (!match) return { ok: false, error: "Este link não é de uma planilha do Google Sheets." };
  const fromHash = /(?:^|[#&])gid=(\d{1,12})(?:&|$)/.exec(url.hash);
  const gid = fromHash?.[1] ?? (/^\d{1,12}$/.test(url.searchParams.get("gid") ?? "") ? url.searchParams.get("gid")! : "0");
  return { ok: true, spreadsheetId: match[1], gid, csvUrl: `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}` };
}
