import { Reveal } from "@/components/motion/Reveal";
import { SHOW_LANDING_PAGES } from "@/lib/flags";
import { brl } from "@/lib/format";
import { startingPrice } from "@/features/pricing/pricing";
import { GridBackdrop } from "./GridBackdrop";
import { HeroActions } from "./HeroActions";
import { HeroStage } from "./HeroStage";

export function Hero() {
  return (
    <section id="inicio" aria-labelledby="hero-title" className="relative isolate overflow-hidden pt-24 pb-14 sm:pt-28 lg:pb-20">
      <GridBackdrop />
      {/* o painel ganha mais da dobra e sangra um pouco para fora da grade no desktop */}
      <div className="relative mx-auto grid max-w-[1360px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-10 lg:px-10">
        <div className="flex min-w-0 flex-col justify-center">
          <Reveal trigger="intro">
            <p className="inline-flex max-w-full items-center gap-2 rounded-chip border border-line bg-bg/70 px-3 py-1.5 text-[13px] leading-snug font-medium text-fg-2">
              <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>Para gestores de tráfego e agências{SHOW_LANDING_PAGES ? " · Dashboards e landing pages" : ""}</span>
            </p>
          </Reveal>

          {/* o título aparece de imediato; só o marca-texto se desenha (300 ms) */}
          <h1 id="hero-title" className="display mt-6 text-[clamp(3.1rem,11.5vw,4.6rem)] text-fg sm:text-[clamp(4rem,9vw,5.4rem)] lg:text-[clamp(3.6rem,5.2vw,5.9rem)]">
            <span className="block">Pare de</span>
            <span className="block">montar</span>
            <span className="hl block">relatório</span>
            <span className="block">
              <span className="mark-draw">na mão.</span>
            </span>
          </h1>

          <Reveal trigger="intro" delay={520}>
            <p className="mt-7 max-w-[34rem] text-[17px] leading-relaxed text-fg-2">
              Conecte Meta Ads e Google Ads por login e mande ao cliente um dashboard que ele entende: o número que decide o mês no topo e, com
              um clique numa campanha, o painel inteiro filtra.
              {SHOW_LANDING_PAGES && " Quando a campanha precisar de página, a landing page sai com o GTM configurado."}
            </p>
          </Reveal>

          <Reveal trigger="intro" delay={640}>
            <HeroActions />
            <p className="mt-5 text-sm text-fg-2">
              A partir de <strong className="font-semibold text-fg tnum">{brl(startingPrice("base", "anual"))}/mês</strong> no anual · até 5
              projetos
            </p>
          </Reveal>
        </div>

        <Reveal trigger="intro" delay={300} className="min-w-0 lg:-mr-6 lg:pt-2 xl:-mr-10">
          <HeroStage />
        </Reveal>
      </div>
    </section>
  );
}
