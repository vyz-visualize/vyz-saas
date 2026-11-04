"use client";

// Quantos itens cabem numa linha sem quebrar nem rolar; o resto vai para um menu.
// Os itens ficam sempre no DOM (os que não cabem, invisíveis e fora do fluxo),
// e é daí que sai a largura de cada um: sem cópias para medir.

import { useLayoutEffect, useRef, useState, type DependencyList } from "react";

type FitOptions = {
  gap: number;
  /** O menu aparece mesmo com tudo cabendo (reserva o lugar dele). */
  always?: boolean;
  /** Item que nunca vai para o menu (a aba aberta). */
  pinned?: number;
};

/** Índices visíveis, na ordem original. Sai primeiro o que está mais no fim. */
export function fitItems(widths: readonly number[], available: number, more: number, { gap, always = false, pinned }: FitOptions): number[] {
  const all = widths.map((_, i) => i);
  const total = widths.reduce((a, w) => a + w, 0) + gap * Math.max(0, widths.length - 1);
  if (!always && total <= available) return all;
  const room = available - more - gap;
  const order = pinned !== undefined && pinned >= 0 && pinned < widths.length ? [pinned, ...all.filter((i) => i !== pinned)] : all;
  const out: number[] = [];
  let used = 0;
  for (const i of order) {
    const next = used + widths[i] + (out.length ? gap : 0);
    // a aba aberta fica mesmo sem espaço: sumir com ela esconderia onde a pessoa está
    if (next > room && i !== pinned) break;
    out.push(i);
    used = next;
  }
  return out.sort((a, b) => a - b);
}

type UseFit = FitOptions & {
  count: number;
  /** Espaço disponível a partir da largura medida (padrão: toda). */
  available?: (width: number) => number;
  /** Mede o elemento pai, quando a linha divide espaço com outra coisa. */
  measureParent?: boolean;
  /** Mudanças que alteram a largura dos itens (texto de "Preparando…"). */
  deps?: DependencyList;
};

export function useFitItems({ count, gap, always, pinned, available, measureParent, deps = [] }: UseFit) {
  const rootRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLElement>(null);
  const items = useRef<(HTMLElement | null)[]>([]);
  const [visible, setVisible] = useState<number[]>(() => Array.from({ length: count }, (_, i) => i));
  const availableRef = useRef(available);

  useLayoutEffect(() => {
    availableRef.current = available;
  });

  useLayoutEffect(() => {
    const root = rootRef.current;
    const box = measureParent ? root?.parentElement : root;
    if (!root || !box) return;
    const measure = () => {
      const width = box.clientWidth;
      if (!width) return;
      const widths = Array.from({ length: count }, (_, i) => items.current[i]?.offsetWidth ?? 0);
      const next = fitItems(widths, availableRef.current ? availableRef.current(width) : width, moreRef.current?.offsetWidth ?? 0, { gap, always, pinned });
      setVisible((v) => (v.length === next.length && v.every((x, i) => x === next[i]) ? v : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps: o que muda a largura dos itens
  }, [count, gap, always, pinned, measureParent, ...deps]);

  const itemRef = (i: number) => (el: HTMLElement | null) => {
    items.current[i] = el;
  };
  return { rootRef, moreRef, itemRef, visible };
}

/** Classes do item que não coube: continua medível, mas não aparece nem recebe foco. */
export const FIT_HIDDEN = "invisible absolute top-0 left-0";
