"use client";

// A grade da aba. Fora da edição, só posiciona os blocos. Na edição: arrasta pelo
// cabeçalho, muda o tamanho pelo canto, aceita blocos soltos do painel lateral e
// responde ao teclado (setas movem; Shift + setas mudam o tamanho). Enquanto um
// bloco anda, os outros abrem espaço e se reencaixam.

import { EyeOff, GripVertical } from "lucide-react";
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
import {
  BLOCKED_TEXT,
  COLS,
  compact,
  constrain,
  fitRows,
  GAP,
  GRID_MIN_WIDTH,
  gridRows,
  kindOf,
  limitsOf,
  place,
  readingOrder,
  ROW,
  rowTops,
  type Blocked,
  type LayoutItem,
  type PageGrid,
} from "./model";
import { useFitHeight } from "./useFitHeight";

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
const isCard = (id: string) => kindOf(id) === "kpis" || kindOf(id) === "metric";

export function GridCanvas({
  items,
  blocks,
  editing,
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

  const width = size?.width ?? 0;
  const wide = width >= GRID_MIN_WIDTH;
  const unit = (width + GAP) / COLS;
  const rows =
    Math.max(gridRows(items), incoming ? incoming.y + incoming.h : 0) +
    (editing ? 6 : 0);

  // encaixe na tela: cada fileira com a altura que faz a grade terminar no pé da área visível
  const fitting = fit && wide && !editing;
  const free = useFitHeight(ref, fitting, FIT_BOTTOM);
  const fitted = fitting && free != null ? fitRows(items, free, compactBlock) : null;
  const tops = fitted ? rowTops(fitted) : null;
  const rowTop = (r: number) => (tops ? (tops[Math.min(r, tops.length - 1)] ?? 0) : r * ROW);

  const box = (it: Pick<LayoutItem, "x" | "y" | "w" | "h">): CSSProperties => ({
    left: it.x * unit,
    top: rowTop(it.y),
    width: it.w * unit - GAP,
    height: rowTop(it.y + it.h) - rowTop(it.y) - GAP,
  });

  // ---- arrastar e redimensionar ---------------------------------------------------------
  const start = (e: PointerEvent, id: string, mode: Drag["mode"]) => {
    if (!editing || e.button !== 0) return;
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
    if (!editing || !e.dataTransfer.types.includes(DRAG_MIME)) return;
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
    if (!editing || !id) return;
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
          style={{ height: tops ? tops[tops.length - 1] - GAP : rows * ROW }}
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
          {editing && <Cells cols={COLS} rows={rows} unit={unit} />}
          {incoming && (
            <div
              className="pointer-events-none absolute rounded-[12px] border-2 border-dashed border-accent bg-accent/10 transition-all duration-150"
              style={box(incoming)}
            />
          )}

          {items.map((it) => {
            const block = blocks[it.id];
            if (!block) return null;
            const active = drag?.id === it.id;
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
                  className={`absolute min-w-0 transition-[left,top,width,height,transform,box-shadow] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
                    editing
                      ? `overflow-hidden rounded-[12px] bg-card ${active ? "shadow-[0_24px_60px_-12px_rgba(0,0,0,.45)] ring-2 ring-accent" : focus === it.id ? "ring-2 ring-accent" : "ring-1 ring-line hover:ring-accent/70"}`
                      : ""
                  }`}
                  style={follow ?? box(it)}
                >
                  {/* na edição o conteúdo desce para o cabeçalho de arrastar; os cards de KPI seguem
                      clicáveis (o ✕ e os encaixes do Personalizar), o resto fica só de vitrine */}
                  <div
                    inert={(editing && it.id !== "kpis") || undefined}
                    className={`overflow-x-hidden overflow-y-auto [scrollbar-width:thin] [&>*]:min-h-full ${contain ? "@container" : ""} ${editing ? `absolute inset-x-0 top-9 bottom-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${it.id === "kpis" ? "px-1 pb-1" : "pointer-events-none select-none"}` : "h-full"}`}
                  >
                    {block.node}
                  </div>
                  {editing && (
                    <>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label={`${block.label}: arraste para mover. Setas movem, Shift e setas mudam o tamanho, Delete esconde.`}
                        onPointerDown={(e) => start(e, it.id, "move")}
                        onKeyDown={(e) => key(e, it)}
                        onFocus={() => setFocus(it.id)}
                        className="absolute inset-x-0 top-0 flex h-9 cursor-grab touch-none items-center gap-1.5 rounded-t-[12px] border-b border-line bg-card px-2 text-fg text-[11.5px] font-semibold outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <GripVertical
                          size={14}
                          className="text-fg-2"
                          aria-hidden
                        />
                        <span className="truncate">{block.label}</span>
                        <span className="ml-auto rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-fg tnum">
                          {it.w} × {it.h}
                        </span>
                        {onHide && (
                          <button
                            type="button"
                            aria-label={`Esconder ${block.label}`}
                            title="Esconder (volta pelo painel)"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => onHide(it.id)}
                            className="grid size-6 place-items-center rounded-full text-fg-2 hover:bg-error-soft hover:text-error-fg"
                          >
                            <EyeOff size={13} />
                          </button>
                        )}
                      </div>
                      <div
                        aria-hidden
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
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** As casinhas da grade, visíveis só na edição (onde os blocos podem encaixar). */
function Cells({
  cols,
  rows,
  unit,
}: {
  cols: number;
  rows: number;
  unit: number;
}) {
  const cellRows = Math.ceil(rows / 2);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${unit - GAP}px)`,
        gridAutoRows: `${ROW * 2 - GAP}px`,
        gap: GAP,
      }}
    >
      {Array.from({ length: cols * cellRows }, (_, i) => (
        <span key={i} className="rounded-[8px] bg-[color-mix(in_srgb,currentColor_7%,transparent)]" />
      ))}
    </div>
  );
}
