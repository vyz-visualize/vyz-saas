"use client";

// Troca de passo do primeiro acesso (Web Animations API, sem biblioteca): o passo atual
// esmaece com um deslize curto (~110 ms) e o próximo entra do outro lado (~140 ms), para
// frente da direita, ao voltar da esquerda. A ação do servidor roda junto: nada espera a
// animação. Se o próximo passo demora, a tela abre com ele em esqueleto (MAX_WAIT_MS).
// Com "reduzir movimento": só a troca de opacidade, sem deslize.

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotionPref } from "./motion";

export const STEP_TRANSITION_MS = { out: 110, in: 140 } as const;
/** A tela nunca fica vazia mais que isto: depois, abre (com o próximo passo em esqueleto, se ele ainda não chegou). */
export const MAX_WAIT_MS = 400;
const SHIFT = 14;
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

type Run = { arrive: Promise<void>; resolve: () => void };

export function useStepTransition(content: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotionPref();
  const run = useRef<Run | null>(null);
  const [active, setActive] = useState(false);

  /** Começa a troca (no clique). dir 1 = seguir, -1 = voltar. */
  const begin = useCallback(
    (dir: 1 | -1) => {
      const el = content.current;
      if (!el || run.current) return;
      let resolve!: () => void;
      const arrive = new Promise<void>((r) => (resolve = r));
      run.current = { arrive, resolve };
      setActive(true);
      void (async () => {
        const x = reduced ? 0 : SHIFT * dir;
        const out = el.animate(
          [
            { opacity: 1, transform: "translateX(0)" },
            { opacity: 0, transform: `translateX(${-x}px)` },
          ],
          { duration: STEP_TRANSITION_MS.out, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" },
        );
        await out.finished.catch(() => {});
        await Promise.race([arrive, sleep(MAX_WAIT_MS)]);
        const enter = el.animate(
          [
            { opacity: 0, transform: `translateX(${x}px)` },
            { opacity: 1, transform: "translateX(0)" },
          ],
          { duration: STEP_TRANSITION_MS.in, easing: "cubic-bezier(0,0,.2,1)" },
        );
        out.cancel();
        await enter.finished.catch(() => {});
        run.current = null;
        setActive(false);
      })();
    },
    [content, reduced],
  );

  /** O próximo passo chegou (ou a ação falhou e fica o mesmo passo): abre. */
  const settle = useCallback(() => run.current?.resolve(), []);

  // nunca fica preso: se a página sair do ar no meio, a promessa é resolvida
  useEffect(() => () => run.current?.resolve(), []);

  return { begin, settle, active };
}
