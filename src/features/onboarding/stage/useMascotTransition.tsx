"use client";

// Transição entre passos com o mascote (Web Animations API, sem biblioteca):
// 1. o conteúdo se recolhe em direção ao centro até virar um círculo (~200 ms);
// 2. o círculo vira o mascote, que gira (sentido horário para a frente, anti-horário ao voltar)
//    enquanto a ação do servidor roda em paralelo — nada espera a animação para começar;
// 3. quando o próximo passo chega (ou a ação falha), um "squash" leve e o conteúdo se abre a
//    partir do centro (~240 ms). Total de ~860 ms quando o servidor responde rápido.
// Com "reduzir movimento": só uma troca de opacidade, sem giro.

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import { Mascot } from "@/features/agent/Mascot";
import { useReducedMotionPref } from "./motion";

export const TRANSITION_MS = { collapse: 200, spin: 360, squash: 120, expand: 240 } as const;
/** O mascote nunca fica sozinho mais que isto: depois, a tela abre (com o próximo passo em esqueleto, se ele ainda não chegou). */
export const MAX_ALONE_MS = 620;
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const OPEN = "circle(150% at 50% 50%)";
const DOT = "circle(30px at 50% 50%)";
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

type Run = { arrive: Promise<void>; resolve: () => void };

export function useMascotTransition(content: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotionPref();
  const [mascot, setMascot] = useState(false);
  const spinner = useRef<HTMLSpanElement>(null);
  const run = useRef<Run | null>(null);
  const [active, setActive] = useState(false);

  /** Começa a transição (no clique). dir 1 = seguir, -1 = voltar. */
  const begin = useCallback(
    (dir: 1 | -1) => {
      const el = content.current;
      if (!el || run.current) return;
      let resolve!: () => void;
      const arrive = new Promise<void>((r) => (resolve = r));
      run.current = { arrive, resolve };
      setActive(true);
      void (async () => {
        if (reduced) {
          const out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: "forwards" });
          await out.finished;
          await Promise.race([arrive, sleep(MAX_ALONE_MS)]);
          const back = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
          out.cancel();
          await back.finished.catch(() => {});
        } else {
          const collapse = el.animate(
            [
              { clipPath: OPEN, transform: "scale(1)", opacity: 1 },
              { clipPath: DOT, transform: "scale(0.94)", opacity: 0.9 },
            ],
            { duration: TRANSITION_MS.collapse, easing: "cubic-bezier(.6,0,.4,1)", fill: "forwards" },
          );
          await collapse.finished;
          // o mascote precisa estar na tela agora (não no próximo render do React) para girar
          flushSync(() => setMascot(true));
          const shownAt = performance.now();
          await nextFrame();
          const m = spinner.current;
          // giro em pé, em torno do eixo vertical (como uma moeda): o rosto vai para a lateral, passa
          // pelas costas (a esfera sem rosto) e volta de frente. Ao voltar um passo, ao contrário.
          const turn = `${dir * 360}deg`;
          await m?.animate([{ transform: "rotateY(0deg) scale(0.55)" }, { transform: `rotateY(${turn}) scale(1)` }], { duration: TRANSITION_MS.spin, easing: "cubic-bezier(.3,.7,.4,1)" }).finished.catch(() => {});
          // o passo ainda não chegou: segue girando, até o limite; depois a tela abre mesmo assim
          let wait: Animation | undefined;
          let arrived = false;
          void arrive.then(() => (arrived = true));
          await Promise.resolve();
          if (!arrived) wait = m?.animate([{ transform: "rotateY(0deg)" }, { transform: `rotateY(${turn})` }], { duration: 760, iterations: Infinity });
          await Promise.race([arrive, sleep(Math.max(0, MAX_ALONE_MS - (performance.now() - shownAt)))]);
          wait?.cancel();
          await m?.animate([{ transform: "scale(1)" }, { transform: "scale(1.18, 0.82)" }, { transform: "scale(0.95, 1.05)" }, { transform: "scale(1)" }], { duration: TRANSITION_MS.squash, easing: "ease-out" }).finished.catch(() => {});
          setMascot(false);
          const expand = el.animate(
            [
              { clipPath: DOT, transform: "scale(0.94)", opacity: 0.9 },
              { clipPath: OPEN, transform: "scale(1)", opacity: 1 },
            ],
            { duration: TRANSITION_MS.expand, easing: "cubic-bezier(.2,.7,.2,1)" },
          );
          collapse.cancel();
          await expand.finished.catch(() => {});
        }
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

  const overlay = mascot ? (
    <span aria-hidden className="pointer-events-none fixed inset-0 z-10 grid place-items-center [perspective:640px]" data-transition-mascot>
      <span ref={spinner} className="relative block size-[60px] [transform-style:preserve-3d]">
        {/* frente: o mascote; costas: a esfera sem rosto (nunca o rosto espelhado) */}
        <span className="absolute inset-0 [backface-visibility:hidden]">
          <Mascot size={60} state="thinking" />
        </span>
        <span
          className="absolute inset-0 rounded-full [backface-visibility:hidden]"
          style={{ transform: "rotateY(180deg)", background: "radial-gradient(circle at 34% 30%, #e3ebb8 0%, #a7b464 24%, #6e7b37 58%, #3a431e 100%)", boxShadow: "0 6px 18px rgba(0,0,0,.35)" }}
          data-mascot-back
        />
      </span>
    </span>
  ) : null;

  return { begin, settle, overlay, active };
}
