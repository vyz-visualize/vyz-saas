"use client";

// O Personalizar acompanha o dashboard aberto: a barra do topo e a bandeja de métricas
// ficam alinhadas com a grade (as mesmas bordas de esquerda e direita) e usam as cores
// do visual dele (Fachada claro, Noturno escuro...), não o tema do painel. A grade marca
// o lugar com [data-edit-anchor] (GridCanvas); sem grade na aba, vale o próprio dashboard.

import { useLayoutEffect, useState, type CSSProperties } from "react";

/** Tokens de cor que o visual troca (bklit-blocks themeVars) e que a barra e a bandeja usam. */
const TOKENS = ["--bg", "--card", "--fg", "--fg-2", "--line", "--accent", "--accent-soft", "--on-accent", "--field", "--muted", "--error-fg", "--error-soft", "--good", "--panel"] as const;

export type EditAnchor = { left: number; right: number; width: number; /** Tela de computador (a bandeja flutua alinhada; no celular, ocupa a largura). */ wide: boolean; vars: CSSProperties } | null;

function anchorElement(): HTMLElement | null {
  const root = document.querySelector<HTMLElement>("[data-metric-editing]");
  return root?.querySelector<HTMLElement>("[data-edit-anchor]") ?? root;
}

/** Bordas (px da janela) e cores do dashboard em edição. null enquanto mede ou fora da edição. */
export function useEditAnchor(active: boolean): EditAnchor {
  const [anchor, setAnchor] = useState<EditAnchor>(null);
  useLayoutEffect(() => {
    if (!active) return;
    let raf = 0;
    let el: HTMLElement | null = null;
    const measure = () => {
      raf = 0;
      el = anchorElement();
      if (!el) return;
      const r = el.getBoundingClientRect();
      const css = getComputedStyle(el);
      const vars: Record<string, string> = { colorScheme: css.colorScheme || "normal", color: css.getPropertyValue("--fg").trim() || css.color };
      for (const t of TOKENS) {
        const v = css.getPropertyValue(t).trim();
        if (v) vars[t] = v;
      }
      const next = { left: Math.round(r.left), right: Math.round(window.innerWidth - r.right), width: Math.round(r.width), wide: window.matchMedia("(min-width: 768px)").matches, vars: vars as CSSProperties };
      setAnchor((a) => (a && a.left === next.left && a.right === next.right && a.wide === next.wide && JSON.stringify(a.vars) === JSON.stringify(next.vars) ? a : next));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(schedule);
    if (el) ro.observe(el);
    ro.observe(document.body);
    window.addEventListener("resize", schedule);
    // a grade troca de aba e a barra lateral abre e fecha: confere de novo de vez em quando
    const tick = window.setInterval(schedule, 800);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      window.clearInterval(tick);
      cancelAnimationFrame(raf);
    };
  }, [active]);
  return active ? anchor : null;
}
