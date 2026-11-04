"use client";

// Dobra "Inteligência": o que vai além do dashboard (MMM, previsão,
// correlações, estatística) e o VYZ, o analista que olha os números todo dia,
// traz o que fazer e responde por texto ou voz. Visuais leves em SVG/CSS.

import { Mic, Sparkles } from "lucide-react";
import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CutReveal } from "@/components/motion/CutReveal";
import { Reveal } from "@/components/motion/Reveal";
import { SectionWipe } from "@/components/motion/SectionWipe";
import { SoonBadge } from "./SoonBadge";

// ---- mini visuais --------------------------------------------------------------

/** MMM: quanto cada canal contribuiu para a receita (barras empilhadas). */
function MmmVisual() {
  const parts = [
    { w: 38, c: "bg-accent", label: "Meta" },
    { w: 27, c: "bg-accent/70", label: "Google" },
    { w: 14, c: "bg-accent/45", label: "TikTok" },
    { w: 21, c: "bg-fg/20", label: "Orgânico" },
  ];
  return (
    <div aria-hidden className="space-y-2">
      <div className="flex h-7 overflow-hidden rounded-[6px]">
        {parts.map((p) => (
          <span key={p.label} className={`${p.c} h-full`} style={{ width: `${p.w}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-fg-2">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5 tnum">
            <span className={`size-2 rounded-full ${p.c}`} /> {p.label} {p.w}%
          </span>
        ))}
      </div>
    </div>
  );
}

/** Previsão: linha real + projeção tracejada com faixa de confiança. */
function ForecastVisual() {
  return (
    <svg aria-hidden viewBox="0 0 200 70" className="h-[70px] w-full">
      <path d="M120 30 C140 24 160 18 198 8 L198 34 C160 40 140 42 120 40 Z" className="fill-accent/15" />
      <path d="M2 58 C20 52 34 56 50 46 S80 40 96 36 S112 32 120 34" className="fill-none stroke-accent" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M120 34 C140 30 160 26 198 20" className="fill-none stroke-accent" strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" />
      <line x1="120" y1="4" x2="120" y2="66" className="stroke-line" strokeDasharray="2 3" />
      <circle cx="120" cy="34" r="4" className="fill-accent" />
    </svg>
  );
}

/** Correlações: matriz de calor pequena. */
function CorrelationVisual() {
  const m = [
    [1, 0.82, 0.31, -0.2],
    [0.82, 1, 0.44, -0.1],
    [0.31, 0.44, 1, 0.6],
    [-0.2, -0.1, 0.6, 1],
  ];
  return (
    <div aria-hidden className="grid w-fit grid-cols-4 gap-1">
      {m.flat().map((v, i) => (
        <span
          key={i}
          className="size-6 rounded-[4px]"
          style={{ background: v >= 0 ? `color-mix(in srgb, var(--accent) ${Math.round(v * 100)}%, transparent)` : `color-mix(in srgb, var(--error-fg) ${Math.round(-v * 100)}%, transparent)` }}
        />
      ))}
    </div>
  );
}

/** Estatística: distribuição com o intervalo de confiança marcado. */
function StatsVisual() {
  const bars = [6, 12, 22, 36, 52, 64, 58, 44, 28, 16, 9, 4];
  return (
    <div aria-hidden className="relative flex h-[70px] items-end gap-1">
      {bars.map((h, i) => (
        <span key={i} className={`flex-1 rounded-t-[3px] ${i >= 3 && i <= 8 ? "bg-accent/70" : "bg-fg/15"}`} style={{ height: `${h}px` }} />
      ))}
      <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-fg/50" />
    </div>
  );
}

const METHODS: { title: string; text: string; visual: ReactNode; soon?: boolean }[] = [
  {
    title: "MMM",
    text: "Marketing Mix Modeling: quanto cada canal realmente gerou de receita, além do último clique. Para saber onde colocar o próximo real.",
    visual: <MmmVisual />,
    soon: true,
  },
  {
    title: "Análise preditiva",
    text: "Projeção de vendas, CPA e ROAS para as próximas semanas, com faixa de confiança. Você vê o fechamento do mês antes do mês fechar.",
    visual: <ForecastVisual />,
    soon: true,
  },
  {
    title: "Correlações",
    text: "O que anda junto com o resultado: investimento, frequência, criativo, dia da semana. O que pesa e o que é ruído.",
    visual: <CorrelationVisual />,
    soon: true,
  },
  {
    title: "Estatística avançada",
    text: "Significância, intervalos e anomalias. Uma queda de ROAS só vira alerta quando é queda de verdade, não variação do dia.",
    visual: <StatsVisual />,
    soon: true,
  },
];

// ---- o VYZ ---------------------------------------------------------------------

const INSIGHTS = [
  { when: "Hoje, 8h", text: "O CPA do Meta subiu 18% em 3 dias no conjunto Remarketing. A frequência passou de 4. Troque o criativo ou amplie o público." },
  { when: "Hoje, 8h", text: "Pela projeção, o mês fecha 12% abaixo da meta de receita. Mover R$ 1.500 do Google Search para Performance Max recupera metade." },
  { when: "Ontem, 8h", text: "O ROAS de terça a quinta é 1,4× o de fim de semana, com 95% de confiança. Vale concentrar a verba nesses dias." },
];

type Mood = "idle" | "thinking" | "speaking";
const CYCLE: Mood[] = ["idle", "thinking", "speaking"];

/** O VYZ no site: a esfera com o rosto do logo, leve (sem o mascote do painel). */
function VyzOrb({ mood, size = 72 }: { mood: Mood; size?: number }) {
  return (
    <span
      aria-hidden
      className={`relative inline-block shrink-0 rounded-full transition-transform duration-500 ease-brand ${mood === "thinking" ? "motion-safe:animate-pulse" : ""}`}
      style={{
        width: size,
        height: size,
        background: "radial-gradient(circle at 32% 28%, color-mix(in srgb, var(--color-sage) 95%, white) 0%, var(--color-sage) 32%, color-mix(in srgb, var(--color-sage) 45%, black) 100%)",
        boxShadow: "inset -6px -8px 16px rgb(0 0 0 / 0.35)",
        transform: mood === "speaking" ? "scale(1.05)" : "scale(1)",
      }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        <polygon points="33,37.5 44,37.5 45.4,46.5 34.4,46.5" fill="var(--color-deep)" />
        <polygon points="67,37.5 56,37.5 54.6,46.5 65.6,46.5" fill="var(--color-deep)" />
        <path d={mood === "speaking" ? "M37.5,55 Q50,61 62.5,55 L60.6,62 Q50,68 39.4,62 Z" : "M37.5,56 Q50,60.5 62.5,56 L60.6,60 Q50,64.2 39.4,60 Z"} fill="var(--color-deep)" className="transition-all duration-300" />
        <ellipse cx="30" cy="24" rx="10" ry="6" fill="white" opacity="0.35" />
      </svg>
    </span>
  );
}

function VyzCard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "0px 0px -20% 0px" });
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);

  // o VYZ "trabalhando": troca o estado e revela um insight por vez
  useEffect(() => {
    if (!inView || reduce) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 2400);
    return () => window.clearInterval(id);
  }, [inView, reduce]);

  const shown = reduce ? INSIGHTS.length : Math.min(INSIGHTS.length, 1 + tick);
  const state = reduce ? "idle" : CYCLE[tick % CYCLE.length];

  return (
    <div ref={ref} className="flex h-full flex-col gap-5 rounded-card bg-deep p-6 text-offwhite sm:p-8">
      <div className="flex items-center gap-4">
        <VyzOrb mood={state} />
        <div>
          <p className="label-caps text-sage">Seu analista</p>
          <h3 className="display text-[clamp(1.9rem,3.6vw,2.6rem)] leading-none">VYZ</h3>
        </div>
      </div>
      <p className="max-w-lg text-[16px] leading-relaxed text-offwhite/85">
        Ele olha as suas contas todo dia, cruza os números e te diz o que fazer. Pergunte qualquer coisa por texto ou por voz: ele responde com os dados do seu cliente.
      </p>

      <ul className="space-y-2.5" aria-label="Exemplos de insights do VYZ">
        {INSIGHTS.map((ins, i) => (
          <li
            key={ins.text}
            className={`rounded-[12px] border border-offwhite/12 bg-offwhite/[0.06] px-4 py-3 transition-[opacity,transform] duration-500 ease-brand ${
              i < shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            }`}
          >
            <p className="flex items-center gap-1.5 text-[11.5px] text-sage">
              <Sparkles size={12} aria-hidden /> {ins.when}
            </p>
            <p className="mt-1 text-[14px] leading-relaxed text-offwhite/90">{ins.text}</p>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center gap-3 rounded-full border border-offwhite/15 bg-offwhite/[0.06] py-2 pr-4 pl-2">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-sage text-deep">
          <Mic size={17} aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px] text-offwhite/80">“VYZ, por que as vendas caíram ontem?”</span>
        <span aria-hidden className="flex h-5 items-center gap-[3px]">
          {[8, 14, 20, 12, 18, 9, 15].map((h, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-sage motion-safe:animate-pulse"
              style={{ height: `${h}px`, animationDelay: `${i * 120}ms` }}
            />
          ))}
        </span>
      </div>
      <p className="text-[12.5px] text-offwhite/60">Chat por texto em todos os planos · conversa por voz no Avançado</p>
    </div>
  );
}

export function Inteligencia() {
  return (
    <section id="inteligencia" aria-labelledby="inteligencia-title" className="relative">
      <SectionWipe />
      <div className="mx-auto max-w-[1360px] px-4 pt-20 pb-24 sm:px-6 lg:px-10 lg:pt-28">
        <p className="label-caps text-fg-2">Inteligência</p>
        <CutReveal
          as="h2"
          id="inteligencia-title"
          className="display mt-5 text-[clamp(2.4rem,6.4vw,5.6rem)] text-fg"
          lineClassName={(i) => (i === 1 ? "text-accent" : "")}
          lines={["Não é só dashboard.", "É análise de verdade."]}
        />
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-fg-2">
          Os métodos que as grandes agências usam para decidir verba, rodando nos dados das suas contas. E um analista que não dorme.
        </p>

        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-4 lg:mt-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <Reveal>
            <VyzCard />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {METHODS.map((m, i) => (
              <Reveal key={m.title} delay={80 + i * 90}>
                <article className="flex h-full flex-col gap-4 rounded-card border border-line bg-card p-5 transition-colors hover:border-accent">
                  <div className="min-h-[70px]">{m.visual}</div>
                  <div>
                    <h3 className="title text-xl text-fg">
                      {m.title}
                      {m.soon && <SoonBadge />}
                    </h3>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-fg-2">{m.text}</p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
