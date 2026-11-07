// Dobra "Como funciona": três passos numa tela, cada um com um visual em movimento
// contínuo e sutil (pausado fora da tela). Altura fixa nos visuais: nada pula.

import { ArrowRight } from "lucide-react";
import { CutReveal } from "@/components/motion/CutReveal";
import { Reveal } from "@/components/motion/Reveal";
import { SectionWipe } from "@/components/motion/SectionWipe";
import { btn } from "@/components/ui/styles";
import { ENTITLEMENTS } from "@/features/pricing/entitlements";
import { PlayWhenVisible } from "./PlayWhenVisible";
import { ConnectArt, SendArt, TemplatesArt } from "./StepsArt";

const STEPS = [
  { title: "Conecte as contas.", text: "Meta Ads e Google Ads por login, só com permissão de leitura. GA4 em breve.", art: <ConnectArt /> },
  {
    title: "Escolha o modelo.",
    text: `De ${ENTITLEMENTS.base.dashboardTemplates} a ${ENTITLEMENTS.avancado.dashboardTemplates} modelos por nicho e objetivo, conforme o plano: e-commerce, leads, imobiliário, agência e outros.`,
    art: <TemplatesArt />,
  },
  { title: "Mande para o cliente.", text: "Um link que ele abre e filtra sozinho, ou o PDF. Você decide se ele vê o investimento.", art: <SendArt /> },
];

export function ComoFunciona() {
  return (
    <section id="como-funciona" aria-labelledby="cf-title" className="relative">
      <SectionWipe />
      <div className="mx-auto max-w-[1360px] px-4 pt-20 pb-24 sm:px-6 lg:px-10 lg:pt-28">
        <p className="label-caps text-fg-2">Como funciona</p>
        <CutReveal as="h2" id="cf-title" className="display mt-5 text-[clamp(2.3rem,5.6vw,4.6rem)] text-fg" lines={["Do login ao link do cliente", <span key="a" className="text-accent">em três passos.</span>]} />
        <PlayWhenVisible as="ul" className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-3 lg:gap-5">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 90} className="h-full">
                <article className="flex h-full flex-col rounded-card border border-line bg-card p-4 sm:p-5">
                  <div className="h-[244px] overflow-hidden rounded-[12px] bg-bg p-3" data-step-art>
                    {s.art}
                  </div>
                  <p className="display mt-5 text-[2.6rem] leading-none text-accent tnum" aria-hidden>
                    0{i + 1}
                  </p>
                  <h3 className="title mt-2 text-[1.45rem] text-fg">
                    <span className="sr-only">Passo {i + 1}: </span>
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[16px] leading-relaxed text-fg-2">{s.text}</p>
                </article>
              </Reveal>
            </li>
          ))}
        </PlayWhenVisible>
        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href="#planos" className={`${btn.primary} group`}>
            Ver planos
            <ArrowRight size={18} aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>
          <span className="rounded-chip border border-line px-2.5 py-0.5 text-[12px] text-fg-2">Amostra · dados fictícios</span>
        </div>
      </div>
    </section>
  );
}
