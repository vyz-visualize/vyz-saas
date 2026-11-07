"use client";

import { useInView } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useMotionOK } from "@/lib/hooks";

const LINE1 = "Um prompt gera gráfico.";
const LINE2 = "Não gera critério.";

/**
 * "Um prompt gera gráfico." é digitado numa caixa de prompt; "Não gera
 * critério." sobe por baixo e a caixa apaga, como um prompt que não resolveu.
 * A caixa já nasce com o tamanho do texto inteiro (nada pula enquanto digita),
 * e nenhum recorte com clip-path: igual no Safari e no Chrome.
 */
export function PromptHeadline({ id }: { id: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  const motionOK = useMotionOK();
  // null = ainda não começou; depois, quantas letras já foram digitadas
  const [typed, setTyped] = useState<number | null>(null);
  const [stage, setStage] = useState<"typing" | "line2" | "done">("typing");

  useEffect(() => {
    if (!inView || !motionOK) return;
    let n = 0;
    const timers: number[] = [];
    const iv = window.setInterval(() => {
      n += 1;
      setTyped(n);
      if (n >= LINE1.length) {
        window.clearInterval(iv);
        timers.push(window.setTimeout(() => setStage("line2"), 260));
        timers.push(window.setTimeout(() => setStage("done"), 900));
      }
    }, 46);
    return () => {
      window.clearInterval(iv);
      timers.forEach(window.clearTimeout);
    };
  }, [inView, motionOK]);

  const animating = motionOK;
  const shown = !animating ? LINE1 : LINE1.slice(0, typed ?? 0);
  const line2State = !animating ? "static" : stage === "typing" ? "idle" : "play";
  const done = animating && stage === "done";

  const box = (
    <span className={`flex items-start gap-3 rounded-card border bg-bg px-4 py-4 transition-[border-color,opacity] duration-500 ease-brand sm:gap-5 sm:px-7 sm:py-6 ${done ? "border-line opacity-60" : "border-line"}`}>
      <span className="mt-[0.18em] shrink-0 text-[0.5em] font-medium text-accent tnum">›_</span>
      {/* a frase inteira, invisível, reserva o espaço; a digitada fica por cima */}
      <span className="grid min-w-0">
        <span className="invisible col-start-1 row-start-1">{LINE1}</span>
        <span className="col-start-1 row-start-1">
          {shown}
          {animating && !done && <span className="caret text-accent" />}
        </span>
      </span>
    </span>
  );

  return (
    <h2 ref={ref} id={id} className="display text-[clamp(2.3rem,7.2vw,6rem)] text-fg">
      <span className="sr-only">
        {LINE1} {LINE2}
      </span>
      <span aria-hidden className="block">
        <span className="block max-w-[16em]">{box}</span>
        <span className="mt-3 block text-accent sm:mt-4" data-cut={line2State}>
          <span className="cut-line">
            <span className="cut-in" style={{ "--d": "0ms" } as CSSProperties}>
              {LINE2}
            </span>
          </span>
        </span>
      </span>
    </h2>
  );
}
