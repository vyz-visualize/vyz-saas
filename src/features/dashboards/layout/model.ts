// Disposição de cada aba do dashboard numa grade de 12 colunas. O modelo vem do
// template (os blocos que a aba tem); a pessoa move, redimensiona, esconde e traz
// de volta esses blocos e soma cards de métrica por plataforma. Funções puras: o
// painel, o servidor (validação) e os testes usam as mesmas.

import type { PageId, PageLayout, WidgetSpec } from "@/features/templates/types";

export const COLS = 12;
/** Altura de uma linha da grade, em px. */
export const ROW = 28;
export const GAP = 8;
/** Abaixo disso, a grade vira uma coluna (na ordem da disposição) e não edita. */
export const GRID_MIN_WIDTH = 720;
/** Cards de métrica por plataforma que cabem numa aba. */
export const METRIC_CARDS_MAX = 12;

export type LayoutItem = { id: string; x: number; y: number; w: number; h: number };
export type PageGrid = LayoutItem[];
/** O que o banco guarda (dashboards.layout): só as abas mexidas. */
export type DashboardLayout = Partial<Record<PageId, PageGrid>>;

export type BlockKind = "kpis" | "widget" | "metric" | "skin";
export type Limits = { minW: number; maxW: number; minH: number; maxH: number };

// ---- ids --------------------------------------------------------------------------------

export const KPIS_ID = "kpis";
export const widgetId = (i: number) => `w${i}`;
/** Card de uma métrica de uma plataforma: m:meta:ctr. */
export const metricCardId = (platform: string, metric: string) => `m:${platform}:${metric}`;

export function parseMetricCardId(id: string): { platform: string; metric: string } | null {
  const m = /^m:([a-z0-9]+):([a-zA-Z0-9]+)$/.exec(id);
  return m ? { platform: m[1], metric: m[2] } : null;
}

export function kindOf(id: string): BlockKind {
  if (id === KPIS_ID) return "kpis";
  if (id.startsWith("s-")) return "skin";
  return id.startsWith("m:") ? "metric" : "widget";
}

// ---- tamanhos ---------------------------------------------------------------------------

/** Altura padrão (linhas) de cada tipo de bloco do template. */
const WIDGET_H: Record<WidgetSpec["type"], number> = {
  line: 10,
  funnel: 9,
  bars: 10,
  scatter: 10,
  split: 6,
  platforms: 8,
  table: 13,
  creatives: 13,
  goals: 9,
  audience: 10,
  compare: 11,
  crm: 10,
  alerts: 8,
  audio: 8,
};

export function limitsOf(id: string, kpiCount = 4): Limits {
  const kind = kindOf(id);
  if (kind === "kpis") {
    const rows = Math.ceil(Math.max(1, kpiCount) / 4);
    return { minW: 6, maxW: COLS, minH: rows * 4, maxH: 24 };
  }
  if (kind === "metric") return { minW: 2, maxW: 4, minH: 4, maxH: 6 };
  if (kind === "skin") return { minW: 2, maxW: COLS, minH: 2, maxH: 30 };
  return { minW: 3, maxW: COLS, minH: 6, maxH: 20 };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function fitLimits(item: LayoutItem, limits: Limits): LayoutItem {
  const w = clamp(Math.round(item.w), limits.minW, limits.maxW);
  const h = clamp(Math.round(item.h), limits.minH, limits.maxH);
  return { ...item, w, h, x: clamp(Math.round(item.x), 0, COLS - w), y: Math.max(0, Math.round(item.y)) };
}

/** Por que um movimento ou redimensionamento não foi adiante (o painel avisa em uma frase). */
export type Blocked = "min" | "max" | "edge";

export const BLOCKED_TEXT: Record<Blocked, string> = {
  min: "Este bloco não fica menor que isso.",
  max: "Este é o tamanho máximo deste bloco.",
  edge: "O bloco não passa da borda da grade.",
};

/**
 * Ajusta o pedido (mover ou redimensionar) ao que a grade permite e diz se algo
 * foi barrado. Redimensionar nunca desloca o bloco: a largura para na borda.
 */
export function constrain(mode: "move" | "resize", wanted: LayoutItem, limits: Limits): { item: LayoutItem; blocked: Blocked | null } {
  if (mode === "move") {
    const item = fitLimits(wanted, limits);
    const blocked = wanted.x < 0 || wanted.x + item.w > COLS || wanted.y < 0 ? "edge" : null;
    return { item, blocked };
  }
  const room = COLS - wanted.x;
  const item = fitLimits({ ...wanted, w: Math.min(wanted.w, room) }, limits);
  const blocked: Blocked | null =
    wanted.w < limits.minW || wanted.h < limits.minH ? "min" : wanted.w > limits.maxW || wanted.h > limits.maxH ? "max" : wanted.w > room ? "edge" : null;
  return { item, blocked };
}

// ---- disposição padrão ------------------------------------------------------------------

/** Os blocos que o template dá a esta aba, com o tamanho padrão de cada um. */
export function templateBlocks(layout: PageLayout): { id: string; w: number; h: number }[] {
  const out: { id: string; w: number; h: number }[] = [];
  if (layout.kpis.length) out.push({ id: KPIS_ID, w: COLS, h: Math.ceil(layout.kpis.length / 4) * 4 });
  layout.widgets.forEach((w, i) => out.push({ id: widgetId(i), w: (w.span ?? 2) * 3, h: w.rows ?? WIDGET_H[w.type] }));
  return out;
}

/** Disposição do template: da esquerda para a direita, quebrando a linha quando não cabe. */
export function defaultGrid(layout: PageLayout): PageGrid {
  const items: LayoutItem[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const b of templateBlocks(layout)) {
    if (x + b.w > COLS) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    items.push({ id: b.id, x, y, w: b.w, h: b.h });
    x += b.w;
    rowH = Math.max(rowH, b.h);
  }
  // proporção do modelo: quem divide a fileira tem a mesma altura (o funil não fica mais baixo que o gráfico ao lado)
  return items.map((it) => ({ ...it, h: Math.max(...items.filter((o) => o.y === it.y).map((o) => o.h)) }));
}

// ---- colisão e encaixe ------------------------------------------------------------------

export const overlaps = (a: LayoutItem, b: LayoutItem) => a.id !== b.id && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const byPosition = (a: LayoutItem, b: LayoutItem) => a.y - b.y || a.x - b.x;

/** Sobe cada bloco até encostar no de cima (sem buracos verticais). */
export function compact(items: PageGrid, fixedId?: string): PageGrid {
  const placed: LayoutItem[] = [];
  const fixed = fixedId ? items.find((i) => i.id === fixedId) : undefined;
  if (fixed) placed.push(fixed);
  for (const it of [...items].sort(byPosition)) {
    if (it.id === fixedId) continue;
    let y = it.y;
    while (y > 0 && !placed.some((p) => overlaps({ ...it, y: y - 1 }, p))) y--;
    while (placed.some((p) => overlaps({ ...it, y }, p))) y++;
    placed.push({ ...it, y });
  }
  return items.map((i) => placed.find((p) => p.id === i.id)!);
}

/** Coloca um bloco num lugar: quem estava ali abre espaço para baixo e tudo se reencaixa. */
export function place(items: PageGrid, next: LayoutItem): PageGrid {
  const others = items.filter((i) => i.id !== next.id);
  return compact([...others, next], next.id);
}

/** Na ordem de leitura (para a tela estreita e para o PDF). */
export const readingOrder = (items: PageGrid) => [...items].sort(byPosition);

export const gridRows = (items: PageGrid) => items.reduce((a, i) => Math.max(a, i.y + i.h), 0);

// ---- encaixe na tela (16:9, sem rolar a página) ------------------------------------------

/** Fileira só de cards (KPI, métrica, número do visual) no aperto: o mínimo em que o card ainda cabe inteiro. */
export const FIT_COMPACT_MIN = 25;
/** Os gráficos ficam com pelo menos isto por fileira antes de os cards voltarem à altura cheia (ROW). */
export const FIT_COMFORT_ROW = 20;
/** Abaixo disso os gráficos ficam ilegíveis: a grade desiste de caber e a página volta a rolar. */
export const FIT_MIN_ROW = 13;

const clampTo = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Altura de cada fileira para a grade ocupar exatamente `height` px (a altura livre da tela).
 * As fileiras só de cards não crescem com a tela: ficam entre FIT_COMPACT_MIN e ROW (cedem
 * altura quando os gráficos apertam). As outras dividem o que sobra por igual.
 * Devolve null quando não cabe (tela baixa demais ou blocos demais): aí vale a altura padrão.
 */
export function fitRows(items: PageGrid, height: number, isCompact: (id: string) => boolean): number[] | null {
  const rows = gridRows(items);
  if (!rows || !(height > 0)) return null;
  const total = height + GAP; // a última fileira não leva o respiro de baixo
  const compact = Array.from({ length: rows }, (_, r) => {
    const here = items.filter((it) => it.y <= r && r < it.y + it.h);
    return here.length > 0 && here.every((it) => isCompact(it.id));
  });
  const fixed = compact.filter(Boolean).length;
  const flex = rows - fixed;
  if (!flex) return total / rows >= FIT_MIN_ROW ? compact.map(() => total / rows) : null;
  const card = fixed ? clampTo((total - FIT_COMFORT_ROW * flex) / fixed, FIT_COMPACT_MIN, ROW) : 0;
  const rest = (total - fixed * card) / flex;
  if (rest < FIT_MIN_ROW) return null;
  return compact.map((c) => (c ? card : rest));
}

/** Onde cada fileira começa (px), com uma posição a mais no fim (o pé da grade). */
export function rowTops(heights: readonly number[]): number[] {
  const tops = [0];
  for (const h of heights) tops.push(tops[tops.length - 1] + h);
  return tops;
}

/** Primeiro lugar livre para um bloco novo (de cima para baixo, da esquerda para a direita). */
export function firstFree(items: PageGrid, w: number, h: number): { x: number; y: number } {
  for (let y = 0; y <= gridRows(items); y++) {
    for (let x = 0; x + w <= COLS; x++) {
      const probe = { id: "_", x, y, w, h };
      if (!items.some((i) => overlaps(probe, i))) return { x, y };
    }
  }
  return { x: 0, y: gridRows(items) };
}

// ---- alinhar ---------------------------------------------------------------------------

/**
 * "Alinhar grade": arruma a disposição sem trocar a ordem de ninguém. Cada faixa
 * de blocos lado a lado passa a fechar as 12 colunas (sem buraco no meio nem no
 * fim) e todos ficam com a mesma altura; as faixas encostam uma na outra. Onde há
 * blocos empilhados ao lado de um mais alto, a pilha só é esticada até o pé da
 * faixa. Os limites de cada bloco continuam valendo.
 */
export function alignGrid(items: PageGrid, kpiCount = 4): PageGrid {
  const out: LayoutItem[] = [];
  let y = 0;
  for (const band of bandsOf(compact(items))) {
    const top = Math.min(...band.map((i) => i.y));
    const sideBySide = band.every((a) => band.every((b) => a === b || a.x + a.w <= b.x || b.x + b.w <= a.x));
    const placed = sideBySide ? alignRow(band, kpiCount) : stretchStacks(band, top, kpiCount);
    for (const it of placed) out.push({ ...it, y: y + (sideBySide ? 0 : it.y - top) });
    y += Math.max(...placed.map((i) => (sideBySide ? i.h : i.y - top + i.h)));
  }
  // limites diferentes numa mesma faixa podem deixar um bloco mais baixo: o que está embaixo sobe
  return compact(items.map((i) => out.find((o) => o.id === i.id)!));
}

/** Faixas: grupos de blocos que dividem alguma linha da grade, de cima para baixo. */
function bandsOf(items: PageGrid): LayoutItem[][] {
  const bands: { bottom: number; items: LayoutItem[] }[] = [];
  for (const it of [...items].sort(byPosition)) {
    const last = bands[bands.length - 1];
    if (last && it.y < last.bottom) {
      last.items.push(it);
      last.bottom = Math.max(last.bottom, it.y + it.h);
    } else bands.push({ bottom: it.y + it.h, items: [it] });
  }
  return bands.map((b) => b.items);
}

/** Fileira simples: mesma altura para todos e larguras que somam 12. */
function alignRow(row: LayoutItem[], kpiCount: number): LayoutItem[] {
  const sorted = [...row].sort((a, b) => a.x - b.x);
  const limits = sorted.map((i) => limitsOf(i.id, kpiCount));
  const h = Math.max(...sorted.map((i) => i.h));
  const widths = sorted.map((i) => i.w);
  // As colunas que sobram vão primeiro para os mais estreitos, todos de uma vez (cards iguais
  // continuam iguais); se não dá para o grupo inteiro, a sobra vai para o mais largo.
  let spare = COLS - widths.reduce((a, w) => a + w, 0);
  while (spare > 0) {
    const grow = widths.map((w, i) => ({ i, w })).filter(({ i, w }) => w < limits[i].maxW);
    if (grow.length === 0) break;
    const min = Math.min(...grow.map((g) => g.w));
    const narrow = grow.filter((g) => g.w === min);
    const pick = narrow.length <= spare ? narrow : [[...grow].sort((a, b) => b.w - a.w || a.i - b.i)[0]];
    for (const { i } of pick) widths[i]++;
    spare -= pick.length;
  }
  let x = 0;
  return sorted.map((it, i) => {
    const item = { ...it, x, y: 0, w: widths[i], h: Math.min(h, limits[i].maxH) };
    x += widths[i];
    return item;
  });
}

/** Faixa com blocos empilhados: fica como está; o último de cada pilha desce até o pé da faixa. */
function stretchStacks(band: LayoutItem[], top: number, kpiCount: number): LayoutItem[] {
  const bottom = Math.max(...band.map((i) => i.y + i.h));
  return band.map((it) => {
    const below = band.some((o) => o !== it && o.y >= it.y + it.h && o.x < it.x + it.w && it.x < o.x + o.w);
    if (below) return it;
    return { ...it, h: Math.min(bottom - it.y, limitsOf(it.id, kpiCount).maxH) };
  });
}

// ---- plano -----------------------------------------------------------------------------

/** Mover e redimensionar blocos é do Avançado; abaixo dele, só entram e saem métricas. */
export const canArrangeLayout = (tier: string | null | undefined) => tier === "avancado" || tier === "personalizado";

/** Os cards de plataforma, um a um, no primeiro espaço livre da disposição dada. */
export function withMetricCards(grid: PageGrid, ids: readonly string[]): PageGrid {
  let out = grid;
  for (const id of ids) out = [...out, { id, ...firstFree(out, 3, 4), w: 3, h: 4 }];
  return out;
}

// ---- validação --------------------------------------------------------------------------

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/**
 * Só fica o que a aba aceita (blocos do template e cards de métrica válidos), sem
 * repetir, dentro dos limites e sem sobreposição. Lista vazia = sem nada guardado.
 */
export function normalizeGrid(raw: unknown, allowed: (id: string) => boolean, kpiCount = 4): PageGrid {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: LayoutItem[] = [];
  let metrics = 0;
  for (const r of raw.slice(0, 60)) {
    if (!r || typeof r !== "object") continue;
    const { id, x, y, w, h } = r as Record<string, unknown>;
    if (typeof id !== "string" || seen.has(id) || !allowed(id) || ![x, y, w, h].every(isInt)) continue;
    if (kindOf(id) === "metric" && ++metrics > METRIC_CARDS_MAX) continue;
    seen.add(id);
    items.push(fitLimits({ id, x: x as number, y: Math.min(y as number, 400), w: w as number, h: h as number }, limitsOf(id, kpiCount)));
  }
  // sem sobreposição: cada um desce até achar lugar, na ordem guardada
  const placed: LayoutItem[] = [];
  for (const it of items) {
    let y = it.y;
    while (placed.some((p) => overlaps({ ...it, y }, p))) y++;
    placed.push({ ...it, y });
  }
  return compact(placed);
}

export function parseLayout(raw: unknown): DashboardLayout {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: DashboardLayout = {};
  for (const [page, items] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(items)) out[page as PageId] = items as PageGrid;
  }
  return out;
}

/** Igual ao padrão? (aí não precisa guardar). */
export function sameGrid(a: PageGrid, b: PageGrid): boolean {
  if (a.length !== b.length) return false;
  const key = (i: LayoutItem) => `${i.id}:${i.x}:${i.y}:${i.w}:${i.h}`;
  const sa = new Set(a.map(key));
  return b.every((i) => sa.has(key(i)));
}
