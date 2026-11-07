// Dobra "Dor → solução": o problema de quem monta relatório na mão e o que muda com o VYZ.

import { ArrowDown, ArrowRight, X } from "lucide-react";
import { CutReveal } from "@/components/motion/CutReveal";
import { Reveal } from "@/components/motion/Reveal";
import { Check } from "lucide-react";

const PAIRS = [
  { dor: "Print de cada plataforma, planilha e PDF montado toda semana.", sol: "Contas conectadas por login: o dashboard se atualiza e vira link ou PDF." },
  { dor: "O cliente pergunta: “mas isso é bom?”", sol: "O número que decide o mês fica no topo, com a comparação e o equilíbrio." },
  { dor: "Meta e Google contam a mesma venda.", sol: "Cada plataforma com a sua venda, lado a lado, sem dupla contagem." },
];

export function DorSolucao() {
  return (
    <section id="dor" aria-labelledby="dor-title" className="relative border-t border-line">
      <div className="mx-auto max-w-[1360px] px-4 pt-20 pb-20 sm:px-6 lg:px-10 lg:pt-24">
        <CutReveal as="h2" id="dor-title" className="display text-[clamp(2.1rem,5vw,4rem)] text-fg" lines={["Relatório na mão custa caro.", <span key="a" className="text-accent">E nem sempre o cliente entende.</span>]} />
        <ul className="mt-12 space-y-3">
          {PAIRS.map((p, i) => (
            <li key={p.dor}>
              <Reveal delay={i * 90}>
                <div className="grid items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-4">
                  <p className="flex items-start gap-3 rounded-card border border-line px-4 py-4 text-[16px] leading-snug text-fg-2 sm:px-5">
                    <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-line" aria-hidden>
                      <X size={13} />
                    </span>
                    <span>
                      <span className="sr-only">Hoje: </span>
                      {p.dor}
                    </span>
                  </p>
                  <span className="flex items-center justify-center text-accent" aria-hidden>
                    <ArrowRight size={20} className="hidden md:block" />
                    <ArrowDown size={18} className="md:hidden" />
                  </span>
                  <p className="flex items-start gap-3 rounded-card border border-accent/40 bg-accent-soft/50 px-4 py-4 text-[16px] leading-snug font-medium text-fg sm:px-5">
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
        <a href="#demonstracao" className="mt-8 inline-flex items-center gap-2 text-[15px] font-semibold text-accent hover:underline" data-track="hero_cta" data-track-cta="ver_demonstracao_dor">
          Ver funcionando
          <ArrowDown size={16} aria-hidden />
        </a>
      </div>
    </section>
  );
}
