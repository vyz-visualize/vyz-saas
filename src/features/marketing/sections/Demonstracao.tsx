"use client";

// Dobra "Demonstração": o produto funcionando, com dados de amostra. O código das abas
// só baixa quando a dobra chega perto da tela; até lá, um espaço do mesmo tamanho.

import dynamic from "next/dynamic";
import { useInView } from "motion/react";
import { useRef } from "react";
import { CutReveal } from "@/components/motion/CutReveal";
import { SectionWipe } from "@/components/motion/SectionWipe";

function Waiting() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 rounded-control bg-line/40 sm:w-44 sm:rounded-chip" />
        ))}
      </div>
      <div className="h-[2.6em]" />
      {/* a altura medida da primeira aba (Filtrar), em cada largura: nada pula quando ela chega */}
      <div className="h-[1720px] rounded-card bg-line/20 sm:h-[1360px] lg:h-[1140px]" />
    </div>
  );
}

const DemoTabs = dynamic(() => import("@/features/marketing/demo/DemoTabs"), { ssr: false, loading: Waiting });

export function Demonstracao() {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin: "600px 0px" });
  return (
    <section id="demonstracao" aria-labelledby="demo-title" className="relative bg-card">
      <SectionWipe />
      <div className="mx-auto max-w-[1360px] px-4 pt-20 pb-24 sm:px-6 lg:px-10 lg:pt-28">
        <p className="label-caps text-fg-2">Demonstração</p>
        <CutReveal as="h2" id="demo-title" className="display mt-5 text-[clamp(2.4rem,6.4vw,5.2rem)] text-fg" lineClassName={(i) => (i === 1 ? "text-accent" : "")} lines={["Veja funcionando.", "Pode clicar."]} />
        <p className="mt-6 flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 text-[17px] leading-relaxed text-fg-2">
          É o mesmo painel que o seu cliente recebe.
          <span className="rounded-chip border border-line px-2.5 py-0.5 text-[12px] font-medium">Amostra · dados fictícios</span>
        </p>
        <div ref={ref} className="mt-10">
          {near ? <DemoTabs /> : <Waiting />}
        </div>
      </div>
    </section>
  );
}
