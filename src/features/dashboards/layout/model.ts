// Disposição de cada aba do dashboard numa grade de 12 colunas. O modelo vem do
// template (os blocos que a aba tem); a pessoa move, redimensiona, esconde e traz
// de volta esses blocos e soma cards de métrica por plataforma. Funções puras: o
// painel, o servidor (validação) e os testes usam as mesmas.

import type { PageId, PageLayout, WidgetSpec } from "@/features/templates/types";
import { cleanTitle, CUSTOM_BLOCKS_MAX, isCustomId } from "./custom-blocks";

export const COLS = 12;
/** Altura de uma linha da grade, em px. */
export const ROW = 28;
export const GAP = 8;
/** Abaixo disso, a grade vira uma coluna (na ordem da disposição) e não edita. */
export const GRID_MIN_WIDTH = 720;
/** Cards de métrica por plataforma que cabem numa aba. */
export const METRIC_CARDS_MAX = 12;

/** Altura (linhas) da fileira de cards de KPI: uma fileira só, qualquer que seja a quantidade. */
export const KPI_ROWS = 4;

export type LayoutItem = { id: string; x: number; y: number; w: number; h: number; /** Nome que a pessoa deu ao bloco pedido (só blocos c:). */ title?: string };
export type PageGrid = LayoutItem[];
/** O que o banco guarda (dashboards.layout): só as abas mexidas. */
export type DashboardLayout = Partial<Record<PageId, PageGrid>>;

export type BlockKind = "kpis" | "widget" | "metric" | "skin" | "custom";
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
  if (isCustomId(id)) return "custom";
  return id.startsWith("m:") ? "metric" : "widget";
}

// ---- tamanhos ---------------------------------------------------------------------------

/** Altura padrão (linhas) de cada tipo de bloco do template. */
const WIDGET_H: Record<WidgetSpec["type"], number> = {
  line: 10,
  trend: 12,
  ranking: 12,
  rank: 11,
  breakdown: 11,
  searchTerms: 14,
  videos: 11,
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- a quantidade de cards já não muda a altura (fileira única); fica na assinatura dos chamadores
export function limitsOf(id: string, kpiCount = 4): Limits {
  const kind = kindOf(id);
  // os cards ficam numa fileira só (a fileira rola de lado quando não cabem): 4 linhas bastam
  // (disposições antigas, com a fileira mais alta, voltam para esta altura ao abrir)
  if (kind === "kpis") return { minW: 6, maxW: COLS, minH: KPI_ROWS, maxH: KPI_ROWS };
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
  if (layout.kpis.length) out.push({ id: KPIS_ID, w: COLS, h: KPI_ROWS });
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
/** Os gráficos ficam com pelo menos isto por fileira antes de os cards voltarem à altura cheia (ROW). Acima de FIT_MIN_ROW: os cards cedem antes de a aba virar telas. */
export const FIT_COMFORT_ROW = 24;
/** Abaixo disso os gráficos ficam ilegíveis: a grade desiste de caber e a página volta a rolar. */
export const FIT_MIN_ROW = 22;

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

// ---- telas (paginação no encaixe) --------------------------------------------------------
//
// O dashboard nunca rola: quando os blocos da aba não cabem na altura da tela com um tamanho
// legível (FIT_MIN_ROW), a aba vira telas. A faixa de cards do topo fica em todas; as outras
// faixas (blocos lado a lado) entram em ordem até a tela encher. Tela alta: tudo numa só;
// notebook baixo: duas ou três. Vale também para a disposição personalizada.

/** Altura da barra das telas (setas e nomes), descontada da altura livre quando há mais de uma. */
export const PAGER_H = 54;

export type FitPage = { items: PageGrid; heights: number[] };

/** As faixas empilhadas sem buraco, na ordem dada (y recomeça do zero). */
function stack(bands: readonly LayoutItem[][]): PageGrid {
  const out: LayoutItem[] = [];
  let y = 0;
  for (const band of bands) {
    const top = Math.min(...band.map((i) => i.y));
    const bottom = Math.max(...band.map((i) => i.y + i.h));
    for (const it of band) out.push({ ...it, y: y + it.y - top });
    y += bottom - top;
  }
  return out;
}

/** Fileiras quando nem uma faixa sozinha cabe no mínimo: divide o que há, sem piso. */
function squeezeRows(items: PageGrid, height: number, isCompact: (id: string) => boolean): number[] {
  const rows = gridRows(items);
  const total = height + GAP;
  const compactRow = Array.from({ length: rows }, (_, r) => {
    const here = items.filter((it) => it.y <= r && r < it.y + it.h);
    return here.length > 0 && here.every((it) => isCompact(it.id));
  });
  const fixed = compactRow.filter(Boolean).length;
  const card = fixed ? FIT_COMPACT_MIN : 0;
  const rest = Math.max(4, (total - fixed * card) / Math.max(1, rows - fixed));
  return compactRow.map((c) => (c ? card : rest));
}

/**
 * As telas da aba para a altura livre `height` (px). Uma tela só quando tudo cabe; senão, a
 * faixa de cards do topo (se a primeira faixa for só de cards) repete em cada tela e as outras
 * faixas se dividem em ordem. Cada tela já vem com a altura de cada fileira.
 */
export function paginate(items: PageGrid, height: number, isCompact: (id: string) => boolean): FitPage[] | null {
  if (!items.length || !(height > 0)) return null;
  const all = compact(items);
  const whole = fitRows(all, height, isCompact);
  if (whole) return [{ items: all, heights: whole }];
  const room = height - PAGER_H;
  const bands = bandsOf(all);
  const pinned = bands[0]?.every((i) => isCompact(i.id)) ? bands[0] : null;
  const rest = pinned ? bands.slice(1) : bands;
  if (!rest.length) return [{ items: all, heights: squeezeRows(all, height, isCompact) }];
  const pages: LayoutItem[][][] = [];
  let cur: LayoutItem[][] = [];
  for (const band of rest) {
    const next = [...cur, band];
    if (!cur.length || fitRows(stack(pinned ? [pinned, ...next] : next), room, isCompact)) cur = next;
    else {
      pages.push(cur);
      cur = [band];
    }
  }
  if (cur.length) pages.push(cur);
  return pages.map((p) => {
    const grid = stack(pinned ? [pinned, ...p] : p);
    return { items: grid, heights: fitRows(grid, room, isCompact) ?? squeezeRows(grid, room, isCompact) };
  });
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

// ---- ocultar e telas (o Personalizar) ----------------------------------------------------

/**
 * Ocultar um bloco no Personalizar: o vizinho da mesma fileira (o da esquerda; sem ele, o da
 * direita) cresce e ocupa o espaço, até onde o limite dele deixa. Sem vizinho que caiba, a
 * grade fecha o buraco por baixo. Vale nos dois planos: no Avançado é a disposição da pessoa,
 * fora dele é a do modelo sem os blocos ocultos (fixedGrid).
 */
export function hideBlock(items: PageGrid, id: string, kpiCount = 4): PageGrid {
  const gone = items.find((i) => i.id === id);
  if (!gone) return items;
  const out = items.filter((i) => i.id !== id).map((i) => ({ ...i }));
  const sameRow = (it: LayoutItem) => it.y <= gone.y && it.y + it.h >= gone.y + gone.h;
  const fits = (it: LayoutItem) => it.w + gone.w <= limitsOf(it.id, kpiCount).maxW;
  const left = out.find((it) => sameRow(it) && it.x + it.w === gone.x && fits(it));
  const right = left ? undefined : out.find((it) => sameRow(it) && it.x === gone.x + gone.w && fits(it));
  if (left) left.w += gone.w;
  else if (right) {
    right.x = gone.x;
    right.w += gone.w;
  }
  return compact(out);
}

/**
 * Fora do Avançado não se muda nada de lugar nem de tamanho: a disposição é a do modelo, sem
 * os blocos que a pessoa ocultou (o vizinho ocupa o espaço) e com os blocos somados (cards de
 * plataforma e blocos pedidos), cada um no primeiro espaço livre. Painel e servidor usam esta.
 */
export function fixedGrid(base: PageGrid, items: PageGrid, kpiCount = 4): PageGrid {
  const on = new Set(items.map((i) => i.id));
  let out = base;
  for (const b of base) if (!on.has(b.id)) out = hideBlock(out, b.id, kpiCount);
  const added = items.filter((i) => !base.some((b) => b.id === i.id) && (kindOf(i.id) === "metric" || kindOf(i.id) === "custom"));
  return withAddedBlocks(out, added);
}

/** A largura do bloco em palavras (o Personalizar mostra isto, não colunas). */
const WIDTH_LABEL: Record<number, string> = { 12: "Inteira", 9: "3/4", 8: "2/3", 6: "Metade", 4: "1/3", 3: "1/4", 2: "1/6" };
export const widthLabel = (w: number) => WIDTH_LABEL[w] ?? `${w}/12`;

/**
 * Quantas telas a aba vira no dashboard (ele nunca rola: o que não cabe vai para a tela
 * seguinte) e em que fileira da grade cada tela nova começa, para o Personalizar marcar.
 * A faixa de cards do topo repete em todas as telas e não conta como começo de tela.
 */
export function screenBreaks(items: PageGrid, height: number, isCompact: (id: string) => boolean): { screens: number; breaks: number[] } | null {
  const pages = paginate(items, height, isCompact);
  if (!pages) return null;
  if (pages.length < 2) return { screens: 1, breaks: [] };
  const pinned = new Set(pages[0].items.filter((i) => pages[1].items.some((o) => o.id === i.id)).map((i) => i.id));
  const breaks = pages.slice(1).map((p) => Math.min(...p.items.filter((i) => !pinned.has(i.id)).map((i) => items.find((o) => o.id === i.id)?.y ?? Infinity)));
  return { screens: pages.length, breaks: breaks.filter(Number.isFinite) };
}

/**
 * Tira da grade os blocos sem nada para mostrar (com dados reais, nenhum bloco aparece vazio)
 * e passa o espaço ao vizinho da mesma fileira: o da esquerda cresce para a direita; sem ele,
 * o da direita cresce para a esquerda. Sem vizinho na fileira, a grade fecha o buraco por baixo.
 * Não muda o layout salvo: é só o que a tela desenha.
 */
export function withoutBlocks(items: PageGrid, hidden: readonly string[]): PageGrid {
  if (!hidden.length) return items;
  let out = items.map((it) => ({ ...it }));
  for (const id of hidden) {
    const gone = out.find((it) => it.id === id);
    if (!gone) continue;
    out = out.filter((it) => it.id !== id);
    // mesma fileira: cobre toda a altura do bloco que saiu
    const sameRow = (it: (typeof out)[number]) => it.y <= gone.y && it.y + it.h >= gone.y + gone.h;
    const left = out.find((it) => sameRow(it) && it.x + it.w === gone.x);
    const right = out.find((it) => sameRow(it) && it.x === gone.x + gone.w);
    if (left) left.w += gone.w;
    else if (right) {
      right.x = gone.x;
      right.w += gone.w;
    } else if (!out.some((it) => it.y < gone.y + gone.h && it.y + it.h > gone.y)) {
      // ocupava a fileira sozinho: os blocos de baixo sobem, sem deixar o buraco
      for (const it of out) if (it.y >= gone.y + gone.h) it.y -= gone.h;
    }
  }
  return out;
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

/** Fora do Avançado: os cards de plataforma e os blocos pedidos entram, cada um no primeiro espaço livre, com o tamanho dele. */
export function withAddedBlocks(grid: PageGrid, items: readonly LayoutItem[]): PageGrid {
  let out = grid;
  for (const it of items) out = [...out, { ...it, ...firstFree(out, it.w, it.h) }];
  return out;
}

/**
 * Blocos pedidos entram logo abaixo da fileira de cards (o que a pessoa pediu fica à vista),
 * lado a lado enquanto couberem; o resto da aba desce.
 */
export function insertBlocks(grid: PageGrid, blocks: readonly LayoutItem[]): PageGrid {
  const fresh = blocks.filter((b) => !grid.some((i) => i.id === b.id));
  if (!fresh.length) return grid;
  const kpis = grid.find((i) => i.id === KPIS_ID);
  const top = kpis ? kpis.y + kpis.h : 0;
  const placed: LayoutItem[] = [];
  let x = 0;
  let y = top;
  let rowH = 0;
  for (const b of fresh) {
    if (x + b.w > COLS) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    placed.push({ ...b, x, y });
    x += b.w;
    rowH = Math.max(rowH, b.h);
  }
  const added = y + rowH - top;
  const moved = grid.map((i) => (i.y >= top ? { ...i, y: i.y + added } : i));
  return compact([...moved, ...placed]);
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
  let custom = 0;
  for (const r of raw.slice(0, 60)) {
    if (!r || typeof r !== "object") continue;
    const { id, x, y, w, h, title } = r as Record<string, unknown>;
    if (typeof id !== "string" || seen.has(id) || !allowed(id) || ![x, y, w, h].every(isInt)) continue;
    if (kindOf(id) === "metric" && ++metrics > METRIC_CARDS_MAX) continue;
    if (kindOf(id) === "custom" && ++custom > CUSTOM_BLOCKS_MAX) continue;
    seen.add(id);
    const name = kindOf(id) === "custom" ? cleanTitle(title) : undefined;
    items.push(fitLimits({ id, x: x as number, y: Math.min(y as number, 400), w: w as number, h: h as number, ...(name ? { title: name } : {}) }, limitsOf(id, kpiCount)));
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
  const key = (i: LayoutItem) => `${i.id}:${i.x}:${i.y}:${i.w}:${i.h}:${i.title ?? ""}`;
  const sa = new Set(a.map(key));
  return b.every((i) => sa.has(key(i)));
}
