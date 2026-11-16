"use client";

// Carrega o "cérebro de dados" só quando a dobra chega perto da tela (fora do bundle inicial,
// por next/dynamic). O painel reserva o espaço desde o HTML do servidor (aspect-ratio): nada
// pula (CLS). "Reduzir movimento", economia de dados ou aparelho fraco: versão parada.

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useReduceMotion } from "./hooks";

const BrainSvg = dynamic(() => import("./BrainSvg").then((m) => m.BrainSvg), { ssr: false });

/** Aparelho fraco ou economia de dados: a versão parada. */
function isWeakDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return !!nav.connection?.saveData || (nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2;
}

export function LazyBrain({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [weak, setWeak] = useState(false);
  const reduce = useReduceMotion();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê o aparelho uma vez, só no navegador
    setWeak(isWeakDevice());
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative aspect-[610/330] w-full overflow-hidden rounded-[20px] bg-[#13170c] ring-1 ring-black/5 ${className}`} data-brain-panel>
      {/* brilho de fundo, só CSS: o painel já tem cara antes do desenho chegar */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(138,154,91,0.22),transparent_62%)]" />
      {near && (
        <div className="relative">
          <BrainSvg animate={!reduce && !weak} />
        </div>
      )}
    </div>
  );
}
