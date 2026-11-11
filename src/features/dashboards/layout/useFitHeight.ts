"use client";

// Altura livre da tela para a grade: do topo dela até o pé da área visível, menos o respiro
// de baixo. Vale para a tela do dashboard no painel (a área que rola é o .shell-content) e,
// sem área própria, para a janela. Refaz a conta quando a janela muda ou quando algo acima
// da grade muda de altura (filtros ativos, controles que quebram de linha).

import { useLayoutEffect, useState, type RefObject } from "react";

function scroller(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === "auto" || o === "scroll") && n.clientHeight > 0) return n;
  }
  return null;
}

export function useFitHeight(ref: RefObject<HTMLElement | null>, enabled: boolean, bottom: number): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) {
      setHeight(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      raf = 0;
      const box = scroller(el);
      const rect = el.getBoundingClientRect();
      const view = box ? box.clientHeight : window.innerHeight;
      const top = box ? rect.top - box.getBoundingClientRect().top + box.scrollTop : rect.top + window.scrollY;
      const next = Math.max(0, Math.floor(view - top - bottom));
      setHeight((h) => (h === next ? h : next));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    // tudo o que fica acima da grade: os ancestrais e os irmãos anteriores de cada um
    const ro = new ResizeObserver(schedule);
    const box = scroller(el);
    for (let n: HTMLElement | null = el; n && n !== box && n !== document.body; n = n.parentElement) {
      for (let s = n.previousElementSibling; s; s = s.previousElementSibling) ro.observe(s);
      if (n !== el) ro.observe(n);
    }
    if (box) ro.observe(box);
    window.addEventListener("resize", schedule);
    void document.fonts?.ready.then(schedule);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
    };
  }, [ref, enabled, bottom]);
  return enabled ? height : null;
}
