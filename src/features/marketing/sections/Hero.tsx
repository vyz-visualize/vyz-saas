import { CutReveal } from "@/components/motion/CutReveal";
import { Reveal } from "@/components/motion/Reveal";
import { SHOW_LANDING_PAGES } from "@/features/marketing/config";
import { DashboardMock } from "@/features/marketing/mock/DashboardMock";
import { TiltFrame } from "@/features/marketing/mock/TiltFrame";
import { brl } from "@/lib/format";
import { startingPrice } from "@/features/pricing/pricing";
import { GridBackdrop } from "./GridBackdrop";
import { HeroActions } from "./HeroActions";

export function Hero() {
  return (
    <section id="inicio" aria-labelledby="hero-title" className="relative isolate overflow-hidden pt-24 pb-14 sm:pt-28 lg:pb-20">
      <GridBackdrop />
      <div className="relative mx-auto grid max-w-[1360px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] lg:gap-12 lg:px-10">
        <div className="flex min-w-0 flex-col justify-center">
          <Reveal trigger="intro">
            <p className="inline-flex max-w-full items-center gap-2 rounded-chip border border-line bg-bg/70 px-3 py-1.5 text-[13px] leading-snug font-medium text-fg-2">
              <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>Para gestores de tráfego · {SHOW_LANDING_PAGES ? "Dashboards e landing pages" : "Dashboards"}</span>
            </p>
          </Reveal>

          <CutReveal
            as="h1"
            id="hero-title"
            trigger="intro"
            delay={60}
            stagger={120}
            className="display mt-6 text-[clamp(3.1rem,11.5vw,4.6rem)] text-fg sm:text-[clamp(4rem,9vw,5.4rem)] lg:text-[clamp(4.2rem,6.4vw,7rem)]"
            lines={[
              "Pare de",
              "montar",
              <span key="r" className="hl">
                relatório
              </span>,
              <span key="m" className="strike">
                na mão.
              </span>,
            ]}
          />

          <Reveal trigger="intro" delay={520}>
            <p className="mt-7 max-w-[34rem] text-[17px] leading-relaxed text-fg-2">
              Conecte Meta e Google por login (GA4 em breve) e receba o dashboard do seu cliente com CPA, ROAS e funil no topo, pronto para
              mandar.{SHOW_LANDING_PAGES && " Quando a campanha precisar de página, a landing page sai com o GTM configurado."}
            </p>
          </Reveal>

          <Reveal trigger="intro" delay={640}>
            <HeroActions />
            <p className="mt-5 text-sm text-fg-2">
              A partir de <strong className="font-semibold text-fg tnum">{brl(startingPrice("base", "anual"))}/mês</strong> no anual · 1
              conta conectada
            </p>
          </Reveal>
        </div>

        <Reveal trigger="intro" delay={300} className="min-w-0 lg:pt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <p className="text-[15px] font-semibold text-fg">Dashboards prontos para cada segmento</p>
            <p className="shrink-0 rounded-chip border border-line px-2.5 py-0.5 text-[11px] font-medium text-fg-2">Amostra · dados fictícios</p>
          </div>
          <TiltFrame className="overflow-hidden rounded-card border border-line bg-bg">
            {/* a linha da intro pousa na meta deste preview */}
            <DashboardMock templateId="ecommerce-visao-geral" name="Loja Verde" seed="Loja Verde|ecommerce|dashboard" assemble={false} live markGoal />
          </TiltFrame>
        </Reveal>
      </div>
    </section>
  );
}
