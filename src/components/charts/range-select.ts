"use client";

// Selecionar dias num gráfico: com o mouse, arrastar marca um trecho e clicar marca um
// dia; no toque, só tocar marca um dia (arrastar continua rolando a página); no teclado,
// Enter marca o dia e Shift + setas estendem o trecho.

import { useRef, useState, type PointerEvent } from "react";

export type IndexRange = { from: number; to: number };

const ordered = (a: number, b: number): IndexRange => ({ from: Math.min(a, b), to: Math.max(a, b) });
/** Mais que isso, o dedo estava rolando. */
const TAP_SLOP = 10;

export function useRangeSelect(n: number, onSelect?: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const tap = useRef<{ x: number; y: number } | null>(null);

  const cancel = () => {
    setDrag(null);
    tap.current = null;
  };

  return {
    preview: drag ? ordered(drag.a, drag.b) : null,
    cancel,
    down(e: PointerEvent<SVGSVGElement>, i: number | null) {
      if (!onSelect || i == null || e.button !== 0) return;
      if (e.pointerType === "mouse") {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setDrag({ a: i, b: i });
      } else tap.current = { x: e.clientX, y: e.clientY };
    },
    move(i: number | null) {
      if (i != null) setDrag((d) => (d ? { ...d, b: i } : d));
    },
    up(e: PointerEvent<SVGSVGElement>, i: number | null) {
      if (!onSelect) return;
      if (drag) {
        const r = ordered(drag.a, i ?? drag.b);
        setDrag(null);
        onSelect(Math.min(r.from, n - 1), Math.min(r.to, n - 1));
        return;
      }
      const start = tap.current;
      tap.current = null;
      if (start && i != null && Math.hypot(e.clientX - start.x, e.clientY - start.y) < TAP_SLOP) onSelect(i, i);
    },
    keyMove(from: number, to: number, extend: boolean) {
      if (!onSelect) return;
      if (extend) setDrag((d) => (d ? { ...d, b: to } : { a: from, b: to }));
      else setDrag(null);
    },
    keyCommit(i: number) {
      if (!onSelect) return;
      const r = drag ? ordered(drag.a, drag.b) : { from: i, to: i };
      setDrag(null);
      onSelect(r.from, r.to);
    },
  };
}
