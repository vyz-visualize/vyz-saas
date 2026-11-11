"use client";

// Botão flutuante que a pessoa arrasta para onde quiser: guarda o deslocamento a partir
// do canto padrão (localStorage, por navegador), mantém o botão inteiro dentro da tela e
// separa arrastar de clicar (um arrasto não abre o assistente).

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type Offset = { x: number; y: number };

/** Distância (px) a partir da qual o gesto vira arrasto, não clique. */
export const DRAG_THRESHOLD = 4;
const MARGIN = 8;

/** Ajusta o deslocamento para o retângulo (no lugar padrão + deslocamento) caber na tela. */
export function clampOffset(o: Offset, base: { left: number; top: number; width: number; height: number }, view: { width: number; height: number }): Offset {
  const minX = MARGIN - base.left;
  const maxX = view.width - MARGIN - base.width - base.left;
  const minY = MARGIN - base.top;
  const maxY = view.height - MARGIN - base.height - base.top;
  return {
    x: Math.round(Math.min(Math.max(o.x, minX), Math.max(minX, maxX))),
    y: Math.round(Math.min(Math.max(o.y, minY), Math.max(minY, maxY))),
  };
}

function read(key: string): Offset {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "null") as Offset | null;
    if (v && Number.isFinite(v.x) && Number.isFinite(v.y)) return { x: v.x, y: v.y };
  } catch {
    // sem armazenamento (aba anônima, bloqueio): fica no lugar padrão
  }
  return { x: 0, y: 0 };
}

export function useDragOffset(key: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ px: number; py: number; o: Offset; moved: boolean } | null>(null);
  const moved = useRef(false);

  // posição do elemento sem o deslocamento (o lugar padrão no canto)
  const base = useCallback((o: Offset) => {
    const r = ref.current?.getBoundingClientRect();
    return r ? { left: r.left - o.x, top: r.top - o.y, width: r.width, height: r.height } : null;
  }, []);

  const fit = useCallback(
    (o: Offset, from: Offset) => {
      const b = base(from);
      return b ? clampOffset(o, b, { width: window.innerWidth, height: window.innerHeight }) : o;
    },
    [base],
  );

  // lê o lugar salvo depois de montar (o servidor não conhece o localStorage) e mantém na tela ao redimensionar
  useEffect(() => {
    const saved = read(key);
    const id = requestAnimationFrame(() => setOffset(fit(saved, { x: 0, y: 0 })));
    const onResize = () => setOffset((o) => fit(o, o));
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
    };
  }, [key, fit]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    start.current = { px: e.clientX, py: e.clientY, o: offset, moved: false };
    moved.current = false;
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.px;
    const dy = e.clientY - s.py;
    if (!s.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!s.moved) {
      s.moved = true;
      moved.current = true;
      setDragging(true);
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
    setOffset(fit({ x: s.o.x + dx, y: s.o.y + dy }, offset));
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    if (!s?.moved) return;
    setDragging(false);
    setOffset((o) => {
      try {
        localStorage.setItem(key, JSON.stringify(o));
      } catch {
        // sem armazenamento: vale só nesta visita
      }
      return o;
    });
  };
  /** O clique que encerra um arrasto não conta. */
  const wasDrag = () => {
    const d = moved.current;
    moved.current = false;
    return d;
  };

  return {
    ref,
    offset,
    dragging,
    wasDrag,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
