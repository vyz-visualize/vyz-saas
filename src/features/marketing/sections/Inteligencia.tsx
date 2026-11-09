// Dobra das análises do plano Avançado: o que vai além do dashboard. Compacta, cada card com
// um movimento próprio em CSS (pausado fora da tela; parado com "reduzir movimento").

import type { ReactNode } from "react";
import { CutReveal } from "@/components/motion/CutReveal";
import { PlayWhenVisible } from "./PlayWhenVisible";

/** Selo discreto do plano, em cada card. */
function PlanoBadge() {
  return <span className="ml-1.5 inline-block rounded-chip border border-line px-1.5 py-px align-[2px] text-[10.5px] leading-tight font-medium whitespace-nowrap text-fg-2 sm:text-[11px]">Avançado</span>;
}

/** MMM: as fatias de cada canal se redistribuindo. */
function MmmArt() {
  const parts = [
    { label: "Meta", c: "bg-accent", cls: "mmm-a" },
    { label: "Google", c: "bg-accent/60", cls: "mmm-b" },
    { label: "Outros", c: "bg-fg/20", cls: "mmm-c" },
  ];
  return (
    <div aria-hidden className="w-full space-y-2.5">
      <div className="flex h-6 overflow-hidden rounded-[6px] sm:h-7">
        {parts.map((p) => (
          <span key={p.label} className={`${p.c} ${p.cls} h-full`} />
        ))}
      </div>
      <div className="flex gap-2 text-[10px] whitespace-nowrap text-fg-2 sm:gap-3 sm:text-[11.5px]">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1 sm:gap-1.5">
            <span className={`size-1.5 rounded-full sm:size-2 ${p.c}`} /> {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Preditiva: a linha se desenhando e a faixa de confiança abrindo. */
function ForecastArt() {
  return (
    <svg aria-hidden viewBox="0 0 200 70" className="h-[52px] w-full overflow-visible sm:h-[70px]">
      <path d="M120 34 C140 28 160 22 198 12 L198 30 C160 38 140 40 120 34 Z" className="forecast-band fill-accent/20" />
      <path d="M2 58 C20 52 34 56 50 46 S80 40 96 36 S112 32 120 34" pathLength={1} className="forecast-line fill-none stroke-accent" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M120 34 C140 30 160 26 198 21" pathLength={1} className="forecast-next fill-none stroke-accent" strokeWidth="2.5" strokeDasharray="0.04 0.04" strokeLinecap="round" />
      <circle cx="120" cy="34" r="4" className="fill-accent" />
    </svg>
  );
}

/** Correlações: as células acendendo em onda. */
function CorrelationArt() {
  return (
    <div aria-hidden className="grid w-full grid-cols-8 gap-1">
      {Array.from({ length: 24 }, (_, i) => {
        const r = Math.floor(i / 8);
        const c = i % 8;
        return <span key={i} className="corr-cell h-[14px] rounded-[3px] bg-accent sm:h-[20px] sm:rounded-[4px]" style={{ ["--d" as string]: `${(r + c) * 110}ms` }} />;
      })}
    </div>
  );
}

/** Estatística: as barras crescendo e a anomalia em destaque. */
function StatsArt() {
  const bars = [22, 30, 26, 34, 28, 31, 25, 68, 29, 33, 27, 30];
  return (
    <div aria-hidden className="relative flex h-[52px] w-full items-end gap-0.5 sm:h-[70px] sm:gap-1">
      <span className="absolute inset-x-0 bottom-[44%] border-t border-dashed border-fg/30" />
      {bars.map((h, i) => (
        <span key={i} className={`stat-bar flex-1 rounded-t-[3px] ${i === 7 ? "stat-anomaly bg-error" : "bg-accent/60"}`} style={{ height: `${Math.round((h / 70) * 100)}%`, ["--d" as string]: `${i * 70}ms` }} />
      ))}
    </div>
  );
}

const METHODS: { title: string; mobileTitle?: string; text: string; short: string; art: ReactNode }[] = [
  { title: "MMM", text: "Quanto cada canal realmente gerou de receita, além do último clique.", short: "Quanto cada canal gerou de verdade.", art: <MmmArt /> },
  { title: "Análise preditiva", mobileTitle: "Previsão", text: "Projeção de vendas, CPA e ROAS, com faixa de confiança: o fechamento do mês antes do mês fechar.", short: "O fechamento do mês antes do fim.", art: <ForecastArt /> },
  { title: "Correlações", text: "O que anda junto com o resultado: investimento, frequência, criativo, dia da semana.", short: "O que anda junto com o resultado.", art: <CorrelationArt /> },
  { title: "Estatística avançada", mobileTitle: "Estatística", text: "Uma queda só vira alerta quando é queda de verdade, não variação do dia.", short: "Alerta só para queda de verdade.", art: <StatsArt /> },
];

export function Inteligencia() {
  return (
    <section id="inteligencia" aria-labelledby="inteligencia-title" className="relative border-t border-line">
      <div className="mx-auto max-w-[1360px] px-4 pt-12 pb-14 sm:px-6 sm:pt-16 sm:pb-20 lg:px-10 lg:pt-20">
        <p className="inline-flex max-w-full items-center gap-2 rounded-chip border border-line bg-bg/70 px-3 py-1.5 text-[13px] leading-snug font-medium text-fg-2">
          <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
          No plano Avançado
        </p>
        <CutReveal as="h2" id="inteligencia-title" className="display mt-5 text-[clamp(1.9rem,4.2vw,3.2rem)] text-fg" lines={["Análise que vai além", <span key="a" className="text-accent">do dashboard.</span>]} />
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-fg-2 sm:mt-4 sm:text-[16px]">O VYZ lê as suas contas por você.</p>
        {/* no celular, grade 2×2 compacta: título, o selo do plano e uma frase curta */}
        <PlayWhenVisible as="ul" className="mt-7 grid grid-cols-2 gap-2.5 sm:mt-10 sm:gap-4 lg:grid-cols-4">
          {METHODS.map((m) => (
            <li key={m.title}>
              <article className="flex h-full flex-col gap-3 rounded-card border border-line bg-card p-3.5 transition-colors hover:border-accent sm:gap-4 sm:p-5">
                <div className="flex h-[56px] items-center overflow-hidden sm:h-[78px]">{m.art}</div>
                <div>
                  <h3 className="title flex flex-wrap items-center text-[15px] text-fg sm:text-[1.15rem]">
                    {m.mobileTitle ? (
                      <>
                        <span className="sm:hidden">{m.mobileTitle}</span>
                        <span className="hidden sm:inline">{m.title}</span>
                      </>
                    ) : (
                      m.title
                    )}
                    <PlanoBadge />
                  </h3>
                  <p className="mt-1 text-[13px] leading-snug text-fg-2 sm:hidden">{m.short}</p>
                  <p className="mt-1.5 hidden text-[14.5px] leading-relaxed text-fg-2 sm:block">{m.text}</p>
                </div>
              </article>
            </li>
          ))}
        </PlayWhenVisible>
      </div>
    </section>
  );
}
