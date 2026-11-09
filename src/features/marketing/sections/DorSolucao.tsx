// Dobra "Dor → solução": o problema de quem monta relatório na mão e o que muda com o VYZ.

import { ArrowDown, ArrowRight, Check, X } from "lucide-react";
import { CutReveal } from "@/components/motion/CutReveal";
import { Reveal } from "@/components/motion/Reveal";
import { hasDemoVideo, VIDEO_SECTION_ID } from "@/features/marketing/video";

// dorCurta/solCurta: o que aparece no celular, uma linha cada
const PAIRS = [
  {
    dor: "Print de cada plataforma, planilha e PDF montado toda semana.",
    sol: "Contas conectadas por login: o dashboard se atualiza e vira link ou PDF.",
    dorCurta: "Print, planilha e PDF toda semana.",
    solCurta: "Conecta por login e vira link ou PDF.",
  },
  {
    dor: "O cliente pergunta: “mas isso é bom?”",
    sol: "O número que decide o mês fica no topo, com a comparação e o equilíbrio.",
    dorCurta: "O cliente pergunta: “isso é bom?”",
    solCurta: "O número do mês, no topo.",
  },
  {
    dor: "Meta e Google contam a mesma venda.",
    sol: "Cada plataforma com a sua venda, lado a lado, sem dupla contagem.",
    dorCurta: "Meta e Google contam a mesma venda.",
    solCurta: "Cada plataforma com a sua venda.",
  },
];

export function DorSolucao() {
  return (
    <section id="dor" aria-labelledby="dor-title" className="relative border-t border-line">
      <div className="mx-auto max-w-[1360px] px-4 pt-14 pb-14 sm:px-6 sm:pt-20 sm:pb-20 lg:px-10 lg:pt-24">
        <CutReveal as="h2" id="dor-title" className="display text-[clamp(2.1rem,5vw,4rem)] text-fg" lines={["Relatório na mão custa caro.", <span key="a" className="text-accent">E nem sempre o cliente entende.</span>]} />
        {/* celular: um card por par, uma linha de cada lado */}
        <ul className="mt-7 space-y-2.5 md:hidden">
          {PAIRS.map((p, i) => (
            <li key={p.dor}>
              <Reveal delay={i * 90}>
                <div className="rounded-card border border-line px-4 py-3.5">
                  <p className="flex items-center gap-2.5 text-[14.5px] leading-snug text-fg-2">
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-line" aria-hidden>
                      <X size={11} />
                    </span>
                    <span>
                      <span className="sr-only">Hoje: </span>
                      {p.dorCurta}
                    </span>
                  </p>
                  <p className="mt-2 flex items-center gap-2.5 text-[15px] leading-snug font-medium text-fg">
                    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden>
                      <Check size={11} />
                    </span>
                    <span>
                      <span className="sr-only">Com o VYZ: </span>
                      {p.solCurta}
                    </span>
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
        <ul className="mt-12 hidden space-y-3 md:block">
          {PAIRS.map((p, i) => (
            <li key={p.dor}>
              <Reveal delay={i * 90}>
                <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                  <p className="flex items-start gap-3 rounded-card border border-line px-5 py-4 text-[16px] leading-snug text-fg-2">
                    <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-line" aria-hidden>
                      <X size={13} />
                    </span>
                    <span>
                      <span className="sr-only">Hoje: </span>
                      {p.dor}
                    </span>
                  </p>
                  <span className="flex items-center justify-center text-accent" aria-hidden>
                    <ArrowRight size={20} />
                  </span>
                  <p className="flex items-start gap-3 rounded-card border border-accent/40 bg-accent-soft/50 px-5 py-4 text-[16px] leading-snug font-medium text-fg">
                    <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden>
                      <Check size={13} />
                    </span>
                    <span>
                      <span className="sr-only">Com o VYZ: </span>
                      {p.sol}
                    </span>
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
        {hasDemoVideo && (
          <a href={`#${VIDEO_SECTION_ID}`} className="mt-5 inline-flex min-h-11 items-center gap-2 text-[15px] md:mt-8 font-semibold text-accent hover:underline" data-track="hero_cta" data-track-cta="ver_por_dentro_dor">
            Ver funcionando
            <ArrowDown size={16} aria-hidden />
          </a>
        )}
      </div>
    </section>
  );
}
