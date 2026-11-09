// Dobra "Dor → solução": o problema de quem monta relatório na mão e o que muda com o VYZ.

import { ArrowDown } from "lucide-react";
import { CutReveal } from "@/components/motion/CutReveal";
import { hasDemoVideo, VIDEO_SECTION_ID } from "@/features/marketing/video";
import { DorRows } from "./DorRows";

export function DorSolucao() {
  return (
    <section id="dor" aria-labelledby="dor-title" className="relative border-t border-line">
      <div className="mx-auto max-w-[1360px] px-4 pt-14 pb-14 sm:px-6 sm:pt-20 sm:pb-20 lg:px-10 lg:pt-24">
        <CutReveal as="h2" id="dor-title" className="display text-[clamp(2.1rem,5vw,4rem)] text-fg" lines={["Relatório na mão custa caro.", <span key="a" className="text-accent">E nem sempre o cliente entende.</span>]} />
        <DorRows />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 md:mt-8">
          {hasDemoVideo ? (
            <a href={`#${VIDEO_SECTION_ID}`} className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-accent hover:underline" data-track="hero_cta" data-track-cta="ver_por_dentro_dor">
              Ver funcionando
              <ArrowDown size={16} aria-hidden />
            </a>
          ) : (
            <span />
          )}
          <span className="rounded-chip border border-line px-2.5 py-0.5 text-[12px] text-fg-2">Amostra · dados fictícios</span>
        </div>
      </div>
    </section>
  );
}
