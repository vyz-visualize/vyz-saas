"use client";

// Lado direito do hero: 4 slides com partes do produto (visão geral, criativos, agente e o
// link do cliente), trocando sozinhos a cada 3 s, em loop, sempre: mouse, foco e toque não
// pausam; só para fora da tela, com a aba oculta e com "reduzir movimento". Dentro do painel: em cima, a frase
// do slide e o selo de amostra; embaixo, uma pílula com os 4 ícones, em que o ativo se abre
// com o nome e se preenche durante os 3 s. O código e os dados só carregam depois da primeira
// pintura (o texto do hero é o LCP), num espaço já reservado, para nada pular; os slides 2 a 4
// só depois de a página abrir.

import { GalleryHorizontalEnd, LayoutDashboard, Link2, type LucideIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { SlideLoop } from "@/features/marketing/hero/slide-loop";
import { autoPlays, HERO_SLIDES, nextSlide, prevSlide, SLIDE_MS, swipeDirection } from "@/features/marketing/hero/slides-logic";
import { TiltFrame } from "@/features/marketing/mock/TiltFrame";
import { track } from "@/features/marketing/track";

function Skeleton() {
  return (
    <div className="flex h-full flex-col gap-3 p-4" aria-hidden>
      <div className="flex items-center justify-between">
        <div className="h-9 w-48 rounded-control bg-line/50" />
        <div className="h-8 w-44 rounded-chip bg-line/40" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[118px] rounded-card bg-line/30" />
        ))}
      </div>
      <div className="min-h-0 flex-1 rounded-card bg-line/25" />
    </div>
  );
}

/** O VYZ em miniatura: a esfera com o rosto, parada (o mascote animado fica no slide). */
function MascotIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className="shrink-0">
      <circle cx="50" cy="50" r="48" fill="var(--color-sage)" />
      <polygon points="33,37.5 44,37.5 45.4,46.5 34.4,46.5" fill="var(--color-deep)" />
      <polygon points="67,37.5 56,37.5 54.6,46.5 65.6,46.5" fill="var(--color-deep)" />
      <path d="M37.5,56 Q50,60.5 62.5,56 L60.6,60 Q50,64.2 39.4,60 Z" fill="var(--color-deep)" />
    </svg>
  );
}

const ICONS: Record<(typeof HERO_SLIDES)[number]["id"], LucideIcon | "mascot"> = {
  "visao-geral": LayoutDashboard,
  criativos: GalleryHorizontalEnd,
  agente: "mascot",
  link: Link2,
};

const HeroDashboard = dynamic(() => import("@/features/marketing/demo/HeroDashboard"), { ssr: false, loading: Skeleton });

/** Monta quando o navegador folga e o quadro está perto da tela. */
function useWhenIdleAndNear(ref: React.RefObject<HTMLElement | null>) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let idleId = 0;
    let timerId = 0;
    const idle = typeof window.requestIdleCallback === "function";
    const start = () => {
      const run = () => setGo(true);
      if (idle) idleId = window.requestIdleCallback(run, { timeout: 1500 });
      else timerId = window.setTimeout(run, 200);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (idle) window.cancelIdleCallback(idleId);
      window.clearTimeout(timerId);
    };
  }, [ref]);
  return go;
}

const SlideCreatives = dynamic(() => import("@/features/marketing/hero/slides").then((m) => m.SlideCreatives), { ssr: false, loading: Skeleton });
const SlideAgent = dynamic(() => import("@/features/marketing/hero/slides").then((m) => m.SlideAgent), { ssr: false, loading: Skeleton });
const SlideLink = dynamic(() => import("@/features/marketing/hero/slides").then((m) => m.SlideLink), { ssr: false, loading: Skeleton });

/**
 * Os outros slides só baixam depois de a página abrir (evento load + folga). O código já
 * chega pronto na primeira troca. Um clique na barra antecipa.
 */
function useExtraSlides(go: boolean) {
  const [ready, setReady] = useState(false);
  const started = useRef(false);
  const load = useCallback(() => {
    if (started.current) return;
    started.current = true;
    void import("@/features/marketing/hero/slides").then(() => setReady(true));
  }, []);
  useEffect(() => {
    if (!go) return;
    const idle = typeof window.requestIdleCallback === "function";
    let idleId = 0;
    let timerId = 0;
    const schedule = () => {
      if (idle) idleId = window.requestIdleCallback(load, { timeout: 2000 });
      else timerId = window.setTimeout(load, 300);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idle) window.cancelIdleCallback(idleId);
      window.clearTimeout(timerId);
    };
  }, [go, load]);
  return { ready, load };
}

export function HeroStage() {
  const ref = useRef<HTMLDivElement>(null);
  const go = useWhenIdleAndNear(ref);
  const { ready, load } = useExtraSlides(go);
  const reduce = !!useReducedMotion();

  const [active, setActive] = useState(0);
  // cada visita a um slide o reinicia (key): o movimento começa do zero
  const [visits, setVisits] = useState([0, 0, 0, 0]);
  const [offscreen, setOffscreen] = useState(false);
  const [hidden, setHidden] = useState(false);

  const fills = useRef<(HTMLSpanElement | null)[]>([]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const progress = useRef(0);
  const loop = useRef<SlideLoop | null>(null);

  // o relógio fica fora do React (slide-loop.ts): troca, preenche e segue sozinho depois de
  // cada troca, sem depender de um novo render para reagendar o próximo quadro
  useEffect(() => {
    const clock = new SlideLoop(
      HERO_SLIDES.length,
      SLIDE_MS,
      {
        onChange: (i) => {
          setActive(i);
          // cada visita a um slide o reinicia (key): o movimento começa do zero
          setVisits((v) => v.map((n, k) => (k === i ? n + 1 : n)));
        },
        onProgress: (p) => {
          progress.current = p;
          const fill = fills.current[clock.current];
          if (fill) fill.style.transform = `scaleX(${p})`;
        },
      },
      { now: () => performance.now(), requestFrame: (cb) => requestAnimationFrame(cb), cancelFrame: (id) => cancelAnimationFrame(id) },
    );
    loop.current = clock;
    return () => {
      clock.dispose();
      loop.current = null;
    };
  }, []);

  // só pausa fora da tela ou com a aba oculta. Ao voltar à aba, a posição é conferida na hora
  // (o IntersectionObserver não avisa enquanto a aba está oculta)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => setOffscreen(!entries.some((e) => e.isIntersecting)));
    io.observe(el);
    const check = () => {
      const isHidden = document.visibilityState === "hidden";
      setHidden(isHidden);
      if (isHidden) return;
      const r = el.getBoundingClientRect();
      setOffscreen(r.bottom <= 0 || r.top >= window.innerHeight || r.width === 0);
    };
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
    };
  }, []);

  const playing = autoPlays({ reduced: reduce, ready: go && ready, offscreen, hidden });
  useEffect(() => {
    loop.current?.setPlaying(playing);
  }, [playing]);

  // o preenchimento do novo ativo: no quadro de agora, antes de pintar
  useLayoutEffect(() => {
    const fill = fills.current[active];
    if (fill) fill.style.transform = `scaleX(${progress.current})`;
  }, [active]);

  // clicar num ícone pula para o slide; o loop continua dali (o tempo dele recomeça)
  const choose = (i: number) => {
    load();
    loop.current?.goTo(i);
    track("demo_interacao", { local: "hero", acao: "slide", slide: HERO_SLIDES[i].id });
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const to = e.key === "ArrowRight" ? nextSlide(i) : e.key === "ArrowLeft" ? prevSlide(i) : null;
    if (to === null) return;
    e.preventDefault();
    choose(to);
    tabs.current[to]?.focus();
  };

  return (
    <div
      ref={ref}
      className="@container lg:absolute lg:inset-0"
    >
      {/* os cards do painel são h3: este h2 dá a eles um lugar no sumário do leitor de tela */}
      <h2 className="sr-only">Dashboard de amostra</h2>
      <TiltFrame className="h-full overflow-hidden rounded-card border border-line bg-bg">
        {/* a altura é reservada (CLS 0): no celular e no tablet, fixa; no desktop, a do bloco de
            texto ao lado (o palco ocupa a linha da grade). Todos os slides cabem nela, sem rolagem;
            a pílula fica por cima, numa faixa que os slides deixam livre embaixo. */}
        <div
          data-hero-frame
          className="relative grid h-[var(--hero-h)] touch-pan-y [--hero-h:550px] sm:[--hero-h:600px] lg:h-full"
          onPointerDown={(e) => {
            if (e.pointerType !== "touch") return;
            swipe.current = (e.target as Element).closest("[data-no-swipe]") ? null : { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            if (e.pointerType !== "touch") return;
            const from = swipe.current;
            swipe.current = null;
            if (!from) return;
            const dir = swipeDirection(e.clientX - from.x, e.clientY - from.y);
            if (dir) choose(dir > 0 ? nextSlide(active) : prevSlide(active));
          }}
          onPointerCancel={() => {
            swipe.current = null;
          }}
        >
          {HERO_SLIDES.map((s, i) => {
            const on = i === active;
            return (
              <div
                key={s.id}
                id={`hero-slide-${s.id}`}
                role="tabpanel"
                aria-labelledby={`hero-aba-${s.id}`}
                inert={!on}
                data-hero-slide={s.id}
                className={`flex min-h-0 min-w-0 flex-col overflow-hidden pb-10 transition-[opacity,visibility] duration-500 ease-brand [grid-area:1/1] motion-reduce:transition-none [&>*]:min-h-0 [&>*]:flex-1 ${on ? "visible opacity-100" : "invisible opacity-0"}`}
              >
                {i === 0 && (go ? <HeroDashboard /> : <Skeleton />)}
                {i === 1 && (ready ? <SlideCreatives /> : on && <Skeleton />)}
                {i === 2 && (ready ? <SlideAgent key={visits[2]} active={on} /> : on && <Skeleton />)}
                {i === 3 && (ready ? <SlideLink key={visits[3]} active={on} /> : on && <Skeleton />)}
              </div>
            );
          })}

          {/* em cima: a frase do slide (do tablet para cima) e o selo, no canto do cabeçalho */}
          <div className="pointer-events-none absolute top-3 right-3 flex h-[22px] max-w-[calc(100%-96px)] items-center gap-2.5 sm:top-4 sm:right-4">
            <p className="hidden min-w-0 @[600px]:grid">
              {HERO_SLIDES.map((s, i) => (
                <span
                  key={s.id}
                  aria-hidden={i !== active}
                  className={`truncate text-right text-[11.5px] text-fg-2 transition-opacity duration-300 [grid-area:1/1] motion-reduce:transition-none ${i === active ? "opacity-100" : "opacity-0"}`}
                >
                  {s.hint}
                </span>
              ))}
            </p>
            <span className="hero-glass shrink-0 rounded-chip border border-line px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-fg-2">Amostra · dados fictícios</span>
          </div>

          {/* embaixo: a pílula. O ativo abre com o nome e se preenche durante os 3 s */}
          <div role="tablist" aria-label="Partes do produto" className="hero-glass absolute bottom-2 left-1/2 z-10 flex w-max -translate-x-1/2 items-center gap-0.5 rounded-full border border-line p-1 sm:bottom-2.5">
            {HERO_SLIDES.map((s, i) => {
              const on = i === active;
              const Icon = ICONS[s.id];
              return (
                <button
                  key={s.id}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  id={`hero-aba-${s.id}`}
                  type="button"
                  role="tab"
                  aria-label={s.label}
                  aria-selected={on}
                  aria-controls={`hero-slide-${s.id}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => choose(i)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={`relative flex h-8 min-w-8 items-center justify-center overflow-hidden rounded-full px-2 text-[12px] font-medium outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none ${on ? "bg-fg/[0.07] text-fg" : "text-fg-2 hover:text-fg"}`}
                >
                  {/* o preenchimento corre da esquerda; com "reduzir movimento", não aparece */}
                  <span
                    ref={(el) => {
                      fills.current[i] = el;
                    }}
                    aria-hidden
                    className={`absolute inset-0 origin-left bg-accent/25 motion-reduce:hidden ${on ? "" : "invisible"}`}
                    style={on ? undefined : { transform: "scaleX(0)" }}
                  />
                  <span className="relative flex items-center">
                    {Icon === "mascot" ? <MascotIcon size={16} /> : <Icon size={16} strokeWidth={2} aria-hidden className="shrink-0" />}
                    {/* o nome abre e fecha pela largura (grid 0fr ↔ 1fr): a pílula anima de um item para o outro */}
                    <span aria-hidden className={`grid transition-[grid-template-columns] duration-300 ease-brand motion-reduce:transition-none ${on ? "grid-cols-[1fr]" : "grid-cols-[0fr]"}`}>
                      <span className="overflow-hidden whitespace-nowrap">
                        <span className="block pr-0.5 pl-1.5 @[520px]:hidden">{s.short}</span>
                        <span className="hidden pr-0.5 pl-1.5 @[520px]:block">{s.label}</span>
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </TiltFrame>
    </div>
  );
}
