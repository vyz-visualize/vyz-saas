"use client";

// Os visuais dos três passos do "Como funciona", em movimento contínuo e sutil. SVG e CSS
// (sem biblioteca), pausados fora da tela e parados com "reduzir movimento". Altura fixa:
// nada pula.

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { dashboardTemplate } from "@/features/templates/dashboards";

// ---- passo 1: os dados correndo das contas até o painel ----------------------------------

const LINES = [
  { label: "Meta Ads", y: 52, live: true },
  { label: "Google Ads", y: 120, live: true },
  { label: "GA4 em breve", y: 188, live: false },
];
const HUB = { x: 252, y: 40, w: 136, h: 160 };

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

/**
 * O SVG desenha só as linhas e os pulsos; os chips e o painel são HTML posicionado por
 * porcentagem na mesma caixa 400×240 (sem foreignObject: o Safari o desenhava fora do lugar).
 */
export function ConnectArt() {
  return (
    <div className="flex h-full items-center justify-center" role="img" aria-label="Meta Ads e Google Ads conectados ao seu painel; GA4 e outras plataformas em breve">
      <div className="@container relative aspect-[400/240] max-h-full w-full max-w-full overflow-hidden" aria-hidden>
        <svg viewBox="0 0 400 240" className="absolute inset-0 h-full w-full">
          {LINES.map((l, i) => {
            const d = `M118,${l.y} C185,${l.y} 185,120 ${HUB.x},120`;
            return (
              <g key={l.label}>
                <path d={d} fill="none" stroke={l.live ? "var(--accent)" : "var(--line)"} strokeWidth="1.6" strokeDasharray={l.live ? undefined : "4 5"} />
                {l.live &&
                  [0, 0.9].map((begin) => (
                    <circle key={begin} r="3.4" fill="var(--accent)">
                      <animateMotion dur="1.8s" begin={`${begin + i * 0.3}s`} repeatCount="indefinite" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur="1.8s" begin={`${begin + i * 0.3}s`} repeatCount="indefinite" />
                    </circle>
                  ))}
              </g>
            );
          })}
        </svg>
        {LINES.map((l) => (
          <span
            key={l.label}
            className={`absolute flex items-center justify-center rounded-full text-[3cqw] leading-none font-medium whitespace-nowrap ${l.live ? "bg-accent text-on-accent" : "soon-shimmer border border-line bg-card text-fg-2"}`}
            style={{ left: 0, top: pct(l.y - 15, 240), width: pct(122, 400), height: pct(30, 240) }}
          >
            {l.label}
          </span>
        ))}
        <div className="absolute flex flex-col overflow-hidden rounded-[3cqw] border border-line bg-card p-[2.6cqw]" style={{ left: pct(HUB.x, 400), top: pct(HUB.y, 240), width: pct(HUB.w, 400), height: pct(HUB.h, 240) }}>
          <p className="text-[3cqw] leading-tight font-semibold whitespace-nowrap text-fg">Seu painel</p>
          <div className="mt-[2.4cqw] space-y-[2cqw]">
            {[92, 64, 78, 52].map((w, i) => (
              <span key={i} className="block h-[1.6cqw] overflow-hidden rounded-full bg-line/60">
                <span className="fill-loop block h-full rounded-full bg-accent" style={{ width: `${w}%`, opacity: 1 - i * 0.18, ["--d" as string]: `${i * 220}ms` }} />
              </span>
            ))}
          </div>
          <span className="soon-shimmer relative mt-auto flex h-[5.4cqw] max-w-full items-center justify-center rounded-full border border-line text-[2.6cqw] whitespace-nowrap text-fg-2">Mais em breve</span>
        </div>
      </div>
    </div>
  );
}

// ---- passo 2: os modelos se alternando ---------------------------------------------------

const MODELS = ["ecommerce-visao-geral", "leads-visao-geral", "imobiliario-leads", "agencia-carteira", "local-whatsapp", "meta-essencial"]
  .map((id) => dashboardTemplate(id))
  .filter((t): t is NonNullable<typeof t> => !!t);

/** Desenho pequeno e diferente para cada modelo (só a forma, sem números). */
function Shape({ i }: { i: number }) {
  const bars = [62, 80, 45, 70, 55, 88, 40].map((h, k) => ((h + i * 13 + k * 7) % 70) + 25);
  return (
    <div className="mt-3 grid h-[118px] grid-cols-[1.4fr_1fr] gap-2" aria-hidden>
      <div className="flex items-end gap-1 rounded-[8px] border border-line bg-bg p-2">
        {bars.map((h, k) => (
          <span key={k} className="flex-1 rounded-t-[2px] bg-accent" style={{ height: `${h}%`, opacity: 0.45 + (k % 3) * 0.2 }} />
        ))}
      </div>
      <div className="grid gap-2">
        {[0, 1].map((k) => (
          <div key={k} className="rounded-[8px] border border-line bg-bg p-2">
            <span className="block h-1.5 w-1/2 rounded-full bg-fg-2/30" />
            <span className="mt-2 block h-2.5 rounded-full bg-accent" style={{ width: `${40 + ((i * 17 + k * 23) % 50)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TemplatesArt() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!inView || reduce) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % MODELS.length), 2600);
    return () => window.clearInterval(id);
  }, [inView, reduce]);
  const t = MODELS[i];
  return (
    <div ref={ref} className="flex h-full flex-col justify-center px-1" aria-live="off">
      <div key={t.id} className="tpl-in rounded-[12px] border border-line bg-card p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-chip bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-fg">{t.category}</span>
          <span className="text-[11px] text-fg-2 tnum">
            {i + 1} de {MODELS.length}
          </span>
        </div>
        <p className="mt-2 truncate text-[14px] font-semibold text-fg">{t.name}</p>
        <Shape i={i} />
      </div>
      <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
        {MODELS.map((m, k) => (
          <span key={m.id} className={`h-1.5 rounded-full transition-all duration-300 ${k === i ? "w-5 bg-accent" : "w-1.5 bg-line"}`} />
        ))}
      </div>
    </div>
  );
}

// ---- passo 3: o link sendo aberto e o filtro sendo clicado ---------------------------------

// as campanhas da amostra do site (a VYZ anunciando a si mesma), com os mesmos números
const ROWS = [
  { name: "Prospecção · Gestores de tráfego", roas: "2,96" },
  { name: "Remarketing · Viu a demonstração", roas: "5,26" },
  { name: "Prospecção · Lookalike assinantes", roas: "2,53" },
];

export function SendArt() {
  return (
    <div className="send-art relative flex h-full flex-col overflow-hidden rounded-[12px] border border-line bg-card" aria-label="O cliente abre o link e clica numa campanha: o painel filtra" role="img">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="flex gap-1" aria-hidden>
          <span className="size-2 rounded-full bg-line" />
          <span className="size-2 rounded-full bg-line" />
          <span className="size-2 rounded-full bg-line" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-full bg-bg px-2.5 py-1 text-[11.5px] text-fg-2">
          <span className="send-url inline-block overflow-hidden align-bottom whitespace-nowrap">vyzualize.com.br/r/k3f9w2</span>
        </span>
      </div>
      <div className="send-page flex flex-1 flex-col gap-2 p-3" aria-hidden>
        <div className="flex items-center justify-between gap-2">
          <Wordmark className="w-[38px] shrink-0 text-accent" decorative />
          <span className="send-chip rounded-chip bg-accent-soft px-2 py-0.5 text-[10.5px] text-fg">Campanha: Remarketing</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[8px] border border-line bg-bg px-2 py-1.5">
            <p className="text-[9.5px] tracking-[0.08em] text-fg-2 uppercase">Receita</p>
            <p className="relative h-[18px] text-[15px] font-bold text-fg tnum">
              <span className="send-a absolute inset-0">R$ 101 mil</span>
              <span className="send-b absolute inset-0">R$ 41,3 mil</span>
            </p>
          </div>
          <div className="rounded-[8px] border border-line bg-bg px-2 py-1.5">
            <p className="text-[9.5px] tracking-[0.08em] text-fg-2 uppercase">ROAS</p>
            <p className="relative h-[18px] text-[15px] font-bold text-fg tnum">
              <span className="send-a absolute inset-0">2,96</span>
              <span className="send-b absolute inset-0">5,26</span>
            </p>
          </div>
        </div>
        <ul className="space-y-1">
          {ROWS.map((r, i) => (
            <li key={r.name} className={`flex items-center justify-between rounded-[6px] px-2 py-1 text-[11.5px] ${i === 1 ? "send-row" : "send-other"}`}>
              <span className="truncate text-fg">{r.name}</span>
              <span className="font-semibold text-fg tnum">{r.roas}</span>
            </li>
          ))}
        </ul>
      </div>
      <span className="send-cursor pointer-events-none absolute" aria-hidden>
        <svg width="16" height="18" viewBox="0 0 16 18">
          <path d="M1 1 L1 15 L5 11 L8 17 L10.5 16 L7.6 10.2 L13 10.2 Z" fill="var(--fg)" stroke="var(--bg)" strokeWidth="1.2" />
        </svg>
      </span>
    </div>
  );
}
