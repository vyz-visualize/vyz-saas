"use client";

// A grade da aba. Fora da edição, só posiciona os blocos. Na edição (todos os planos), cada
// bloco ganha um cabeçalho com o nome, a largura e o botão de ocultar (ou remover, se foi
// somado) e uma linha marca onde cada tela do dashboard termina. No Avançado, ainda: arrasta
// pelo cabeçalho, muda o tamanho pelo canto, aceita blocos soltos do painel lateral e
// responde ao teclado (setas movem; Shift + setas mudam o tamanho). Enquanto um bloco anda,
// os outros abrem espaço e se reencaixam.

import { EyeOff, GripVertical, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useElementSize } from "@/components/charts/useSize";
import { notify } from "@/components/ui/Toast";
import { useMetricEditor } from "../metric-edit-context";
import {
  BLOCKED_TEXT,
  COLS,
  compact,
  constrain,
  GAP,
  GRID_MIN_WIDTH,
  gridRows,
  kindOf,
  limitsOf,
  paginate,
  place,
  readingOrder,
  ROW,
  rowTops,
  screenBreaks,
  widthLabel,
  type Blocked,
  type LayoutItem,
  type PageGrid,
} from "./model";
import { useFitHeight } from "./useFitHeight";
import { ScreenPager, useScreenKeys } from "./ScreenPager";

export type Block = { label: string; node: ReactNode };

/** Tipo do dado arrastado do painel lateral. */
export const DRAG_MIME = "application/x-vyz-block";

type Drag = {
  id: string;
  mode: "move" | "resize";
  px: number;
  py: number;
  orig: LayoutItem;
  base: PageGrid;
  dx: number;
  dy: number;
};

type Props = {
  items: PageGrid;
  blocks: Record<string, Block>;
  editing?: boolean;
  /** Na edição, mover e redimensionar (Avançado). Sem isso, só ocultar e remover. */
  arrange?: boolean;
  kpiCount?: number;
  /** Mudança da disposição (na edição). */
  onChange?: (items: PageGrid) => void;
  onHide?: (id: string) => void;
  /** Bloco solto do painel numa célula. */
  onDropNew?: (id: string, x: number, y: number) => void;
  /** Tamanho que um bloco do painel ocupa (para a sombra de onde ele vai cair). */
  sizeOf?: (id: string) => { w: number; h: number };
  /** A aba aceita este bloco? Sem isso, aceita o que vier da bandeja. */
  canDrop?: (id: string) => boolean;
  /**
   * Encaixa a grade na altura livre da tela (16:9, sem rolar a página): as fileiras ganham a
   * altura que sobra. Na edição, em tela estreita ou quando não cabe, vale a altura padrão.
   */
  fit?: boolean;
  /** Blocos que são só um número (cards): a fileira deles tem altura fixa no encaixe. Padrão: cards de KPI e de métrica. */
  compactBlock?: (id: string) => boolean;
  /** Cada bloco vira contêiner: o conteúdo se arruma pela largura do próprio bloco (@[...]), não pela da página. */
  contain?: boolean;
};

/** Respiro entre o pé da grade e o pé da tela, no encaixe. */
export const FIT_BOTTOM = 16;
/** Na edição, o cabeçalho de cada bloco (nome, largura, ocultar) fica por cima do conteúdo. */
const EDIT_HEADER = 36;
/** Na edição, o respiro onde uma tela nova começa: a linha e o selo ficam nele, sem cobrir nenhum bloco. */
const BREAK_ROOM = 32;

/**
 * Altura das fileiras na edição: a padrão, e as fileiras só de cards ganham a altura do
 * cabeçalho, para o número do card continuar inteiro (os gráficos aguentam a perda).
 */
function editRows(items: PageGrid, rows: number, isCompact: (id: string) => boolean): number[] {
  return Array.from({ length: rows }, (_, r) => {
    const here = items.filter((it) => it.y <= r && r < it.y + it.h);
    if (!here.length || !here.every((it) => isCompact(it.id))) return ROW;
    return ROW + EDIT_HEADER / Math.min(...here.map((it) => it.h));
  });
}
const isCard = (id: string) => kindOf(id) === "kpis" || kindOf(id) === "metric";

export function GridCanvas({
  items,
  blocks,
  editing,
  arrange = true,
  kpiCount = 4,
  onChange,
  onHide,
  onDropNew,
  sizeOf,
  canDrop,
  fit = false,
  compactBlock = isCard,
  contain = false,
}: Props) {
  const blockedRef = useRef<Blocked | null>(null);
  const [ref, size] = useElementSize<HTMLDivElement>();
  const [drag, setDrag] = useState<Drag | null>(null);
  const [incoming, setIncoming] = useState<LayoutItem | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const editor = useMetricEditor();
  const warned = useRef(false);
  // mover e redimensionar só no Avançado; ocultar e remover valem sempre na edição
  const moving = !!editing && arrange;

  const width = size?.width ?? 0;
  const wide = width >= GRID_MIN_WIDTH;
  const unit = (width + GAP) / COLS;
  const rows =
    Math.max(gridRows(items), incoming ? incoming.y + incoming.h : 0) +
    (moving ? 6 : 0);

  // encaixe na tela: cada fileira com a altura que faz a grade terminar no pé da área visível.
  // Não coube com tamanho legível: a aba vira telas (paginate), nunca rolagem.
  // Na edição a grade fica na altura padrão, mas mede a tela do mesmo jeito: marca onde cada tela termina.
  const fitting = fit && wide && !editing;
  const free = useFitHeight(ref, fit && wide, FIT_BOTTOM);
  const pages = fitting && free != null ? paginate(items, free, compactBlock) : null;
  const marks = editing && free != null ? screenBreaks(items, free, compactBlock) : null;
  const screens = marks?.screens ?? null;
  const setScreens = editor?.setScreens;
  useEffect(() => {
    if (!editing || !setScreens) return;
    setScreens(screens);
    return () => setScreens(null);
  }, [editing, screens, setScreens]);
  const [pageAt, setPage] = useState(0);
  const pageIdx = pages ? Math.min(pageAt, pages.length - 1) : 0;
  const screen = pages?.[pageIdx] ?? null;
  const fitted = screen?.heights ?? null;
  const shown = screen?.items ?? items;
  const paged = !!pages && pages.length > 1;
  const tops = fitted ? rowTops(fitted) : editing ? rowTops(editRows(items, rows, compactBlock)) : null;
  // Page Down / Page Up passam de tela (a rodinha do mouse não)
  useScreenKeys(paged, pageIdx, pages?.length ?? 1, setPage);
  // onde cada tela nova começa, a grade da edição abre um respiro (como a quebra de página de um editor de texto)
  const breaks = marks?.breaks ?? [];
  const room = (r: number) => breaks.filter((b) => b <= r).length * BREAK_ROOM;
  const rowTop = (r: number) => (tops ? (tops[Math.min(r, tops.length - 1)] ?? 0) : r * ROW) + room(r);

  const box = (it: Pick<LayoutItem, "x" | "y" | "w" | "h">): CSSProperties => ({
    left: it.x * unit,
    top: rowTop(it.y),
    width: it.w * unit - GAP,
    // um bloco nunca atravessa o começo de uma tela: o respiro abaixo dele não entra na altura
    height: rowTop(it.y + it.h) - (breaks.includes(it.y + it.h) ? BREAK_ROOM : 0) - rowTop(it.y) - GAP,
  });

  // ---- arrastar e redimensionar ---------------------------------------------------------
  const start = (e: PointerEvent, id: string, mode: Drag["mode"]) => {
    if (!editing || e.button !== 0) return;
    if (!arrange) {
      // tentou arrastar fora do Avançado: diz o porquê uma vez, sem parecer travado
      if (!warned.current) notify("Mudar os blocos de lugar e de tamanho é do plano Avançado. Ocultar e adicionar valem no seu plano.");
      warned.current = true;
      return;
    }
    const orig = items.find((i) => i.id === id);
    if (!orig) return;
    e.preventDefault();
    setDrag({
      id,
      mode,
      px: e.clientX,
      py: e.clientY,
      orig,
      base: items,
      dx: 0,
      dy: 0,
    });
  };
  const move = (e: { clientX: number; clientY: number }) => {
    if (!drag) return;
    const dx = e.clientX - drag.px;
    const dy = e.clientY - drag.py;
    const { orig } = drag;
    const wanted =
      drag.mode === "move"
        ? { ...orig, x: orig.x + Math.round(dx / unit), y: orig.y + Math.round(dy / ROW) }
        : { ...orig, w: orig.w + Math.round(dx / unit), h: orig.h + Math.round(dy / ROW) };
    const { item: next, blocked } = constrain(drag.mode, wanted, limitsOf(orig.id, kpiCount));
    // o aviso sai ao soltar, se a pessoa soltou forçando além do limite
    blockedRef.current = blocked;
    setDrag({ ...drag, dx, dy });
    const cur = items.find((i) => i.id === orig.id);
    if (
      cur &&
      cur.x === next.x &&
      cur.y === next.y &&
      cur.w === next.w &&
      cur.h === next.h
    )
      return;
    onChange?.(place(drag.base, next));
  };
  const end = () => {
    if (!drag) return;
    if (blockedRef.current) notify(BLOCKED_TEXT[blockedRef.current]);
    blockedRef.current = null;
    onChange?.(compact(items));
    setFocus(drag.id);
    setDrag(null);
  };

  // O arrasto escuta a janela: enquanto um bloco anda, os outros trocam de lugar no DOM
  // e a captura do ponteiro se perde; ouvindo a janela, soltar fora da grade também encerra.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: globalThis.PointerEvent) => move(e);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  });

  // ---- teclado ------------------------------------------------------------------------
  const key = (e: KeyboardEvent, it: LayoutItem) => {
    if (!arrange) return;
    const d = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[e.key];
    if (!d) {
      if ((e.key === "Delete" || e.key === "Backspace") && onHide) {
        e.preventDefault();
        onHide(it.id);
      }
      return;
    }
    e.preventDefault();
    const wanted = e.shiftKey
      ? { ...it, w: it.w + d[0], h: it.h + d[1] }
      : { ...it, x: it.x + d[0], y: it.y + d[1] * 2 };
    const { item: next, blocked } = constrain(e.shiftKey ? "resize" : "move", wanted, limitsOf(it.id, kpiCount));
    // não saiu do lugar: diz o porquê em vez de parecer travado
    if (blocked && next.x === it.x && next.y === it.y && next.w === it.w && next.h === it.h) return notify(BLOCKED_TEXT[blocked]);
    onChange?.(compact(place(items, next)));
  };

  // ---- soltar do painel -----------------------------------------------------------------
  const cellAt = (e: DragEvent, w: number) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(
      COLS - w,
      Math.max(0, Math.floor((e.clientX - r.left) / unit - w / 2 + 0.5)),
    );
    const y = Math.max(0, Math.floor((e.clientY - r.top) / ROW - 1));
    return { x, y };
  };
  const dragOver = (e: DragEvent) => {
    if (!moving || !e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    const s = sizeOf?.("_incoming") ?? { w: 3, h: 4 };
    const { x, y } = cellAt(e, s.w);
    if (!incoming || incoming.x !== x || incoming.y !== y)
      setIncoming({ id: "_incoming", x, y, ...s });
  };
  const drop = (e: DragEvent) => {
    const id = e.dataTransfer.getData(DRAG_MIME);
    setIncoming(null);
    if (!moving || !id) return;
    e.preventDefault();
    if (items.some((i) => i.id === id)) return notify("Este bloco já está na grade.");
    if (canDrop && !canDrop(id)) return notify("Este componente não entra nesta aba.");
    const s = sizeOf?.(id) ?? { w: 3, h: 4 };
    const { x, y } = cellAt(e, s.w);
    onDropNew?.(id, x, y);
  };

  // tela estreita (ou ainda medindo): uma coluna, na ordem da disposição
  // o mesmo contêiner medido nos dois modos (a medida não pode perder o elemento)
  return (
    // data-edit-anchor: a barra e a bandeja do Personalizar se alinham com estas bordas e usam estas cores
    <div ref={ref} data-edit-anchor="" data-fit-on={fitted ? "" : undefined}>
      {!wide ? (
        <div className="space-y-2">
          {readingOrder(items).map((it) => (
            <div key={it.id} className={contain ? "@container min-w-0" : "min-w-0"}>
              {blocks[it.id]?.node}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="relative"
          style={{ height: rowTop(tops ? tops.length - 1 : rows) - GAP }}
          onDragOver={dragOver}
          onDragLeave={(e) => {
            if (
              !(e.currentTarget as HTMLElement).contains(
                e.relatedTarget as Node,
              )
            )
              setIncoming(null);
          }}
          onDrop={drop}
        >
          {moving && <Cells cols={COLS} rows={rows} unit={unit} rowTop={rowTop} />}
          {/* onde cada tela do dashboard começa: o que fica abaixo da linha vai para a tela seguinte */}
          {marks?.breaks.map((y, i) => (
            <div key={y} data-screen-break aria-hidden className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: rowTop(y) - BREAK_ROOM / 2 - GAP / 2 - 1 }}>
              <span className="h-0 flex-1 border-t-2 border-dashed border-accent/80" />
              <span className="mx-2 shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-on-accent shadow-sm">
                Tela {i + 2} começa aqui
              </span>
              <span className="h-0 flex-1 border-t-2 border-dashed border-accent/80" />
            </div>
          ))}
          {incoming && (
            <div
              className="pointer-events-none absolute rounded-[12px] border-2 border-dashed border-accent bg-accent/10 transition-all duration-150"
              style={box(incoming)}
            />
          )}

          {shown.map((it) => {
            const block = blocks[it.id];
            if (!block) return null;
            const active = drag?.id === it.id;
            const lit = editor?.highlight === it.id;
            // somado pela pessoa (card de plataforma, bloco pedido): sai de vez; do modelo: fica oculto e volta pelo painel
            const added = kindOf(it.id) === "metric" || kindOf(it.id) === "custom";
            // o bloco arrastado segue o ponteiro; a sombra mostra onde ele vai encaixar
            const follow: CSSProperties | undefined = active
              ? drag.mode === "move"
                ? {
                    ...box(drag.orig),
                    transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.015)`,
                    zIndex: 30,
                    transition: "none",
                  }
                : {
                    ...box({ ...drag.orig, w: it.w, h: it.h }),
                    width: Math.max(
                      box(it).width as number,
                      drag.orig.w * unit - GAP + drag.dx,
                    ),
                    height: Math.max(
                      box(it).height as number,
                      drag.orig.h * ROW - GAP + drag.dy,
                    ),
                    zIndex: 30,
                    transition: "none",
                  }
              : undefined;
            return (
              <div key={it.id}>
                {active && (
                  <div
                    className="pointer-events-none absolute rounded-[12px] border-2 border-dashed border-accent bg-accent/10"
                    style={box(it)}
                  />
                )}
                <div
                  data-block={it.id}
                  onPointerEnter={editing && editor ? () => editor.setHighlight(it.id) : undefined}
                  onPointerLeave={editing && editor ? () => editor.setHighlight(null) : undefined}
                  className={`@container/block absolute min-w-0 transition-[left,top,width,height,transform,box-shadow] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
                    editing
                      ? `overflow-hidden rounded-[12px] bg-card ${active ? "shadow-[0_24px_60px_-12px_rgba(0,0,0,.45)] ring-2 ring-accent" : focus === it.id || lit ? "ring-2 ring-accent" : "ring-1 ring-line"}`
                      : ""
                  }`}
                  style={follow ?? box(it)}
                >
                  {/* na edição o conteúdo desce para o cabeçalho de arrastar; os cards de KPI seguem
                      clicáveis (o ✕ e os encaixes do Personalizar), o resto fica só de vitrine */}
                  {/* nas colunas das tabelas, o ✕ do cabeçalho delas também precisa do clique */}
                  <div
                    inert={(editing && it.id !== "kpis" && editor?.section !== "columns") || undefined}
                    className={`overflow-x-hidden overflow-y-auto [scrollbar-width:thin] [&>*]:min-h-full ${contain ? "@container" : ""} ${editing ? `absolute inset-x-0 top-9 bottom-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${it.id === "kpis" ? "px-1 pb-1" : editor?.section === "columns" ? "" : "pointer-events-none select-none"}` : "h-full"}`}
                  >
                    {block.node}
                  </div>
                  {editing && (
                    <>
                      <div
                        role={moving ? "button" : undefined}
                        tabIndex={moving ? 0 : undefined}
                        aria-label={moving ? `${block.label}: arraste para mover. Setas movem, Shift e setas mudam o tamanho, Delete oculta.` : undefined}
                        onPointerDown={(e) => start(e, it.id, "move")}
                        onKeyDown={(e) => key(e, it)}
                        onFocus={() => setFocus(it.id)}
                        className={`absolute inset-x-0 top-0 flex h-9 items-center gap-1.5 rounded-t-[12px] border-b border-line px-2 text-fg text-[12px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent ${lit ? "bg-accent-soft" : "bg-card"} ${moving ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
                      >
                        {moving && <GripVertical size={14} className="shrink-0 text-fg-2" aria-hidden />}
                        <span className="min-w-0 truncate">{block.label}</span>
                        <span title={`Largura: ${widthLabel(it.w)}`} className="ml-auto hidden shrink-0 rounded-full border border-line px-1.5 py-px text-[10.5px] font-medium text-fg-2 @[260px]/block:inline">
                          {widthLabel(it.w)}
                        </span>
                        {onHide && (
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            aria-label={`${added ? "Remover" : "Ocultar"} ${block.label}`}
                            title={items.length <= 1 ? "A aba precisa de pelo menos um bloco" : added ? "Remover da aba" : "Ocultar (volta pelo painel)"}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => onHide(it.id)}
                            className="ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px] font-medium text-fg-2 outline-none hover:bg-error-soft hover:text-error-fg focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-35 @[260px]/block:ml-0"
                          >
                            {added ? <X size={13} aria-hidden /> : <EyeOff size={13} aria-hidden />}
                            <span className="hidden @[200px]/block:inline">{added ? "Remover" : "Ocultar"}</span>
                          </button>
                        )}
                      </div>
                      {moving && (
                        <div
                          aria-hidden
                          title="Arraste para mudar o tamanho"
                          onPointerDown={(e) => start(e, it.id, "resize")}
                          className="absolute right-0 bottom-0 grid size-6 cursor-nwse-resize touch-none place-items-center rounded-br-[12px] rounded-tl-[8px] bg-accent text-on-accent"
                        >
                          <svg viewBox="0 0 10 10" className="size-2.5">
                            <path
                              d="M9 1 1 9M9 5 5 9"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {paged && wide && <ScreenPager count={pages.length} index={pageIdx} onChange={setPage} labels={pages.map((p) => p.items.filter((i) => !compactBlock(i.id)).map((i) => blocks[i.id]?.label ?? "").filter(Boolean))} />}
    </div>
  );
}

/** As casinhas da grade, visíveis só na edição do Avançado (onde os blocos podem encaixar), uma a cada duas fileiras. */
function Cells({ cols, rows, unit, rowTop }: { cols: number; rows: number; unit: number; rowTop: (r: number) => number }) {
  const cells: { key: string; style: CSSProperties }[] = [];
  for (let r = 0; r < rows; r += 2) {
    const top = rowTop(r);
    const height = rowTop(Math.min(r + 2, rows)) - top - GAP;
    for (let c = 0; c < cols; c++) cells.push({ key: `${r}-${c}`, style: { left: c * unit, top, width: unit - GAP, height } });
  }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {cells.map((c) => (
        <span key={c.key} className="absolute rounded-[8px] bg-[color-mix(in_srgb,currentColor_7%,transparent)]" style={c.style} />
      ))}
    </div>
  );
}
