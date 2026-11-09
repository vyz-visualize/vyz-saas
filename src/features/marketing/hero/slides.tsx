"use client";

// Os slides 2 a 4 do hero: vitrines, com dados fixos de amostra da VYZ (sem lista completa de
// métricas nem a tabela inteira do comparativo). Só carregam depois de a página abrir.
// Cada visita reinicia o movimento; com "reduzir movimento", mostram o estado final parado.

import { Lock, MousePointer2, Trophy } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { TEASER_ADS as ads, TEASER_GALLERY, TEASER_ROWS as rows } from "@/features/marketing/demo/compare-teaser-data";
import { FORMAT_LABEL, VyzCreative } from "@/features/marketing/demo/VyzCreatives";
import { VyzFace } from "@/features/marketing/demo/VyzFace";

const COLORS = ["var(--accent)", "#C2703D"] as const;

function SlideHeader({ title }: { title: string }) {
  return (
    <header className="flex items-center justify-between gap-2">
      <Wordmark className="w-[58px] shrink-0 text-accent" decorative />
      <p className="shrink-0 text-[12px] text-fg-2">{title}</p>
    </header>
  );
}

/** Avança os passos nos tempos dados, enquanto o slide está ativo. Parado = último passo. */
function useSteps(active: boolean, times: readonly number[]) {
  const reduce = useReducedMotion();
  const animated = active && !reduce;
  const [step, setStep] = useState(animated ? 0 : times.length);
  useEffect(() => {
    if (!animated) return;
    const ids = times.map((t, i) => window.setTimeout(() => setStep(i + 1), t));
    return () => ids.forEach(window.clearTimeout);
  }, [animated, times]);
  return step;
}

/** O texto sendo digitado, enquanto o slide está ativo. Parado = texto inteiro. */
function useTyped(text: string, active: boolean, msPerChar: number) {
  const reduce = useReducedMotion();
  const animated = active && !reduce;
  const [n, setN] = useState(animated ? 0 : text.length);
  useEffect(() => {
    if (!animated) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) window.clearInterval(id);
    }, msPerChar);
    return () => window.clearInterval(id);
  }, [animated, msPerChar, text.length]);
  return text.slice(0, n);
}

// ---- Criativos -----------------------------------------------------------------------------

export function SlideCreatives() {
  return (
    <div className="@container flex h-full flex-col gap-3 p-3 sm:p-4">
      <SlideHeader title="Criativos · 30 dias" />
      <ul className="grid grid-cols-4 gap-2" aria-label="Galeria de criativos da VYZ">
        {TEASER_GALLERY.map((c) => {
          const chosen = ads.findIndex((a) => a.id === c.id);
          return (
            <li key={c.id} className="min-w-0">
              <span className={`block overflow-hidden rounded-[10px] border-2 ${chosen >= 0 ? "" : "border-transparent opacity-60"}`} style={chosen >= 0 ? { borderColor: COLORS[chosen] } : undefined}>
                <VyzCreative art={c.art} label={c.headline} className="aspect-[84/100] w-full" />
              </span>
              <span className="mt-1 block truncate text-center text-[10.5px] text-fg-2">{FORMAT_LABEL[c.format] ?? c.format}</span>
            </li>
          );
        })}
      </ul>
      {/* os 2 anúncios comparados: no desktop, o nome e a campanha de cada um */}
      <ul className="hidden gap-2 @[560px]:grid @[560px]:grid-cols-2" aria-label="Anúncios comparados">
        {ads.map((ad, i) => (
          <li key={ad.id} className="min-w-0 rounded-[10px] border border-line bg-card px-3 py-2" style={{ borderLeft: `3px solid ${COLORS[i]}` }}>
            <p className="truncate text-[13px] font-semibold text-fg">{ad.name}</p>
            <p className="truncate text-[11.5px] text-fg-2">{ad.campaign}</p>
          </li>
        ))}
      </ul>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-card">
        <table className="w-full table-fixed border-collapse text-[12.5px] tnum @[560px]:text-[13.5px]">
          <caption className="sr-only">Comparativo de 2 anúncios: 4 métricas</caption>
          <colgroup>
            <col className="w-[30%]" />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-2 py-1.5 text-left text-[11px] font-medium text-fg-2 @[560px]:px-3">
                Métrica
              </th>
              {ads.map((ad, i) => (
                <th key={ad.id} scope="col" className="px-2 py-1.5 text-right text-[11px] font-semibold text-fg @[560px]:px-3 @[560px]:text-[11.5px]">
                  <span className="mb-1 ml-auto block h-1 w-8 rounded-full" style={{ background: COLORS[i] }} aria-hidden />
                  <span className="line-clamp-2 [overflow-wrap:anywhere]">{ad.short}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line/60">
                <th scope="row" className="px-2 py-1.5 text-left font-normal text-fg-2 @[560px]:px-3 @[560px]:py-2.5">
                  {r.label}
                </th>
                {r.cells.map((c, i) => (
                  <td key={ads[i].id} className="px-2 py-1.5 text-right @[560px]:px-3 @[560px]:py-2.5">
                    <span className={c.best ? "font-semibold text-accent" : "text-fg"}>
                      {c.best && <Trophy size={12} aria-label="Melhor valor" className="mr-1 inline align-[-2px]" />}
                      {c.text}
                    </span>
                    {c.diff && <span className="block text-[10.5px] whitespace-nowrap text-fg-2">{c.diff}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {/* o resto do comparativo: linhas genéricas desfocadas, sem números de verdade.
            Ocupam o espaço que sobra na caixa, em qualquer largura. */}
        <div className="relative min-h-[64px] flex-1 overflow-hidden">
          <div aria-hidden className="absolute inset-x-0 top-0 space-y-3 px-3 py-3 blur-[3px] select-none">
            {[62, 48, 70, 54, 66, 44, 58, 72, 50, 64].map((w, i) => (
              <div key={i} className="grid grid-cols-[30%_1fr_1fr] items-center gap-3">
                <span className="h-2.5 rounded-full bg-fg/15" style={{ width: `${w}%` }} />
                <span className="ml-auto h-2.5 w-14 rounded-full bg-fg/20" />
                <span className="ml-auto h-2.5 w-12 rounded-full bg-fg/20" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <a href="#planos" className="inline-flex items-center gap-2 rounded-chip border border-line bg-card px-3 py-1 text-[12.5px] font-semibold text-fg outline-none hover:border-accent focus-visible:ring-2 focus-visible:ring-accent">
              <Lock size={13} aria-hidden className="text-accent" />
              Comparativo completo no Avançado
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Agente VYZ ----------------------------------------------------------------------------

const QUESTION = "Qual campanha teve o melhor ROAS?";
const AGENT_BARS = [
  { name: "Viu a demonstração", roas: "5,23", width: 100 },
  { name: "Gestores de tráfego", roas: "2,92", width: 56 },
  { name: "Lookalike assinantes", roas: "2,52", width: 48 },
];
const AGENT_TIMES = [1750, 2550] as const;

export function SlideAgent({ active }: { active: boolean }) {
  const typed = useTyped(QUESTION, active, 42);
  const step = useSteps(active, AGENT_TIMES);
  const thinking = step === 1;
  const answered = step >= 2;
  return (
    <div className="@container flex h-full flex-col gap-3 p-3 sm:p-4">
      <SlideHeader title="Agente VYZ" />
      <div className="flex items-center gap-3 rounded-card bg-deep p-3 text-offwhite sm:gap-4 sm:p-4">
        <VyzFace mood={thinking ? "thinking" : answered ? "speaking" : "idle"} size={64} />
        <div>
          <p className="label-caps text-[10.5px] text-sage">Seu assistente</p>
          <p className="display text-[1.9rem] leading-none">VYZ</p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 rounded-card border border-line bg-card p-3 sm:p-5">
        <p className="ml-auto max-w-[90%] rounded-[14px] rounded-br-[4px] bg-accent px-3.5 py-2 text-[14px] text-on-accent">
          <span className="sr-only">{QUESTION}</span>
          <span aria-hidden className="inline-block min-h-[1.4em]">
            {typed}
            {typed.length < QUESTION.length && <span className="caret" />}
          </span>
        </p>
        <p aria-hidden className={`flex h-4 items-center gap-1.5 transition-opacity duration-200 ${thinking ? "opacity-100" : "opacity-0"}`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 rounded-full bg-fg-2 motion-safe:animate-pulse" style={{ animationDelay: `${i * 160}ms` }} />
          ))}
        </p>
        {/* a resposta já ocupa o lugar: nada pula quando ela aparece */}
        <div className={`space-y-3 transition-[opacity,transform] duration-500 ease-brand ${answered ? "opacity-100" : "translate-y-2 opacity-0"}`}>
          <p className="text-[14px] leading-relaxed text-fg-2">
            <strong className="font-semibold text-fg">Remarketing · Viu a demonstração</strong>: ROAS de <strong className="font-semibold text-fg tnum">5,23</strong>, acima do equilíbrio de 2,5. Cada R$ 1 investido voltou R$ 5,23 em vendas.
          </p>
          <div className="rounded-[12px] border border-line bg-bg p-3">
            <p className="label-caps text-[10.5px] text-fg-2">ROAS · últimos 30 dias</p>
            <p className="mt-1 text-[1.75rem] leading-none font-bold text-fg tnum">5,23</p>
            <p className="mt-1 text-[12px] text-fg-2">equilíbrio 2,5</p>
            <ul className="mt-2.5 space-y-1.5 border-t border-line pt-2.5" aria-label="ROAS das campanhas">
              {AGENT_BARS.map((b, i) => (
                <li key={b.name} className="grid grid-cols-[minmax(0,1fr)_32%_auto] items-center gap-2 text-[11.5px]">
                  <span className="text-fg-2">{b.name}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-line/70" aria-hidden>
                    <span className="block h-full origin-left rounded-full bg-accent transition-transform duration-700 ease-brand" style={{ width: `${b.width}%`, opacity: 1 - i * 0.22, transform: answered ? "scaleX(1)" : "scaleX(0)" }} />
                  </span>
                  <span className="font-semibold text-fg tnum">{b.roas}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Link do cliente -----------------------------------------------------------------------

const URL_TEXT = "vyzualize.com.br/r/k3f9w2";
const LINK_KPIS: { label: string; all: string; filtered: string }[] = [
  { label: "Investimento", all: "R$ 109 mil", filtered: "R$ 20,0 mil" },
  { label: "Receita", all: "R$ 364 mil", filtered: "R$ 105 mil" },
  { label: "ROAS", all: "3,34", filtered: "5,23" },
  { label: "Compras", all: "1.391", filtered: "412" },
];
const LINK_ROWS = [
  { name: "Prospecção · Gestores de tráfego", value: "R$ 33.890", roas: "2,92" },
  { name: "Remarketing · Viu a demonstração", value: "R$ 20.010", roas: "5,23" },
  { name: "Prospecção · Lookalike assinantes", value: "R$ 17.013", roas: "2,52" },
];
const TARGET_ROW = 1;
const LINK_BARS = [62, 80, 54, 74, 58, 86, 66, 92, 70, 60, 84, 76];
// passos: a página abre, o cursor aparece, o cursor chega na campanha, o clique filtra
const LINK_TIMES = [1250, 1900, 2750, 3250] as const;

export function SlideLink({ active }: { active: boolean }) {
  const typed = useTyped(URL_TEXT, active, 44);
  const step = useSteps(active, LINK_TIMES);
  const open = step >= 1;
  const showCursor = step >= 2 && step < LINK_TIMES.length + 1;
  const arrived = step >= 3;
  const filtered = step >= 4;
  const box = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLLIElement>(null);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  // onde a campanha está nesta largura: o cursor anda até lá
  useEffect(() => {
    if (!showCursor || target) return;
    const b = box.current?.getBoundingClientRect();
    const r = row.current?.getBoundingClientRect();
    if (b && r) setTarget({ x: r.left - b.left + r.width * 0.42, y: r.top - b.top + r.height * 0.55 });
  }, [showCursor, target]);
  return (
    <div className="@container flex h-full flex-col gap-3 p-3 sm:p-4">
      <SlideHeader title="O que o cliente recebe" />
      <div ref={box} className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-card">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2">
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 rounded-full bg-line" />
            ))}
          </span>
          <span className="min-w-0 flex-1 truncate rounded-full bg-bg px-3 py-1 text-[12px] text-fg-2">
            <span className="sr-only">{URL_TEXT}</span>
            <span aria-hidden>
              {typed}
              {typed.length < URL_TEXT.length && <span className="caret" />}
            </span>
          </span>
        </div>
        <div className={`flex min-h-0 flex-1 flex-col gap-2.5 p-3 transition-[opacity,transform] duration-500 ease-brand sm:gap-3 sm:p-4 ${open ? "opacity-100" : "translate-y-1.5 opacity-0"}`}>
          <div className="flex min-h-6 items-center justify-between gap-2">
            <Wordmark className="w-[44px] shrink-0 text-accent" decorative />
            <span className={`truncate rounded-chip bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-fg transition-opacity duration-300 ${filtered ? "opacity-100" : "opacity-0"}`}>Campanha: Remarketing</span>
          </div>
          <dl className="grid grid-cols-2 gap-2 @[560px]:grid-cols-4">
            {LINK_KPIS.map((k) => (
              <div key={k.label} className="rounded-[10px] border border-line bg-bg px-2.5 py-2">
                <dt className="text-[10px] tracking-[0.08em] text-fg-2 uppercase">{k.label}</dt>
                <dd className="mt-0.5 text-[16px] leading-tight font-bold text-fg tnum">{filtered ? k.filtered : k.all}</dd>
              </div>
            ))}
          </dl>
          <div className="flex min-h-[56px] flex-1 items-end gap-1 rounded-[10px] border border-line bg-bg p-2.5 pt-7 @[560px]:gap-2" aria-hidden>
            {LINK_BARS.map((h, i) => (
              <span key={i} className="flex-1 rounded-t-[3px] bg-accent transition-[height,opacity] duration-500 ease-brand" style={{ height: `${filtered ? h * 0.42 : h}%`, opacity: 0.45 + (i % 3) * 0.2 }} />
            ))}
          </div>
          <ul className="space-y-1" aria-label="Campanhas">
            {LINK_ROWS.map((r, i) => {
              const dim = filtered && i !== TARGET_ROW;
              return (
                <li key={r.name} ref={i === TARGET_ROW ? row : undefined} className={`flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-[12.5px] transition-[background-color,opacity] duration-300 ${dim ? "opacity-40" : ""} ${filtered && i === TARGET_ROW ? "bg-accent-soft" : ""}`}>
                  <span className="truncate text-fg">{r.name}</span>
                  <span className="flex shrink-0 gap-3 text-fg tnum">
                    <span className="hidden @[420px]:inline">{r.value}</span>
                    <span className="font-semibold">{r.roas}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        {/* o cursor sai do canto e anda até a campanha; ao chegar, encolhe no clique */}
        {showCursor && target && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 text-fg transition-transform duration-700 ease-brand"
            style={{ transform: arrived ? `translate(${target.x}px, ${target.y}px) scale(${filtered ? 0.85 : 1})` : `translate(${target.x + 70}px, ${target.y + 80}px)` }}
          >
            <MousePointer2 size={20} fill="currentColor" stroke="var(--bg)" />
          </span>
        )}
      </div>
    </div>
  );
}

