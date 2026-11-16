"use client";

// Telas de uma aba (paginate em model.ts): a barra embaixo da grade com as setas e uma
// cápsula por tela, com o nome dos blocos dela. Troca pelos botões ou pelo Page Down / Page Up;
// a rodinha do mouse não troca de tela.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { PAGER_H } from "./model";

export function ScreenPager({ count, index, onChange, labels }: { count: number; index: number; onChange: (i: number) => void; labels: string[][] }) {
  const arrow = "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-fg-2 outline-none transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30";
  return (
    <nav aria-label="Telas desta aba" data-screen-pager className="flex items-end justify-center print:hidden" style={{ height: PAGER_H }}>
      <div className="flex max-w-full items-center gap-1 rounded-full border border-line/80 bg-[color-mix(in_srgb,var(--card)_85%,transparent)] p-1 shadow-[0_10px_30px_-18px_rgb(0_0_0/0.6)] backdrop-blur">
        <button type="button" aria-label="Tela anterior" disabled={index === 0} onClick={() => onChange(index - 1)} className={arrow}>
          <ChevronLeft size={16} aria-hidden />
        </button>
        <ol className="flex min-w-0 items-center gap-1">
          {Array.from({ length: count }, (_, i) => {
            const names = labels[i] ?? [];
            const name = names[0] ?? `Tela ${i + 1}`;
            return (
              <li key={i} className="min-w-0">
                <button
                  type="button"
                  aria-current={i === index ? "page" : undefined}
                  title={names.join(" · ")}
                  onClick={() => onChange(i)}
                  className={`flex h-8 max-w-[220px] min-w-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${i === index ? "bg-fg text-bg" : "text-fg-2 hover:bg-surface-2 hover:text-fg"}`}
                >
                  <span className="tnum opacity-70">{i + 1}</span>
                  <span className="truncate">
                    {name}
                    {names.length > 1 ? ` +${names.length - 1}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" aria-label="Próxima tela" disabled={index === count - 1} onClick={() => onChange(index + 1)} className={arrow}>
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        Tela {index + 1} de {count}
      </p>
    </nav>
  );
}

/** Page Down / Page Up trocam de tela (fora de campos de texto e de janelas abertas). A rodinha do mouse não troca: rolar não muda a tela. */
export function useScreenKeys(on: boolean, index: number, count: number, go: (i: number) => void) {
  const state = useRef({ index, count, go });
  useEffect(() => {
    state.current = { index, count, go };
  });

  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.defaultPrevented || t?.closest("input, textarea, select, [contenteditable], dialog[open], [role='dialog']")) return;
      const { index: i, count: n, go: g } = state.current;
      if (e.key === "PageDown" && i < n - 1) {
        e.preventDefault();
        g(i + 1);
      } else if (e.key === "PageUp" && i > 0) {
        e.preventDefault();
        g(i - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [on]);
}
