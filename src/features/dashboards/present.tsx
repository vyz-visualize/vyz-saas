"use client";

// Modo apresentação: o botão "Apresentar" (DashboardActions) pede e o dashboard aberto entra
// em tela cheia, sem botões de edição. As abas trocam com ← → (ou PageUp e PageDown) e pela
// barrinha embaixo; Esc sai. Onde o navegador não deixa tela cheia (iPhone), o dashboard
// cobre a tela do mesmo jeito. Vale para os modelos de amostra e para os de dados reais.

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Evento da janela: o botão pede, o dashboard escuta (sem amarrar os dois componentes). */
export const PRESENT_EVENT = "vyz:apresentar";

export function usePresentation<P extends string>({ pages, page, setPage, blocked = false }: { pages: readonly P[]; page: P; setPage: (p: P) => void; /** No meio da edição, não entra. */ blocked?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [presenting, setPresenting] = useState(false);

  useEffect(() => {
    const start = () => {
      if (blocked) return;
      setPresenting(true);
      const el = rootRef.current;
      if (el?.requestFullscreen && !document.fullscreenElement) void el.requestFullscreen().catch(() => {});
    };
    window.addEventListener(PRESENT_EVENT, start);
    return () => window.removeEventListener(PRESENT_EVENT, start);
  }, [blocked]);

  useEffect(() => {
    if (!presenting) return;
    // o Esc da tela cheia sai do modo também
    const onFull = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    const onKey = (e: KeyboardEvent) => {
      const i = pages.indexOf(page);
      if (e.key === "ArrowRight" || e.key === "PageDown") setPage(pages[Math.min(pages.length - 1, i + 1)] ?? page);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") setPage(pages[Math.max(0, i - 1)] ?? page);
      else if (e.key === "Escape" && !document.fullscreenElement) setPresenting(false);
      else return;
      e.preventDefault();
    };
    document.addEventListener("fullscreenchange", onFull);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFull);
      window.removeEventListener("keydown", onKey);
    };
  }, [presenting, page, pages, setPage]);

  const stop = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setPresenting(false);
  };
  return { rootRef, presenting, stop };
}

/** Classes do contêiner do dashboard no modo: cobre a tela e rola por dentro. */
export const presentingClass = (framed: boolean) => `fixed inset-0 z-[200] overflow-y-auto bg-bg ${framed ? "" : "p-5 md:p-8"}`;

/** A barrinha do apresentador: discreta, embaixo; aparece inteira ao passar o mouse. */
export function PresenterBar<P extends string>({ pages, page, setPage, name, onStop }: { pages: readonly P[]; page: P; setPage: (p: P) => void; name: (p: P) => string; onStop: () => void }) {
  const i = pages.indexOf(page);
  const nav = "grid size-9 place-items-center rounded-full outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30";
  return (
    <nav aria-label="Apresentação" className="fixed bottom-4 left-1/2 z-[210] flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-card/90 p-1 text-[13px] text-fg opacity-40 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.5)] backdrop-blur transition-opacity duration-300 focus-within:opacity-100 hover:opacity-100 print:hidden">
      <button type="button" aria-label="Aba anterior" disabled={i <= 0} onClick={() => setPage(pages[Math.max(0, i - 1)])} className={nav}>
        <ChevronLeft size={17} aria-hidden />
      </button>
      <span className="min-w-[9rem] px-1 text-center font-medium whitespace-nowrap">
        {name(page)} <span className="text-fg-2 tnum">· {i + 1}/{pages.length}</span>
      </span>
      <button type="button" aria-label="Próxima aba" disabled={i >= pages.length - 1} onClick={() => setPage(pages[Math.min(pages.length - 1, i + 1)])} className={nav}>
        <ChevronRight size={17} aria-hidden />
      </button>
      <span className="mx-1 h-5 w-px bg-line" aria-hidden />
      <button type="button" onClick={onStop} className="flex h-9 items-center gap-1.5 rounded-full px-3 font-medium outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent">
        <X size={15} aria-hidden /> Sair <kbd className="text-[11px] text-fg-2">Esc</kbd>
      </button>
    </nav>
  );
}
