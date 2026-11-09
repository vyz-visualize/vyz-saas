"use client";

// Lado direito do hero: 4 slides com partes do produto (visão geral, criativos, agente e o
// link do cliente), trocando sozinhos a cada ~6 s, com barra estilo stories. O código e os
// dados só carregam depois da primeira pintura (o texto do hero é o LCP), num espaço já
// reservado, para nada pular; os slides 2 a 4 só depois de a página abrir.

import { useReducedMotion } from "motion/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
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
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [touching, setTouching] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const [hidden, setHidden] = useState(false);

  const elapsed = useRef(0);
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const goTo = useCallback((i: number) => {
    elapsed.current = 0;
    setActive(i);
    setVisits((v) => v.map((n, k) => (k === i ? n + 1 : n)));
  }, []);

  // fora da tela ou com a aba oculta, a troca pausa
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => setOffscreen(!entries.some((e) => e.isIntersecting)));
    io.observe(el);
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const playing = autoPlays({ reduced: reduce, ready: go && ready, hover, focus, touching, offscreen, hidden });

  // a barra do slide ativo: no quadro de agora, sem precisar de um novo render
  useLayoutEffect(() => {
    const bar = bars.current[active];
    if (bar) bar.style.transform = `scaleX(${reduce ? 1 : Math.min(1, elapsed.current / SLIDE_MS)})`;
  }, [active, reduce]);

  // o tempo do slide anda por requestAnimationFrame, igual em todo navegador
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsed.current += now - last;
      last = now;
      const bar = bars.current[active];
      if (bar) bar.style.transform = `scaleX(${Math.min(1, elapsed.current / SLIDE_MS)})`;
      if (elapsed.current >= SLIDE_MS) {
        goTo(nextSlide(active));
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, goTo, playing]);

  const choose = (i: number) => {
    load();
    goTo(i);
    track("demo_interacao", { local: "hero", acao: "slide", slide: HERO_SLIDES[i].id });
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const to = e.key === "ArrowRight" ? nextSlide(i) : e.key === "ArrowLeft" ? prevSlide(i) : null;
    if (to === null) return;
    e.preventDefault();
    choose(to);
    tabs.current[to]?.focus();
  };

  const current = HERO_SLIDES[active];
  return (
    <div
      ref={ref}
      className="@container"
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
      onFocus={(e) => e.target.matches(":focus-visible") && setFocus(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocus(false)}
    >
      {/* os cards do painel são h3: este h2 dá a eles um lugar no sumário do leitor de tela */}
      <h2 className="sr-only">Dashboard de amostra</h2>
      <TiltFrame className="overflow-hidden rounded-card border border-line bg-bg">
        {/* o esqueleto já ocupa a altura do painel (medida): nada pula quando ele chega.
            A altura muda nos mesmos degraus do painel, pela largura dele (não da tela),
            medidos: celular só com os números; do tablet para cima, 2×2 KPIs abaixo de
            594 px, contas em duas linhas abaixo de 676 px. Filtrar pode crescer o quadro, mas isso
            vem de um clique e não conta como CLS. Os slides ficam empilhados na mesma caixa. */}
        <div
          data-hero-frame
          className="grid min-h-[var(--hero-h)] touch-pan-y [--hero-h:560px] sm:[--hero-h:912px] sm:@max-[675px]:[--hero-h:981px] sm:@max-[593px]:[--hero-h:1112px]"
          onPointerDown={(e) => {
            if (e.pointerType !== "touch") return;
            setTouching(true);
            swipe.current = (e.target as Element).closest("[data-no-swipe]") ? null : { x: e.clientX, y: e.clientY };
          }}
          onPointerUp={(e) => {
            if (e.pointerType !== "touch") return;
            setTouching(false);
            const from = swipe.current;
            swipe.current = null;
            if (!from) return;
            const dir = swipeDirection(e.clientX - from.x, e.clientY - from.y);
            if (dir) choose(dir > 0 ? nextSlide(active) : prevSlide(active));
          }}
          onPointerCancel={() => {
            setTouching(false);
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
                className={`flex min-w-0 flex-col transition-[opacity,visibility] duration-500 ease-brand [grid-area:1/1] motion-reduce:transition-none [&>*]:flex-1 ${on ? "visible opacity-100" : "invisible opacity-0"}`}
              >
                {i === 0 && (go ? <HeroDashboard /> : <Skeleton />)}
                {i === 1 && (ready ? <SlideCreatives /> : on && <Skeleton />)}
                {i === 2 && (ready ? <SlideAgent key={visits[2]} active={on} /> : on && <Skeleton />)}
                {i === 3 && (ready ? <SlideLink key={visits[3]} active={on} /> : on && <Skeleton />)}
              </div>
            );
          })}
        </div>
      </TiltFrame>

      {/* os nomes dos slides, com a barra de progresso (estilo stories) */}
      <div role="tablist" aria-label="Partes do produto" className="mt-2 grid grid-cols-4 gap-1.5">
        {HERO_SLIDES.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            id={`hero-aba-${s.id}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls={`hero-slide-${s.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => choose(i)}
            onKeyDown={(e) => onTabKey(e, i)}
            className="group flex min-h-11 min-w-0 flex-col items-stretch justify-center gap-1.5 rounded-[6px] px-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="block h-[3px] overflow-hidden rounded-full bg-line" aria-hidden>
              <span
                ref={(el) => {
                  bars.current[i] = el;
                }}
                className="block h-full origin-left rounded-full bg-accent"
                // o ativo é controlado pelo relógio; os outros, cheio (já passou) ou vazio
                style={i === active ? undefined : { transform: `scaleX(${i < active ? 1 : 0})` }}
              />
            </span>
            <span className={`text-[11.5px] leading-tight font-medium transition-colors sm:text-[12.5px] ${i === active ? "text-fg" : "text-fg-2 group-hover:text-fg"}`}>{s.label}</span>
          </button>
        ))}
      </div>

      <p className="mt-1.5 flex min-h-6 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12.5px] text-fg-2">
        {/* a dica fala do slide de agora; no celular fica só o selo */}
        <span className="hidden sm:inline">{current.hint}</span>
        <span className="rounded-chip border border-line px-2.5 py-0.5 text-[11px] font-medium">Amostra · dados fictícios</span>
      </p>
    </div>
  );
}
