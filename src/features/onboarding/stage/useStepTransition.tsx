"use client";

// Troca de passo do primeiro acesso (Web Animations API, sem biblioteca): crossfade, sem
// tela vazia. No clique, uma cópia estática do passo atual é guardada; quando o próximo
// passo (ou o esqueleto dele) é montado, a cópia fica por cima e esmaece enquanto o novo
// entra com um deslize curto (~200 ms): para frente da direita, ao voltar da esquerda. A
// ação do servidor roda junto, nada espera a animação.
// Com "reduzir movimento": troca simples, sem animação.

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotionPref } from "./motion";

export const STEP_TRANSITION_MS = 200;
const SHIFT = 12;

/** Copia o conteúdo como está (texto digitado e rolagem), sem ids, papéis nem foco: só para a imagem do crossfade. */
function snapshot(el: HTMLElement): HTMLElement {
  const copy = el.cloneNode(true) as HTMLElement;
  const from = [el, ...el.querySelectorAll<HTMLElement>("*")];
  const to = [copy, ...copy.querySelectorAll<HTMLElement>("*")];
  from.forEach((src, i) => {
    const dst = to[i];
    if (!dst) return;
    if (src instanceof HTMLInputElement || src instanceof HTMLTextAreaElement) (dst as HTMLInputElement).value = src.value;
    if (src instanceof HTMLInputElement && (src.type === "checkbox" || src.type === "radio")) (dst as HTMLInputElement).checked = src.checked;
    // a imagem não é a tela: sem ids, papéis nem aria (nada a encontra no lugar do passo de verdade)
    dst.removeAttribute("id");
    dst.removeAttribute("autofocus");
    dst.removeAttribute("role");
    for (const a of [...dst.attributes]) if (a.name.startsWith("aria-") || a.name === "data-onboarding-step" || a.name === "data-stage") dst.removeAttribute(a.name);
  });
  // a rolagem só vale com a cópia na página: guardada para aplicar depois
  copy.dataset.scrolls = JSON.stringify(from.map((n) => n.scrollTop));
  return copy;
}

export function useStepTransition(content: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotionPref();
  const old = useRef<{ node: HTMLElement; dir: 1 | -1 } | null>(null);
  const [active, setActive] = useState(false);
  // trocas em andamento (antigo → esqueleto → passo pode sobrepor duas): "ocupado" só sai na última
  const running = useRef(0);

  /** No clique: guarda a imagem do passo atual. dir 1 = seguir, -1 = voltar. */
  const begin = useCallback(
    (dir: 1 | -1) => {
      const el = content.current;
      if (!el || reduced) return;
      old.current = { node: snapshot(el), dir };
      setActive(true);
    },
    [content, reduced],
  );

  /**
   * O conteúdo novo já está montado (chamar num useLayoutEffect, antes de a tela pintar): a
   * imagem do anterior fica por cima e esmaece enquanto o novo entra.
   */
  const swap = useCallback(() => {
    const el = content.current;
    const prev = old.current;
    if (!el || !prev) {
      if (running.current === 0) setActive(false);
      return;
    }
    old.current = null;
    const host = el.parentElement;
    if (!host) {
      if (running.current === 0) setActive(false);
      return;
    }
    running.current += 1;
    const r = el.getBoundingClientRect();
    const cover = prev.node;
    cover.setAttribute("aria-hidden", "true");
    cover.setAttribute("inert", "");
    cover.dataset.stepCrossfade = "";
    Object.assign(cover.style, { position: "fixed", top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px`, margin: "0", pointerEvents: "none", zIndex: "5" });
    host.appendChild(cover);
    const scrolls = JSON.parse(cover.dataset.scrolls ?? "[]") as number[];
    [cover, ...cover.querySelectorAll<HTMLElement>("*")].forEach((n, i) => {
      if (scrolls[i]) n.scrollTop = scrolls[i];
    });
    const x = SHIFT * prev.dir;
    const out = cover.animate([{ opacity: 1 }, { opacity: 0 }], { duration: STEP_TRANSITION_MS, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
    const enter = el.animate(
      [
        { opacity: 0, transform: `translateX(${x}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: STEP_TRANSITION_MS, easing: "cubic-bezier(0,0,.2,1)" },
    );
    void Promise.all([out.finished, enter.finished])
      .catch(() => {})
      .finally(() => {
        cover.remove();
        running.current -= 1;
        if (running.current === 0 && !old.current) setActive(false);
      });
  }, [content]);

  /** A ação falhou e o passo continua o mesmo: descarta a imagem. */
  const settle = useCallback(() => {
    old.current = null;
    if (running.current === 0) setActive(false);
  }, []);

  // nunca fica uma imagem presa na tela
  useEffect(
    () => () => {
      old.current = null;
      document.querySelectorAll("[data-step-crossfade]").forEach((n) => n.remove());
    },
    [],
  );

  return { begin, swap, settle, active };
}
