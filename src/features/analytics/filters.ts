// Filtros do dashboard interativo: o que está escolhido, como vai para a URL e o
// que cada clique faz. Puro: serve ao servidor (dados reais), ao navegador
// (amostras) e ao assistente. Os filtros nunca são salvos no dashboard.

import { addDays, dayNumber, isIsoDate } from "@/features/sync/dates";

export type FilterDim = "campaigns" | "ads" | "platforms";
export type DayRange = { from: string; to: string };

export type DashFilters = {
  campaigns: string[];
  ads: string[];
  platforms: string[];
  days: DayRange | null;
};

export const NO_FILTERS: DashFilters = { campaigns: [], ads: [], platforms: [], days: null };

export type FilterQuery = Record<string, string | string[] | undefined>;

/** Nomes dos itens filtrados, para os chips e o assistente. */
export type FilterLabels = Partial<Record<FilterDim, Record<string, string>>>;

/** O que o servidor efetivamente aplicou. */
export type FilterInfo = {
  filters: DashFilters;
  labels: FilterLabels;
  /** Trecho comparado (mesmos dias no período anterior). Só com filtro de dias. */
  compared: DayRange | null;
};

const PARAM: Record<FilterDim, string> = { campaigns: "campanha", ads: "anuncio", platforms: "plataforma" };
const DIMS = Object.keys(PARAM) as FilterDim[];

export const DIM_LABEL: Record<FilterDim | "days", string> = { campaigns: "Campanha", ads: "Anúncio", platforms: "Plataforma", days: "Dias" };

const ID = /^[\w.:-]{1,64}$/;
/** Teto de itens por dimensão: a URL e a chave de cache não crescem sem limite. */
const MAX_IDS = 20;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function ids(raw: string | undefined): string[] {
  const list = (raw ?? "").split(",").filter((id, i, all) => ID.test(id) && all.indexOf(id) === i);
  return list.slice(0, MAX_IDS).sort();
}

/** Da URL para os filtros. O que não vale é ignorado; quem aplica ainda confere se o item existe. */
export function parseFilters(query: FilterQuery | URLSearchParams): DashFilters {
  const read = (name: string) => (query instanceof URLSearchParams ? (query.get(name) ?? undefined) : one(query[name]));
  const from = read("de");
  const to = read("ate") ?? from;
  return {
    campaigns: ids(read(PARAM.campaigns)),
    ads: ids(read(PARAM.ads)),
    platforms: ids(read(PARAM.platforms)),
    days: from && to && isIsoDate(from) && isIsoDate(to) && from <= to ? { from, to } : null,
  };
}

export const hasFilters = (f: DashFilters) => f.campaigns.length > 0 || f.ads.length > 0 || f.platforms.length > 0 || f.days != null;

export const filtersKey = (f: DashFilters) => JSON.stringify([f.campaigns, f.ads, f.platforms, f.days?.from ?? "", f.days?.to ?? ""]);

/** A busca da URL com estes filtros, mantendo o resto (período, aba). */
export function filterSearch(current: string, f: DashFilters): string {
  const q = new URLSearchParams(current);
  for (const dim of DIMS) {
    q.delete(PARAM[dim]);
    if (f[dim].length) q.set(PARAM[dim], f[dim].join(","));
  }
  q.delete("de");
  q.delete("ate");
  if (f.days) {
    q.set("de", f.days.from);
    q.set("ate", f.days.to);
  }
  const text = q.toString().replace(/%2C/g, ",");
  return text ? `?${text}` : "";
}

/** Clique: o mesmo item sai; outro troca. Com Cmd/Ctrl, soma ao que já está escolhido. */
export function toggleFilter(f: DashFilters, dim: FilterDim, id: string, additive = false): DashFilters {
  const list = f[dim];
  const next = list.includes(id) ? list.filter((x) => x !== id) : additive ? [...list, id].slice(0, MAX_IDS) : [id];
  return { ...f, [dim]: [...next].sort() };
}

/** Selecionar de novo o mesmo trecho tira o filtro. */
export function toggleDays(f: DashFilters, days: DayRange | null): DashFilters {
  const same = days && f.days && f.days.from === days.from && f.days.to === days.to;
  return { ...f, days: same ? null : days };
}

export function removeFilter(f: DashFilters, dim: FilterDim | "days", id?: string): DashFilters {
  if (dim === "days") return { ...f, days: null };
  return { ...f, [dim]: id ? f[dim].filter((x) => x !== id) : [] };
}

// ---- dias ------------------------------------------------------------------------------------

export const daysIn = (r: DayRange) => dayNumber(r.to) - dayNumber(r.from) + 1;

/** O trecho dentro do período. Fora dele, ou cobrindo o período inteiro, não há filtro. */
export function clampDays(days: DayRange | null, period: DayRange): DayRange | null {
  if (!days) return null;
  const from = days.from < period.from ? period.from : days.from;
  const to = days.to > period.to ? period.to : days.to;
  if (from > to || (from === period.from && to === period.to)) return null;
  return { from, to };
}

/** Os mesmos dias no período anterior: o período anterior tem o mesmo tamanho, logo antes. */
export const comparedDays = (days: DayRange, periodDays: number): DayRange => ({ from: addDays(days.from, -periodDays), to: addDays(days.to, -periodDays) });

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "10–15/09"; em meses diferentes, "28/08–02/09"; um dia só, "10/09". */
export function rangeLabel(r: DayRange): string {
  if (r.from === r.to) return dm(r.from);
  if (r.from.slice(0, 7) === r.to.slice(0, 7)) return `${r.from.slice(8, 10)}–${dm(r.to)}`;
  return `${dm(r.from)}–${dm(r.to)}`;
}

// ---- o que não dá para filtrar ---------------------------------------------------------------

/** Partes do dashboard com dados reais que não têm uma das dimensões nas linhas do armazém. */
export type FilterSection = "breakdown" | "funnel" | "products";

const NOT_FILTERED: Record<FilterSection, readonly (FilterDim | "days")[]> = {
  // público, posicionamento, dispositivo, região e hora: por conta e dia, sem campanha
  breakdown: ["campaigns", "ads"],
  // as linhas de anúncio não têm visualização da página, carrinho nem checkout
  funnel: ["ads"],
  // produtos: por conta e dia, sem campanha
  products: ["campaigns", "ads"],
};

const active = (f: DashFilters, dim: FilterDim | "days") => (dim === "days" ? f.days != null : f[dim].length > 0);

export const notFilteredDims = (section: FilterSection, f: DashFilters) => NOT_FILTERED[section].filter((d) => active(f, d));

export const activeDims = (f: DashFilters): (FilterDim | "days")[] => (["campaigns", "ads", "platforms", "days"] as const).filter((d) => active(f, d));

/** "não filtrado por Campanha e Anúncio". Sem dimensão, nada. */
export function notFilteredText(dims: readonly (FilterDim | "days")[]): string | null {
  if (!dims.length) return null;
  const names = dims.map((d) => DIM_LABEL[d]);
  return `não filtrado por ${names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0]}`;
}

/** "Campanha Loja, Anúncio Vídeo 15s, Dias 10–15/10": os chips em uma frase (assistente, PDF, aviso). */
export function filterSummary(f: DashFilters, labels: FilterLabels = {}): string {
  const parts: string[] = [];
  for (const dim of DIMS) {
    for (const id of f[dim]) parts.push(`${DIM_LABEL[dim]} ${labels[dim]?.[id] ?? id}`);
  }
  if (f.days) parts.push(`Dias ${rangeLabel(f.days)}`);
  return parts.join(", ");
}
