"use client";

// Tour do primeiro dashboard: até 7 pontos (período e comparar, indicadores e Personalizar,
// abas, clicar para filtrar, Editar, Compartilhar/PDF e Pergunte ao VYZ), cada um com o
// alvo em destaque e um balão com seta. O que não estiver na tela fica de fora, e um alvo
// que some no meio do tour é pulado. Nunca prende a pessoa: X, Esc (em qualquer lugar),
// clique fora e "Pular tour" sempre fecham, e o balão fica sempre dentro da tela.
// Concluir ou pular grava no banco (user_guides, por pessoa) e o tour não volta. Enquanto
// ele está na tela, nenhum lembrete aparece (atributo no <html>).

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
const EDGE = 12;
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
  const [balloonH, setBalloonH] = useState(200);
  const balloon = useRef<HTMLDivElement>(null);

  // os pontos que existem nesta tela
  useEffect(() => {
    const t = window.setTimeout(() => setSteps(TOUR_STEPS.filter((s) => findTourTarget(document, s))), START_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const active = !closed && steps.length > 0 && i < steps.length;
  useEffect(() => {
    if (!active) return;
    document.documentElement.setAttribute(TOUR_ACTIVE_ATTR, "");
    return () => document.documentElement.removeAttribute(TOUR_ACTIVE_ATTR);
  }, [active]);

  const finish = useCallback(
    (how: "done" | "skipped") => {
      setClosed(true);
      if (how === "done") track("tour_complete", { steps: steps.length });
      else track("onboarding_skip", { step: "tour", at: steps[i]?.id ?? "" });
      void onFinish(how);
    },
    [onFinish, steps, i],
  );

  const next = useCallback(() => (i >= steps.length - 1 ? finish("done") : setI((n) => n + 1)), [i, steps.length, finish]);

  const step = active ? steps[i] : undefined;
  const measure = useCallback(() => {
    if (!step) return;
    const el = findTourTarget(document, step);
    // o alvo sumiu (aba trocada, menu fechado, visual sem ele): o passo é pulado, nunca trava
    if (!el) return next();
    const r = el.getBoundingClientRect();
    setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [step, next]);

  // leva o alvo para a tela e acompanha rolagem e redimensionamento
  useLayoutEffect(() => {
    if (!step) return;
    findTourTarget(document, step)?.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" as ScrollBehavior });
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
  }, [step, measure]);

  // a altura real do balão (para nunca sair da tela) e o foco nele a cada passo
  useLayoutEffect(() => {
    if (!active) return;
    const h = balloon.current?.offsetHeight;
    if (h && h !== balloonH) setBalloonH(h);
    balloon.current?.focus({ preventScroll: true });
  }, [active, i, balloonH]);

  // Esc fecha de qualquer lugar (não só com o foco no balão)
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish("skipped");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, finish]);

  if (!active || !step) return null;
  const last = i === steps.length - 1;
  const vw = typeof window === "undefined" ? 1024 : window.innerWidth;
  const vh = typeof window === "undefined" ? 768 : window.innerHeight;
  const width = Math.min(BALLOON_W, vw - EDGE * 2);
  // balão embaixo do alvo; sem espaço, em cima; sem espaço nenhum (alvo enorme), no meio da tela
  const fitsBelow = !!box && box.top + box.height + GAP + balloonH <= vh - EDGE;
  const fitsAbove = !!box && box.top - GAP - balloonH >= EDGE;
  const place: "below" | "above" | "center" = fitsBelow ? "below" : fitsAbove ? "above" : "center";
  const center = box ? box.left + box.width / 2 : vw / 2;
  const left = Math.max(EDGE, Math.min(center - width / 2, vw - width - EDGE));
  const arrow = Math.max(18, Math.min(center - left, width - 18));
  const rawTop = place === "below" ? box!.top + box!.height + GAP : place === "above" ? box!.top - GAP - balloonH : (vh - balloonH) / 2;
  const top = Math.max(EDGE, Math.min(rawTop, vh - balloonH - EDGE));

  return (
    // clique fora do balão (no escuro) fecha o tour
    <div data-tour-overlay={step.id} className="fixed inset-0 z-[1000] print:hidden" aria-live="polite" onClick={(e) => e.target === e.currentTarget && finish("skipped")}>
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[12px] ring-2 ring-accent transition-[top,left,width,height] duration-200 ease-brand motion-reduce:transition-none"
          style={{ ...box, boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }}
        />
      ) : (
        <div aria-hidden className="pointer-events-none fixed inset-0 bg-black/50" />
      )}
      <div
        ref={balloon}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-titulo"
        aria-describedby="tour-texto"
        tabIndex={-1}
        data-tour-balloon
        className="fixed rounded-card border border-line bg-bg p-4 text-fg shadow-[0_16px_48px_rgba(0,0,0,0.35)] outline-none motion-safe:animate-[rise_200ms_var(--ease)_both]"
        style={{ width, left, top }}
      >
        {place !== "center" && (
          <span
            aria-hidden
            className={`absolute size-3 rotate-45 border-line bg-bg ${place === "below" ? "-top-1.5 border-t border-l" : "-bottom-1.5 border-r border-b"}`}
            style={{ left: arrow - 6 }}
          />
        )}
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
          <button type="button" onClick={next} className={btn.small}>
            {last ? "Concluir" : "Próximo"}
          </button>
        </div>
      </div>
    </div>
  );
}
