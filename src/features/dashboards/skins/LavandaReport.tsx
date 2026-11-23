"use client";

// Lavanda como relatório: a primeira aba vira capítulos em rolagem, com o índice no topo (e as
// outras abas como anexos), o atalho "Mês anterior fechado" e o modo "Apresentar" (um capítulo
// por tela, com as setas do teclado). Os blocos são os mesmos do visual: no Personalizar, a grade
// de sempre (esconder e adicionar valem no relatório; a ordem segue os capítulos).

import { CalendarCheck, ChevronLeft, ChevronRight, Paperclip, Presentation, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PAGES } from "@/features/templates/pages";
import type { PageId } from "@/features/templates/types";
import { PlatformMetricCard } from "../layout/LayoutEditor";
import { parseMetricCardId } from "../layout/model";
import { themeVars, type SkinPalette } from "./bklit-blocks";
import { skinGrid } from "./blocks";
import { SkinGrid, type SkinGridControl } from "./SkinGrid";
import type { MonthReport, SkinProps } from "./shared";

type Tone = { fg: string; fg2: string; line: string; accent: string; accentSoft: string; dark: string; card: string };

type Chapter = { id: string; title: string; question: string; blocks: string[]; layout: "stack" | "four" | "two" | "one" };

function chaptersOf(monthOn: boolean, monthName: string): Chapter[] {
  return [
    { id: "resumo", title: "Resumo", question: "O que aconteceu, numa frase, e o que se destacou.", blocks: ["s-resumo", "s-destaques"], layout: "stack" },
    { id: "numeros", title: "Os números", question: "Quanto custou cada resultado, quanto voltou e onde foi o investimento.", blocks: ["s-cpa", "s-receita", "s-roas", "s-plataformas"], layout: "four" },
    { id: "mudou", title: "O que mudou", question: monthOn ? `O mês contra ${monthName}, e o que explica a diferença.` : "Este período contra o anterior, e quais campanhas explicam a diferença.", blocks: ["s-comparativo", "s-cascata"], layout: "two" },
    { id: "campanhas", title: "Campanhas", question: "Cada campanha com o investimento e o resultado; escolha uma para o detalhe.", blocks: ["s-campanhas"], layout: "one" },
  ];
}

/** Altura de cada bloco no capítulo (rolagem) e na apresentação (uma tela). */
const HEIGHT: Record<Chapter["layout"], { flow: string; present: string; cols: string }> = {
  stack: { flow: "", present: "", cols: "grid gap-4" },
  four: { flow: "h-[300px]", present: "h-[min(46vh,420px)]", cols: "grid grid-cols-1 gap-4 @[560px]:grid-cols-2 @[1000px]:grid-cols-4" },
  two: { flow: "h-[400px]", present: "h-[min(62vh,560px)]", cols: "grid gap-4 @[900px]:grid-cols-2" },
  one: { flow: "@[900px]:h-[600px]", present: "@[900px]:h-[min(70vh,680px)]", cols: "grid" },
};

export function LavandaReport({
  ctx,
  nodes,
  grid,
  hide,
  pages,
  onPage,
  periodLabel,
  month,
  monthOn,
  palette,
  tone: T,
}: {
  ctx: SkinProps["ctx"];
  nodes: Record<string, ReactNode>;
  grid?: SkinGridControl;
  hide: string[];
  pages: PageId[];
  onPage?: (p: PageId) => void;
  periodLabel: string;
  month?: MonthReport;
  monthOn: boolean;
  palette: SkinPalette;
  tone: Tone;
}) {
  const [showing, setShowing] = useState<number | null>(null);
  // no Personalizar, a grade de sempre: esconder e adicionar blocos valem no relatório
  if (grid?.editing) return <SkinGrid skin="lavanda" palette={palette} ctx={ctx} grid={grid} hide={hide} nodes={nodes} />;

  const items = grid?.items ?? skinGrid("lavanda");
  const present = new Set(items.map((i) => i.id).filter((id) => !hide.includes(id)));
  const extras = items.filter((i) => parseMetricCardId(i.id)).map((i) => i.id);
  const chapters = chaptersOf(monthOn, month?.info.beforeLabel ?? "").filter((c) => c.blocks.some((b) => present.has(b)) || (c.id === "numeros" && extras.length > 0));
  const annexes = pages.filter((p) => p !== pages[0]);
  const when = monthOn && month ? `Mês fechado · ${month.info.label}` : periodLabel;

  const body = (c: Chapter, presenting: boolean) => {
    const h = HEIGHT[c.layout];
    const blocks = c.blocks.filter((b) => present.has(b));
    return (
      <div className={h.cols}>
        {blocks.map((b) => (
          <div key={b} className={`min-h-0 min-w-0 [&>*]:h-full [&>*]:min-w-0 ${presenting ? h.present : h.flow}`} data-bloco={b}>
            {nodes[b]}
          </div>
        ))}
        {c.id === "numeros" &&
          extras.map((id) => (
            <div key={id} className="min-w-0">
              <PlatformMetricCard id={id} ds={ctx.ds} profile={ctx.profile} compare={ctx.compare} />
            </div>
          ))}
      </div>
    );
  };

  const heading = (c: Chapter, i: number, big = false) => (
    <header className={big ? "mb-5" : "mb-3"}>
      <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: T.accent }}>
        Capítulo {i + 1}
      </p>
      <h3 className={`font-bold tracking-tight ${big ? "text-[30px]" : "text-[20px]"}`}>{c.title}</h3>
      <p className={big ? "text-[14px]" : "text-[12.5px]"} style={{ color: T.fg2 }}>
        {c.question}
      </p>
    </header>
  );

  return (
    <div style={themeVars(palette)} data-relatorio>
      {/* índice: os capítulos, os anexos (as outras abas), o mês fechado e o apresentar */}
      <nav aria-label="Índice do relatório" className="rounded-[20px] border p-4" style={{ borderColor: T.line, background: T.card }}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="min-w-0 basis-full text-[12px] @[640px]:flex-1 @[640px]:basis-auto" style={{ color: T.fg2 }}>
            <strong className="text-[14px] font-bold" style={{ color: T.fg }}>
              Relatório do período
            </strong>{" "}
            · {when}
          </p>
          {month && (monthOn ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold" style={{ background: "#eeedfd", color: T.accent }} data-mes-fechado="on">
              <CalendarCheck size={15} aria-hidden /> Mês anterior fechado
            </span>
          ) : month.select ? (
            <button type="button" onClick={month.select} className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold" style={{ borderColor: T.accentSoft, color: T.accent }} data-mes-fechado="off" title={`Troca o período para ${month.info.label}, comparado com ${month.info.beforeLabel}`}>
              <CalendarCheck size={15} aria-hidden /> Mês anterior fechado
            </button>
          ) : null)}
          {onPage && chapters.length > 0 && (
            <button type="button" onClick={() => setShowing(0)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-semibold text-white" style={{ background: T.accent }}>
              <Presentation size={15} aria-hidden /> Apresentar
            </button>
          )}
        </div>
        <ol className="mt-3 flex flex-wrap gap-1.5">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => document.getElementById(`capitulo-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium"
                style={{ background: "#f2f3f8", color: T.fg }}
              >
                <span className="font-bold tnum" style={{ color: T.accent }}>{i + 1}</span> {c.title}
              </button>
            </li>
          ))}
        </ol>
        {annexes.length > 0 && onPage && (
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[11.5px]" style={{ color: T.fg2 }}>
            <Paperclip size={13} aria-hidden /> Anexos:
            {annexes.map((p) => (
              <button key={p} type="button" onClick={() => onPage(p)} className="rounded-full border px-2.5 py-1 text-[11.5px]" style={{ borderColor: T.line, color: T.fg }}>
                {PAGES[p].name}
              </button>
            ))}
          </p>
        )}
      </nav>

      {chapters.map((c, i) => (
        <section key={c.id} id={`capitulo-${c.id}`} className="mt-8 scroll-mt-4" data-capitulo={c.id}>
          {heading(c, i)}
          {body(c, false)}
        </section>
      ))}

      {showing !== null && chapters[showing] && (
        <Presenter count={chapters.length} index={showing} setIndex={setShowing} tone={T} when={when}>
          {heading(chapters[showing], showing, true)}
          {body(chapters[showing], true)}
        </Presenter>
      )}
    </div>
  );
}

/** Um capítulo por tela: setas (ou PageUp/PageDown) trocam, Esc sai. Tela cheia onde o navegador deixa. */
function Presenter({ count, index, setIndex, tone: T, when, children }: { count: number; index: number; setIndex: (i: number | null) => void; tone: Tone; when: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el?.requestFullscreen && !document.fullscreenElement) void el.requestFullscreen().catch(() => {});
    el?.focus();
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") setIndex(Math.min(count - 1, index + 1));
      else if (e.key === "ArrowLeft" || e.key === "PageUp") setIndex(Math.max(0, index - 1));
      else if (e.key === "Escape") setIndex(null);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    // o Esc da tela cheia também sai
    const onFull = () => {
      if (!document.fullscreenElement) setIndex(null);
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("fullscreenchange", onFull);
    };
  }, [count, index, setIndex]);
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Apresentação do relatório: capítulo ${index + 1} de ${count}`} className="@container fixed inset-0 z-[210] flex flex-col overflow-y-auto outline-none" style={{ background: "#f8f9fd", color: T.fg }} data-apresentando>
      <div className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-6 @[900px]:px-10 @[900px]:py-10">
        <p className="mb-4 text-[12px]" style={{ color: T.fg2 }}>
          Relatório do período · {when}
        </p>
        <div key={index} className="m-in">
          {children}
        </div>
      </div>
      <div className="sticky bottom-0 flex items-center justify-center gap-2 py-4">
        <div className="flex items-center gap-1 rounded-full px-2 py-1.5 text-white shadow-lg" style={{ background: T.dark }}>
          <button type="button" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} aria-label="Capítulo anterior" className="grid size-9 place-items-center rounded-full disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
          <span className="px-2 text-[12.5px] tnum">
            {index + 1} de {count}
          </span>
          <button type="button" onClick={() => setIndex(Math.min(count - 1, index + 1))} disabled={index === count - 1} aria-label="Próximo capítulo" className="grid size-9 place-items-center rounded-full disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
          <button type="button" onClick={() => setIndex(null)} aria-label="Sair da apresentação" className="ml-1 grid size-9 place-items-center rounded-full" style={{ background: "rgb(255 255 255 / 0.12)" }}>
            <X size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
