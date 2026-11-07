"use client";

// Dobra "Demonstração": uma prévia do produto funcionando, com dados de amostra. O código
// das abas só baixa quando a dobra chega perto da tela; até lá, um espaço do mesmo tamanho.

import dynamic from "next/dynamic";
import { useInView } from "motion/react";
import { useRef } from "react";
import { CutReveal } from "@/components/motion/CutReveal";
import { SectionWipe } from "@/components/motion/SectionWipe";

function Waiting() {
  return (
    <div aria-hidden>
      <div className="grid grid-cols-3 gap-2 sm:flex">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-11 rounded-control bg-line/40 sm:w-44 sm:rounded-chip" />
        ))}
      </div>
      <div className="mt-3 h-[2.6em]" />
      {/* a altura medida da primeira aba (Filtrar), em cada largura: nada pula quando ela chega */}
      <div className="mt-2 h-[830px] rounded-card bg-line/20 sm:h-[808px] md:h-[654px] lg:h-[676px] xl:h-[390px]" />
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
      {/* no desktop, texto à esquerda e a demonstração à direita: a dobra cabe numa tela */}
      <div className="mx-auto grid max-w-[1360px] gap-8 px-4 pt-14 pb-14 sm:px-6 sm:pt-20 sm:pb-20 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)] lg:gap-12 lg:px-10 lg:pt-20">
        {/* no desktop, a fonte do título segue a largura da coluna (cqw), não a da tela:
            "funcionando." cabe inteiro em qualquer largura, com folga para o Safari */}
        <div className="@container">
          <p className="label-caps text-fg-2">Demonstração</p>
          <CutReveal as="h2" id="demo-title" className="display mt-5 text-[clamp(2.4rem,6.4vw,5.2rem)] text-fg lg:text-[clamp(2rem,14.5cqw,3.6rem)]" lineClassName={(i) => (i === 1 ? "text-accent" : "")} lines={["Veja funcionando.", "Pode clicar."]} />
          <p className="mt-5 flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 text-[16px] leading-relaxed text-fg-2 sm:text-[17px]">
            É o mesmo painel que o seu cliente recebe.
            <span className="rounded-chip border border-line px-2.5 py-0.5 text-[12px] font-medium">Amostra · dados fictícios</span>
          </p>
        </div>
        <div ref={ref} className="min-w-0">
          {near ? <DemoTabs /> : <Waiting />}
        </div>
      </div>
    </section>
  );
}
