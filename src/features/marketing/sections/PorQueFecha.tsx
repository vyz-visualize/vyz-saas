"use client";

// Dobra "Por que o número fecha": as regras que um gestor confere antes de mandar um
// número ao cliente. O título é o que separa o VYZ de um gráfico feito por prompt.

import { SectionWipe } from "@/components/motion/SectionWipe";
import { PromptHeadline } from "./PromptHeadline";
import { WhyCards } from "./WhyCards";

export function PorQueFecha() {
  return (
    <section id="por-que-fecha" aria-labelledby="pqf-title" className="relative bg-card">
      <SectionWipe />
      <div className="mx-auto max-w-[1360px] px-4 pt-14 pb-14 sm:px-6 sm:pt-20 sm:pb-24 lg:px-10 lg:pt-28">
        <p className="label-caps text-fg-2">Por que o número fecha</p>
        <div className="mt-5">
          <PromptHeadline id="pqf-title" />
        </div>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-fg-2 sm:mt-6 sm:text-[17px]">As regras que um gestor de tráfego confere antes de mandar um número para o cliente.</p>
        <div className="mt-6 flex justify-end sm:mt-10">
          <span className="rounded-chip border border-line px-2.5 py-0.5 text-[12px] text-fg-2">Amostra · dados fictícios</span>
        </div>
        <div className="mt-3">
          <WhyCards />
        </div>
      </div>
    </section>
  );
}
