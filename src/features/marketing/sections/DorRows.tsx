"use client";

// As 3 linhas da dobra "Dor → solução", com a coreografia: o problema é riscado e perde força,
// o traço corre pela seta e a solução acende, com um mini-visual. Dispara quando a dobra entra
// na tela, uma linha a cada ~0,6 s; passar o mouse numa linha repete a dela. O estilo-base é o
// estado final: sem JS ou com "reduzir movimento", aparece parado, riscado e destacado.
// Só CSS e SVG (globals.css, "Dor → solução"); os loops só rodam com a dobra na tela.

import { Link2, X } from "lucide-react";
import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useHydrated } from "@/lib/hooks";

// dorCurta/solCurta: o que aparece no celular
export const DOR_PAIRS = [
  {
    dor: "Print de cada plataforma, planilha e PDF montado toda semana.",
    sol: "Contas conectadas por login: o dashboard se atualiza e vira link ou PDF.",
    dorCurta: "Print, planilha e PDF toda semana.",
    solCurta: "Conecta por login e vira link ou PDF.",
    visual: "link",
  },
  {
    dor: "O cliente pergunta: “mas isso é bom?”",
    sol: "O número que decide o mês fica no topo, com a comparação e o equilíbrio.",
    dorCurta: "O cliente pergunta: “isso é bom?”",
    solCurta: "O número do mês, no topo.",
    visual: "roas",
  },
  {
    dor: "Meta e Google contam a mesma venda.",
    sol: "Cada plataforma com a sua venda, lado a lado, sem somar uma na outra.",
    dorCurta: "Meta e Google contam a mesma venda.",
    solCurta: "Cada plataforma com a sua venda.",
    visual: "barras",
  },
] as const;

type Visual = (typeof DOR_PAIRS)[number]["visual"];
type State = "idle" | "play" | "final";

/** Segundos entre uma linha e a seguinte. */
const ROW_GAP = 0.6;
/** Quando a solução acende e o mini-visual aparece, a partir do início da linha. */
const LIGHT_AT = 1.8;
/** Duração da linha: antes disso, passar o mouse não reinicia. */
const ROW_MS = 2800;

const ROAS = 3.34;

/** "ROAS 3,34" contando até o valor. Parado, já mostra o valor. */
function RoasValue({ animate, delay }: { animate: boolean; delay: number }) {
  const [value, setValue] = useState(animate ? 0 : ROAS);
  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    const timer = window.setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / 750);
        setValue(ROAS * (1 - (1 - p) ** 3));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay * 1000);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [animate, delay]);
  return <>{value.toFixed(2).replace(".", ",")}</>;
}

function MiniVisual({ kind, animate, delay }: { kind: Visual; animate: boolean; delay: number }) {
  if (kind === "link") {
    return (
      <span className="flex flex-col items-end gap-1.5" aria-hidden>
        <span className="dor-pop inline-flex max-w-full items-center gap-1 rounded-chip border border-current/25 bg-bg/60 px-2 py-0.5 text-[10.5px] font-medium text-fg" style={{ "--p": "0ms" } as CSSProperties}>
          <Link2 size={11} className="shrink-0" />
          <span className="truncate">vyzualize.com.br/r/…</span>
        </span>
        <span className="dor-pop rounded-chip bg-accent px-2 py-0.5 text-[10.5px] font-semibold text-on-accent" style={{ "--p": "160ms" } as CSSProperties}>
          PDF
        </span>
      </span>
    );
  }
  if (kind === "roas") {
    return (
      <span className="dor-pop block rounded-[10px] border border-current/25 bg-bg/60 px-2.5 py-1.5 text-right text-fg" style={{ "--p": "0ms" } as CSSProperties} aria-hidden>
        <span className="block text-[10px] tracking-[0.08em] uppercase opacity-80">ROAS</span>
        <span className="block text-[20px] leading-tight font-bold tnum">
          <RoasValue animate={animate} delay={delay} />
        </span>
        <span className="block text-[10.5px] opacity-80 tnum">equilíbrio 2,5</span>
      </span>
    );
  }
  const bars = [
    { name: "Meta", value: "642", width: 100, p: "0ms" },
    { name: "Google", value: "470", width: 73, p: "220ms" },
  ];
  return (
    <span className="flex w-full flex-col gap-1.5 text-fg" aria-hidden>
      {bars.map((b) => (
        <span key={b.name} className="dor-pop block" style={{ "--p": b.p } as CSSProperties}>
          <span className="flex justify-between text-[10.5px] font-medium">
            <span>{b.name}</span>
            <span className="tnum">{b.value}</span>
          </span>
          <span className="mt-0.5 block h-1.5 rounded-full bg-fg/15">
            <span className="dor-grow block h-full origin-left rounded-full bg-accent" style={{ width: `${b.width}%`, "--p": b.p } as CSSProperties} />
          </span>
        </span>
      ))}
    </span>
  );
}

/** A seta do meio: traços correndo, o pontinho de luz e a ponta que pulsa. */
function Connector() {
  return (
    <span className="flex h-[68px] items-center justify-center md:h-auto" aria-hidden>
      {/* no celular, a mesma peça girada: aponta para baixo */}
      <span className="dor-arrow relative block h-5 w-16 shrink-0 rotate-90 md:rotate-0">
        <svg viewBox="0 0 64 20" className="size-full overflow-visible text-accent">
          <line x1="1" y1="10" x2="52" y2="10" className="dor-dash" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" />
          <g className="dor-head">
            <path className="dor-head-i" d="M52 4 L62 10 L52 16 Z" fill="currentColor" />
          </g>
        </svg>
        <span className="dor-dot absolute top-[6.5px] left-0 block size-[7px] rounded-full bg-accent" />
      </span>
    </span>
  );
}

function Row({ pair, index, state }: { pair: (typeof DOR_PAIRS)[number]; index: number; state: State }) {
  const [replay, setReplay] = useState(0);
  const started = useRef(0);
  useEffect(() => {
    if (state === "play") started.current = performance.now() + index * ROW_GAP * 1000;
  }, [index, state]);

  // ao repetir, a linha não espera a vez dela: começa na hora
  const rowDelay = replay ? 0 : index * ROW_GAP;
  const animate = state === "play";
  const content: ReactNode = (
    <>
      <p className="dor-prob flex items-center gap-3 rounded-card border border-line px-4 py-3.5 text-[15px] leading-snug text-fg-2 sm:px-5 md:text-[16px]">
        <span className="dor-x inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-line" aria-hidden>
          <X size={13} />
        </span>
        <span className="dor-text min-w-0">
          <span className="sr-only">Hoje: </span>
          <span className="dor-strike">
            <span className="md:hidden">{pair.dorCurta}</span>
            <span className="hidden md:inline">{pair.dor}</span>
          </span>
        </span>
      </p>

      <Connector />

      <div className="dor-sol relative flex items-center gap-3 rounded-card px-4 py-3.5 text-[15px] leading-snug font-medium text-fg sm:px-5 md:text-[16px]">
        {/* a borda luminosa que dá a volta no card */}
        <svg className="dor-border pointer-events-none absolute inset-0 size-full overflow-visible text-accent" aria-hidden>
          <rect className="dor-trace" width="100%" height="100%" rx="12" ry="12" pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {/* o brilho que passa em repouso, um card de cada vez */}
        <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-card" aria-hidden>
          <span className="dor-sheen block size-full" style={{ "--sd": `${4 + index * 6}s` } as CSSProperties} />
        </span>
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden>
          <svg viewBox="0 0 24 24" className="size-[14px]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path className="dor-check" d="M20 6 9 17l-5-5" pathLength={1} />
          </svg>
        </span>
        <span className="relative min-w-0 flex-1">
          <span className="sr-only">Com o VYZ: </span>
          <span className="md:hidden">{pair.solCurta}</span>
          <span className="hidden md:inline">{pair.sol}</span>
        </span>
        <span className="relative flex w-[112px] shrink-0 justify-end lg:w-[156px]">
          <MiniVisual kind={pair.visual} animate={animate} delay={rowDelay + LIGHT_AT} />
        </span>
      </div>
    </>
  );

  return (
    <li
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse" || state !== "play" || performance.now() - started.current < ROW_MS) return;
        started.current = performance.now();
        setReplay((n) => n + 1);
      }}
    >
      {/* key: trocar de estado ou repetir reinicia as animações da linha */}
      <div key={`${state}-${replay}`} data-dor={state} style={{ "--r": `${rowDelay}s` } as CSSProperties} className="grid items-stretch gap-0 md:grid-cols-[minmax(0,1fr)_64px_minmax(0,1.3fr)] md:gap-3">
        {content}
      </div>
    </li>
  );
}

export function DorRows() {
  const list = useRef<HTMLUListElement>(null);
  const entered = useInView(list, { once: true, margin: "0px 0px -15% 0px" });
  const visible = useInView(list, { margin: "120px 0px" });
  // só depois de hidratar: o HTML do servidor não sabe da preferência (o CSS já cuida do visual)
  const hydrated = useHydrated();
  const prefersReduced = useReducedMotion();
  const reduce = hydrated && !!prefersReduced;
  const state: State = reduce ? "final" : entered ? "play" : "idle";
  return (
    // data-live: os loops (traços, pulso e brilho) só rodam com a dobra na tela
    <ul ref={list} data-live={visible && !reduce ? "on" : "off"} className="mt-7 space-y-4 md:mt-12 md:space-y-3">
      {DOR_PAIRS.map((p, i) => (
        <Row key={p.dor} pair={p} index={i} state={state} />
      ))}
    </ul>
  );
}
