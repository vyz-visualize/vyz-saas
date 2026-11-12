"use client";

// Tour do primeiro dashboard: até 4 pontos (período, métricas principais,
// criativos e Compartilhar), cada um com o alvo em destaque e um balão com
// seta. O que não estiver na tela fica de fora. Concluir ou pular grava no
// banco (user_guides, por pessoa) e o tour não volta. Enquanto ele está na
// tela, nenhum lembrete aparece (atributo no <html>).

import { X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { btn } from "@/components/ui/styles";
import { track } from "@/lib/track";
import { finishTour } from "@/server/guides/actions";
import type { ActionResult } from "@/server/supabase/errors";
import { findTourTarget, TOUR_ACTIVE_ATTR, TOUR_STEPS } from "./guides";

type Box = { top: number; left: number; width: number; height: number };
const PAD = 6;
const BALLOON_W = 320;
const GAP = 14;
/** Espera o dashboard desenhar antes de procurar os alvos. */
const START_DELAY_MS = 700;

type Props = {
  /** Grava o fim do tour (padrão: no banco). */
  onFinish?: (how: "done" | "skipped") => Promise<ActionResult>;
};

export function DashboardTour({ onFinish = finishTour }: Props) {
  const [steps, setSteps] = useState<typeof TOUR_STEPS>([]);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [closed, setClosed] = useState(false);
  const balloon = useRef<HTMLDivElement>(null);

  // os pontos que existem nesta tela
  useEffect(() => {
    const t = window.setTimeout(() => setSteps(TOUR_STEPS.filter((s) => findTourTarget(document, s))), START_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const active = !closed && steps.length > 0;
  useEffect(() => {
    if (!active) return;
    document.documentElement.setAttribute(TOUR_ACTIVE_ATTR, "");
    return () => document.documentElement.removeAttribute(TOUR_ACTIVE_ATTR);
  }, [active]);

  const step = steps[i];
  const measure = useCallback(() => {
    if (!step) return;
    const el = findTourTarget(document, step);
    if (!el) return setBox(null);
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step]);

  // leva o alvo para a tela e acompanha rolagem e redimensionamento
  useLayoutEffect(() => {
    if (!active || !step) return;
    findTourTarget(document, step)?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    // mede no próximo quadro, já com a rolagem aplicada
    let raf = requestAnimationFrame(measure);
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [active, step, measure]);

  useEffect(() => {
    if (active) balloon.current?.focus();
  }, [active, i]);

  const finish = useCallback(
    (how: "done" | "skipped") => {
      setClosed(true);
      if (how === "done") track("tour_complete", { steps: steps.length });
      else track("onboarding_skip", { step: "tour", at: steps[i]?.id ?? "" });
      void onFinish(how);
    },
    [onFinish, steps, i],
  );

  if (!active || !step) return null;
  const last = i === steps.length - 1;
  const vw = typeof window === "undefined" ? 1024 : window.innerWidth;
  const vh = typeof window === "undefined" ? 768 : window.innerHeight;
  const width = Math.min(BALLOON_W, vw - 24);
  // balão embaixo do alvo; sem espaço, em cima. A seta aponta para o meio do alvo.
  const below = !box || box.top + box.height + GAP + 190 < vh || box.top < 220;
  const center = box ? box.left + box.width / 2 : vw / 2;
  const left = Math.max(12, Math.min(center - width / 2, vw - width - 12));
  const arrow = Math.max(18, Math.min(center - left, width - 18));
  const top = box ? (below ? box.top + box.height + GAP : undefined) : vh / 2 - 90;
  const bottom = box && !below ? vh - box.top + GAP : undefined;

  return (
    <div data-tour-overlay={step.id} className="fixed inset-0 z-[80] print:hidden" aria-live="polite">
      {/* o destaque: o resto da tela escurece; clique fora não fecha (o tour tem botões próprios) */}
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[12px] ring-2 ring-accent transition-[top,left,width,height] duration-200 ease-brand motion-reduce:transition-none"
          style={{ ...box, boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-black/50" />
      )}
      <div
        ref={balloon}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-titulo"
        aria-describedby="tour-texto"
        tabIndex={-1}
        onKeyDown={(e) => e.key === "Escape" && finish("skipped")}
        className="fixed rounded-card border border-line bg-bg p-4 text-fg shadow-[0_16px_48px_rgba(0,0,0,0.35)] outline-none motion-safe:animate-[rise_200ms_var(--ease)_both]"
        style={{ width, left, top, bottom }}
      >
        <span
          aria-hidden
          className={`absolute size-3 rotate-45 border-line bg-bg ${below ? "-top-1.5 border-t border-l" : "-bottom-1.5 border-r border-b"}`}
          style={{ left: arrow - 6 }}
        />
        <div className="flex items-start justify-between gap-3">
          <p className="text-[12.5px] text-fg-2">
            <span className="tnum font-semibold text-fg">{i + 1}</span> de {steps.length}
          </p>
          <button type="button" onClick={() => finish("skipped")} aria-label="Fechar o tour" className="-mt-1 -mr-1 inline-flex size-7 items-center justify-center rounded-control text-fg-2 hover:text-fg">
            <X size={15} aria-hidden />
          </button>
        </div>
        <h2 id="tour-titulo" className="title mt-1 text-[17px]">
          {step.title}
        </h2>
        <p id="tour-texto" className="mt-1 text-[14px] leading-relaxed text-fg-2">
          {step.text}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => finish("skipped")} className="text-[13.5px] font-medium text-fg-2 underline-offset-4 hover:text-fg hover:underline">
            Pular tour
          </button>
          <button type="button" onClick={() => (last ? finish("done") : setI((n) => n + 1))} className={btn.small}>
            {last ? "Concluir" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
