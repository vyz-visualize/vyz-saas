"use client";

// Ponto de entrada do painel: o mascote flutuante.

import { useDragOffset } from "./useDragOffset";
import { m } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAgent } from "./AgentProvider";
import { Mascot } from "./Mascot";

const desktopQuery = (cb: () => void) => {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useDesktop = () => useSyncExternalStore(desktopQuery, () => window.matchMedia("(min-width: 768px)").matches, () => true);

/** No celular, enquanto a pessoa rola (a página ou um painel), o mascote se recolhe na borda e volta 1,2 s depois. */
function useScrollTuck(enabled: boolean): boolean {
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let t: number | undefined;
    const onScroll = () => {
      setTucked(true);
      window.clearTimeout(t);
      t = window.setTimeout(() => setTucked(false), 1200);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.clearTimeout(t);
    };
  }, [enabled]);
  return enabled && tucked;
}

/**
 * Mascote flutuante no canto inferior direito (só no painel). Ao abrir o
 * drawer, ele "voa" até o cabeçalho (mesmo layoutId) e volta ao fechar.
 */
export function AgentFab() {
  const { open, setOpen, mascot } = useAgent();
  const desktop = useDesktop();
  // a pessoa arrasta o botão para onde ele não atrapalha; o lugar fica salvo neste navegador
  const { ref: fabRef, offset, dragging, wasDrag, handlers } = useDragOffset("vyz:agent-fab");
  // celular: recolhe na borda ao rolar (não cobre os números do dashboard)
  const tucked = useScrollTuck(!desktop && !open);
  if (open) return null;
  const size = desktop ? 64 : 56;
  return (
    <div
      ref={fabRef}
      className={`fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 transition-[transform,opacity] duration-300 md:right-7 md:bottom-7 print:hidden ${tucked ? "pointer-events-none opacity-40" : ""}`}
      style={{ transform: `translate(${tucked ? Math.max(offset.x, 0) + 52 : offset.x}px, ${offset.y}px)` }}
      data-recolhido={tucked ? "" : undefined}
    >
      <Tooltip content="Olá, eu sou o VYZ · arraste para mudar de lugar" side="left" disabled={dragging}>
        <button
          type="button"
          {...handlers}
          onClick={() => {
            if (!wasDrag()) setOpen(true);
          }}
          aria-label="Abrir o assistente VYZ"
          data-tour="pergunte"
          className={`group relative inline-flex touch-none items-center justify-center rounded-full outline-none select-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--panel)] ${dragging ? "cursor-grabbing" : "cursor-pointer"}`}
          style={{ width: size, height: size }}
        >
          <m.span layoutId="vyz-mascot" transition={{ type: "spring", stiffness: 260, damping: 28 }} className="block">
            <Mascot state={mascot} size={size} spins />
          </m.span>
        </button>
      </Tooltip>
    </div>
  );
}
