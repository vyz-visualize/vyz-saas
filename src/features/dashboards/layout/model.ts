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

// ---- disposição padrão ------------------------------------------------------------------

/** Os blocos que o template dá a esta aba, com o tamanho padrão de cada um. */
export function templateBlocks(layout: PageLayout): { id: string; w: number; h: number }[] {
  const out: { id: string; w: number; h: number }[] = [];
  if (layout.kpis.length) out.push({ id: KPIS_ID, w: COLS, h: Math.ceil(layout.kpis.length / 4) * 4 });
  layout.widgets.forEach((w, i) => out.push({ id: widgetId(i), w: (w.span ?? 2) * 3, h: WIDGET_H[w.type] }));
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
  return items;
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
