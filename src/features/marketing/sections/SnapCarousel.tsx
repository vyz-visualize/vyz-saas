"use client";

// Carrossel do celular: um card por vez, deslizando (scroll-snap nativo), com pontos.
// A partir do breakpoint vira grade normal e os pontos somem. Sem lib: só CSS e o índice.

import { useReducedMotion } from "motion/react";
import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const LAYOUT = {
  md: {
    track: "-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-pl-6 sm:px-6 md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden",
    item: "w-[86%] shrink-0 snap-start sm:w-[62%] md:w-auto",
    dots: "md:hidden",
  },
  lg: {
    track: "-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-pl-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden",
    item: "w-[86%] shrink-0 snap-start sm:w-[62%] lg:w-auto",
    dots: "lg:hidden",
  },
  // planos: o do meio um pouco mais largo e os cards esticados por igual
  plans: {
    track: "-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-pl-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-[1fr_1.12fr_1fr] lg:items-stretch lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden",
    item: "flex w-[88%] shrink-0 snap-start flex-col sm:w-[62%] lg:w-auto",
    dots: "lg:hidden",
  },
} as const;

export function SnapCarousel({ children, label, itemLabel = "Card", bp = "lg", initial = 0 }: { children: ReactNode; label: string; itemLabel?: string; bp?: keyof typeof LAYOUT; initial?: number }) {
  const items = Children.toArray(children);
  const track = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(initial);
  const reduce = useReducedMotion();
  const L = LAYOUT[bp];

  // o card ativo é o que tem a borda esquerda mais perto do começo da faixa
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const kids = [...el.children] as HTMLElement[];
    const start = el.scrollLeft + kids[0].offsetLeft;
    let best = 0;
    kids.forEach((k, i) => {
      if (Math.abs(k.offsetLeft - start) < Math.abs(kids[best].offsetLeft - start)) best = i;
    });
    // no fim da faixa, o último conta como ativo mesmo sem encostar na borda
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) best = kids.length - 1;
    setActive(best);
  };

  // abre num card do meio (ex.: o plano recomendado), sem animar e antes de pintar.
  // Só a faixa rola na horizontal: a página não se mexe.
  useLayoutEffect(() => {
    const el = track.current;
    if (!el || !initial || el.scrollWidth <= el.clientWidth) return;
    const kids = [...el.children] as HTMLElement[];
    el.scrollLeft = kids[initial].offsetLeft - kids[0].offsetLeft;
  }, [initial]);

  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    const kids = [...el.children] as HTMLElement[];
    el.scrollTo({ left: kids[i].offsetLeft - kids[0].offsetLeft, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div>
      <ul ref={track} onScroll={onScroll} aria-label={label} className={L.track}>
        {items.map((child, i) => (
          <li key={i} className={L.item}>
            {child}
          </li>
        ))}
      </ul>
      <div className={`mt-3 flex justify-center ${L.dots}`}>
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`${itemLabel} ${i + 1} de ${items.length}`}
            aria-current={active === i ? "true" : undefined}
            className="group inline-flex size-7 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className={`h-2 rounded-full transition-all duration-300 ${active === i ? "w-5 bg-accent" : "w-2 bg-fg/25 group-hover:bg-fg/45"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
