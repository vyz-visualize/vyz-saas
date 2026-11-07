// Faixa "Em breve": as análises que vão além do dashboard. Compacta, cada card com um
// movimento próprio em CSS (pausado fora da tela; parado com "reduzir movimento").

import { CutReveal } from "@/components/motion/CutReveal";
import { PlayWhenVisible } from "./PlayWhenVisible";
import { SoonBadge } from "./SoonBadge";

/** MMM: as fatias de cada canal se redistribuindo. */
function MmmArt() {
  const parts = [
    { label: "Meta", c: "bg-accent", cls: "mmm-a" },
    { label: "Google", c: "bg-accent/60", cls: "mmm-b" },
    { label: "Outros", c: "bg-fg/20", cls: "mmm-c" },
  ];
  return (
    <div aria-hidden className="w-full space-y-2.5">
      <div className="flex h-7 overflow-hidden rounded-[6px]">
        {parts.map((p) => (
          <span key={p.label} className={`${p.c} ${p.cls} h-full`} />
        ))}
      </div>
      <div className="flex gap-3 text-[11.5px] text-fg-2">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${p.c}`} /> {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Preditiva: a linha se desenhando e a faixa de confiança abrindo. */
function ForecastArt() {
  return (
    <svg aria-hidden viewBox="0 0 200 70" className="h-[70px] w-full overflow-visible">
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
        return <span key={i} className="corr-cell h-[20px] rounded-[4px] bg-accent" style={{ ["--d" as string]: `${(r + c) * 110}ms` }} />;
      })}
    </div>
  );
}

/** Estatística: as barras crescendo e a anomalia em destaque. */
function StatsArt() {
  const bars = [22, 30, 26, 34, 28, 31, 25, 68, 29, 33, 27, 30];
  return (
    <div aria-hidden className="relative flex h-[70px] w-full items-end gap-1">
      <span className="absolute inset-x-0 bottom-[44%] border-t border-dashed border-fg/30" />
      {bars.map((h, i) => (
        <span key={i} className={`stat-bar flex-1 rounded-t-[3px] ${i === 7 ? "stat-anomaly bg-error" : "bg-accent/60"}`} style={{ height: `${h}px`, ["--d" as string]: `${i * 70}ms` }} />
      ))}
    </div>
  );
}

const METHODS = [
  { title: "MMM", text: "Quanto cada canal realmente gerou de receita, além do último clique.", art: <MmmArt /> },
  { title: "Análise preditiva", text: "Projeção de vendas, CPA e ROAS, com faixa de confiança: o fechamento do mês antes do mês fechar.", art: <ForecastArt /> },
  { title: "Correlações", text: "O que anda junto com o resultado: investimento, frequência, criativo, dia da semana.", art: <CorrelationArt /> },
  { title: "Estatística avançada", text: "Uma queda só vira alerta quando é queda de verdade, não variação do dia.", art: <StatsArt /> },
];

export function Inteligencia() {
  return (
    <section id="inteligencia" aria-labelledby="inteligencia-title" className="relative border-t border-line">
      <div className="mx-auto max-w-[1360px] px-4 pt-16 pb-20 sm:px-6 lg:px-10 lg:pt-20">
        <CutReveal as="h2" id="inteligencia-title" className="display text-[clamp(1.9rem,4.2vw,3.2rem)] text-fg" lines={[<span key="a" className="text-accent">Em breve:</span>, "análise que vai além do dashboard."]} />
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-fg-2">O que estamos construindo para o VYZ ler as suas contas por você.</p>
        <PlayWhenVisible as="ul" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {METHODS.map((m) => (
            <li key={m.title}>
              <article className="flex h-full flex-col gap-4 rounded-card border border-line bg-card p-5 transition-colors hover:border-accent">
                <div className="flex h-[78px] items-center">{m.art}</div>
                <div>
                  <h3 className="title flex flex-wrap items-center text-[1.15rem] text-fg">
                    {m.title}
                    <SoonBadge />
                  </h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-fg-2">{m.text}</p>
                </div>
              </article>
            </li>
          ))}
        </PlayWhenVisible>
      </div>
    </section>
  );
}
