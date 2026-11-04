"use client";

import { MousePointerClick } from "lucide-react";
import { useInView, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CutReveal } from "@/components/motion/CutReveal";
import { Reveal } from "@/components/motion/Reveal";
import { SectionWipe } from "@/components/motion/SectionWipe";
import { PromptHeadline } from "./PromptHeadline";
import { StoryStage, type SceneKey } from "./StoryPanel";
import { WhyCards } from "./WhyCards";
import { SHOW_LANDING_PAGES } from "@/features/marketing/config";

const STEPS = [
  {
    title: "Conecte as contas.",
    text: "Meta e Google por login; GA4 e mais plataformas em breve.",
  },
  {
    title: "Escolha o template.",
    text: "E-commerce ou imobiliário, desenhados a partir das decisões que cada negócio toma toda semana.",
  },
  {
    title: "Mande para o cliente.",
    text: "Link compartilhável e PDF, com o número que decide o mês no topo.",
  },
];

/** Passo ativo numa faixa central da viewport, com histerese de 120 ms. */
function useActiveStep(count: number) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    let timer = 0;
    let candidate = -1;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.step);
          if (i === candidate) continue;
          candidate = i;
          window.clearTimeout(timer);
          // só troca se o passo continuar na faixa por 120 ms (sem troca dupla)
          timer = window.setTimeout(() => setActive(candidate), 120);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.slice(0, count).forEach((el) => el && io.observe(el));
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [count]);
  return { active, refs };
}

/** Desktop (com sticky) ou celular (painéis inline). */
function useDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );
}

/**
 * Troca automática de template no passo 2: só com o passo visível, o usuário
 * parado há 1 s e antes do primeiro clique nos chips.
 */
function useAutoTemplate(enabled: boolean, onTick: () => void) {
  const tickRef = useRef(onTick);
  useEffect(() => {
    tickRef.current = onTick;
  }, [onTick]);
  useEffect(() => {
    if (!enabled) return;
    let lastScroll = performance.now();
    let lastSwitch = performance.now();
    const onScroll = () => {
      lastScroll = performance.now();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const iv = window.setInterval(() => {
      const now = performance.now();
      if (now - lastScroll >= 1000 && now - lastSwitch >= 3500) {
        lastSwitch = now;
        tickRef.current();
      }
    }, 250);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearInterval(iv);
    };
  }, [enabled]);
}

/** Painel inline do celular: monta quando chega perto da tela e fica montado. */
function InlineStage({ step, template, onPickTemplate }: { step: number; template: SceneKey; onPickTemplate: (k: SceneKey) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin: "200px 0px" });
  return (
    <div ref={ref} className="mt-6 lg:hidden">
      <StoryStage step={step} mode="inline" ready={near} template={template} onPickTemplate={onPickTemplate} />
    </div>
  );
}

export function ComoFunciona() {
  const { active, refs } = useActiveStep(STEPS.length);
  const desktop = useDesktop();
  const reduce = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const stageSeen = useInView(stageRef, { once: true });
  const [template, setTemplate] = useState<SceneKey>("ecommerce");
  const [manual, setManual] = useState(false);

  const pick = useCallback((k: SceneKey) => {
    setManual(true);
    setTemplate(k);
  }, []);
  const next = useCallback(() => setTemplate((t) => (t === "ecommerce" ? "imob" : "ecommerce")), []);
  // ao sair do passo 2 e voltar, segue do template em que parou (o estado mora aqui).
  // Só no desktop: no celular o painel tem altura natural e a troca empurraria o texto de baixo.
  useAutoTemplate(!manual && !reduce && desktop && stageSeen && active === 1, next);

  return (
    <section id="como-funciona" aria-labelledby="cf-title" className="relative bg-card">
      <SectionWipe />
      <div className="mx-auto max-w-[1360px] px-4 pt-20 pb-24 sm:px-6 lg:px-10 lg:pt-28">
        <p className="label-caps text-fg-2">Como funciona</p>
        <div className="mt-5">
          <PromptHeadline id="cf-title" />
        </div>

        <div className="mt-16 lg:mt-24 lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14">
          <ol className="space-y-14 lg:space-y-0">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                data-step={i}
                className="lg:flex lg:min-h-[85vh] lg:flex-col lg:justify-center"
              >
                <p
                  className={`display text-[4.5rem] tnum transition-colors duration-300 lg:text-[7rem] ${active === i ? "text-accent" : "text-fg-2/40 max-lg:text-accent"}`}
                  aria-hidden
                >
                  0{i + 1}
                </p>
                <h3 className={`title mt-3 text-2xl transition-colors duration-300 lg:text-[2rem] ${active === i ? "text-fg" : "text-fg-2 max-lg:text-fg"}`}>
                  <span className="sr-only">Passo {i + 1}: </span>
                  {s.title}
                </h3>
                <p className="mt-3 max-w-md text-[17px] leading-relaxed text-fg-2">{s.text}</p>
                <InlineStage step={i} template={template} onPickTemplate={pick} />
              </li>
            ))}
          </ol>
          <div className="hidden lg:block">
            {/* o contêiner sticky é fixo: só o conteúdo do passo troca */}
            <div ref={stageRef} className="sticky top-[calc(50vh-min(39vh,360px))] h-[min(78vh,720px)]">
              <StoryStage step={active} mode="sticky" ready={stageSeen} template={template} onPickTemplate={pick} />
            </div>
          </div>
        </div>

        <div className="mt-24 lg:mt-28">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <CutReveal as="h3" className="display text-[clamp(2rem,4.6vw,3.6rem)] text-fg" lines={["Por que o número fecha."]} />
            <p className="rounded-chip border border-line px-2.5 py-0.5 text-[12px] text-fg-2">Amostra · dados fictícios</p>
          </div>
          <div className="mt-8">
            <WhyCards />
          </div>
        </div>

        {SHOW_LANDING_PAGES && (
          <Reveal className="mt-6">
            <div className="flex flex-col gap-4 rounded-card border border-line bg-bg p-5 sm:flex-row sm:items-center sm:p-6">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                <MousePointerClick size={20} aria-hidden />
              </span>
              <p className="text-[16px] leading-relaxed text-fg">
                <strong className="font-semibold">Landing page desenhada e publicada pelo time</strong>, já com o GTM configurado
                (container, tags base e publicação).
              </p>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
