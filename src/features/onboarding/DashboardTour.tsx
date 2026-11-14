"use client";

// Tours do primeiro acesso, com o alvo em destaque e um balão com seta:
// - o do painel (PanelTour): onde fica cada coisa (workspaces, o workspace aberto, a rotina,
//   o plano e a conta, o assistente), no menu lateral ou, no celular, no topo e na barra;
// - o do primeiro dashboard (DashboardTour): até 7 pontos (período e comparar, indicadores e
//   Personalizar, abas, clicar para filtrar, Editar, Compartilhar/PDF e Pergunte ao VYZ).
// O que não estiver na tela fica de fora, e um alvo que some no meio do tour é pulado. Nunca
// prende a pessoa: X, Esc (em qualquer lugar), clique fora e "Pular tour" sempre fecham, e o
// balão fica sempre dentro da tela (ao lado do alvo no menu lateral, quando cabe).
// Concluir ou pular grava no banco (user_guides, por pessoa) e o tour não volta. Enquanto
// ele está na tela, nenhum lembrete aparece (atributo no <html>).

import { X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { btn } from "@/components/ui/styles";
import { track } from "@/lib/track";
import { finishTour } from "@/server/guides/actions";
import type { ActionResult } from "@/server/supabase/errors";
import { findTourTarget, PANEL_TOUR_GUIDE, PANEL_TOUR_STEPS, TOUR_ACTIVE_ATTR, TOUR_STEPS, type TourStep } from "./guides";

type Box = { top: number; left: number; width: number; height: number };
const PAD = 6;
const BALLOON_W = 320;
const GAP = 14;
const EDGE = 12;
/** Espera a tela desenhar antes de procurar os alvos. */
const START_DELAY_MS = 700;

type Finish = (how: "done" | "skipped") => Promise<ActionResult>;

type Props = {
  /** Grava o fim do tour (padrão: no banco). */
  onFinish?: Finish;
};

// fora do componente: a mesma função a cada render (o tour mede e acompanha o alvo por ela)
const finishDashboardTour: Finish = (how) => finishTour(how);
const finishPanelTour: Finish = (how) => finishTour(how, PANEL_TOUR_GUIDE);

/** Tour do primeiro dashboard. */
export function DashboardTour({ onFinish = finishDashboardTour }: Props) {
  return <Tour name="dashboard" steps={TOUR_STEPS} onFinish={onFinish} />;
}

/** Tour do painel: onde fica cada coisa, no primeiro acesso. */
export function PanelTour({ onFinish = finishPanelTour }: Props) {
  return <Tour name="painel" steps={PANEL_TOUR_STEPS} onFinish={onFinish} />;
}

function Tour({ name, steps: all, onFinish }: { name: string; steps: readonly TourStep[]; onFinish: Finish }) {
  const [steps, setSteps] = useState<readonly TourStep[]>([]);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [closed, setClosed] = useState(false);
  const [balloonH, setBalloonH] = useState(200);
  const balloon = useRef<HTMLDivElement>(null);

  // os pontos que existem nesta tela
  useEffect(() => {
    const t = window.setTimeout(() => setSteps(all.filter((s) => findTourTarget(document, s))), START_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [all]);

  const active = !closed && steps.length > 0 && i < steps.length;
  useEffect(() => {
    if (!active) return;
    document.documentElement.setAttribute(TOUR_ACTIVE_ATTR, "");
    return () => document.documentElement.removeAttribute(TOUR_ACTIVE_ATTR);
  }, [active]);

  const finish = useCallback(
    (how: "done" | "skipped") => {
      setClosed(true);
      if (how === "done") track("tour_complete", { steps: steps.length, tour: name });
      else track("onboarding_skip", { step: "tour", at: steps[i]?.id ?? "", tour: name });
      void onFinish(how);
    },
    [onFinish, steps, i, name],
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
  // no menu lateral, ao lado do alvo; senão embaixo; sem espaço, em cima; sem espaço nenhum (alvo enorme), no meio da tela
  const fitsRight = !!box && step.side === "right" && box.left + box.width + GAP + width <= vw - EDGE;
  const fitsBelow = !!box && box.top + box.height + GAP + balloonH <= vh - EDGE;
  const fitsAbove = !!box && box.top - GAP - balloonH >= EDGE;
  const place: "right" | "below" | "above" | "center" = fitsRight ? "right" : fitsBelow ? "below" : fitsAbove ? "above" : "center";
  const centerX = box ? box.left + box.width / 2 : vw / 2;
  const centerY = box ? box.top + box.height / 2 : vh / 2;
  const left = place === "right" ? box!.left + box!.width + GAP : Math.max(EDGE, Math.min(centerX - width / 2, vw - width - EDGE));
  const rawTop = place === "right" ? centerY - balloonH / 2 : place === "below" ? box!.top + box!.height + GAP : place === "above" ? box!.top - GAP - balloonH : (vh - balloonH) / 2;
  const top = Math.max(EDGE, Math.min(rawTop, vh - balloonH - EDGE));
  // a seta aponta para o meio do alvo (na horizontal embaixo/em cima; na vertical ao lado)
  const arrow = place === "right" ? Math.max(18, Math.min(centerY - top, balloonH - 18)) : Math.max(18, Math.min(centerX - left, width - 18));

  return (
    // clique fora do balão (no escuro) fecha o tour
    <div data-tour-overlay={step.id} className="fixed inset-0 z-[1000] print:hidden" aria-live="polite" onClick={(e) => e.target === e.currentTarget && finish("skipped")}>
      {box ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[12px] transition-[top,left,width,height] duration-200 ease-brand motion-reduce:transition-none"
          // contorno claro (aparece no oliva do menu e no fundo do painel) e o resto da tela no escuro
          style={{ ...box, boxShadow: "0 0 0 2px rgb(255 255 255 / 0.85), 0 0 0 9999px rgb(0 0 0 / 0.5)" }}
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
            className={`absolute size-3 rotate-45 border-line bg-bg ${place === "right" ? "-left-1.5 border-b border-l" : place === "below" ? "-top-1.5 border-t border-l" : "-bottom-1.5 border-r border-b"}`}
            style={place === "right" ? { top: arrow - 6 } : { left: arrow - 6 }}
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
