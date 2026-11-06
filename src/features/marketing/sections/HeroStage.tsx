"use client";

// Lado direito do hero: o dashboard de amostra, clicável, com o movimento ao passar o
// mouse. O código e os dados só carregam depois da primeira pintura (o texto do hero é o
// LCP), num espaço já reservado, para nada pular.

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { TiltFrame } from "@/features/marketing/mock/TiltFrame";

function Skeleton() {
  return (
    <div className="flex h-full flex-col gap-3 p-4" aria-hidden>
      <div className="flex items-center justify-between">
        <div className="h-9 w-48 rounded-control bg-line/50" />
        <div className="h-8 w-44 rounded-chip bg-line/40" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[118px] rounded-card bg-line/30" />
        ))}
      </div>
      <div className="min-h-0 flex-1 rounded-card bg-line/25" />
    </div>
  );
}

const HeroDashboard = dynamic(() => import("@/features/marketing/demo/HeroDashboard"), { ssr: false, loading: Skeleton });

/** Monta quando o navegador folga e o quadro está perto da tela. */
function useWhenIdleAndNear(ref: React.RefObject<HTMLElement | null>) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let idleId = 0;
    let timerId = 0;
    const idle = typeof window.requestIdleCallback === "function";
    const start = () => {
      const run = () => setGo(true);
      if (idle) idleId = window.requestIdleCallback(run, { timeout: 1500 });
      else timerId = window.setTimeout(run, 200);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (idle) window.cancelIdleCallback(idleId);
      window.clearTimeout(timerId);
    };
  }, [ref]);
  return go;
}

export function HeroStage() {
  const ref = useRef<HTMLDivElement>(null);
  const go = useWhenIdleAndNear(ref);
  return (
    <div ref={ref}>
      <TiltFrame className="overflow-hidden rounded-card border border-line bg-bg">
        {/* o esqueleto já ocupa a altura do painel (medida): nada pula quando ele chega.
            Filtrar pode crescer o quadro, mas isso vem de um clique e não conta como CLS. */}
        <div data-hero-frame className="flex min-h-[var(--hero-h)] flex-col [--hero-h:930px] sm:[--hero-h:880px] lg:[--hero-h:850px] [&>*]:flex-1">{go ? <HeroDashboard /> : <Skeleton />}</div>
      </TiltFrame>
      <p className="mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12.5px] text-fg-2">
        <span>Clique numa campanha ou arraste no gráfico: o painel inteiro filtra.</span>
        <span className="rounded-chip border border-line px-2.5 py-0.5 text-[11px] font-medium">Amostra · dados fictícios</span>
      </p>
    </div>
  );
}
