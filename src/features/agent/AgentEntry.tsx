"use client";

// Pontos de entrada do painel: barra "Pergunte ao VYZ… ⌘K" no topo e o mascote flutuante.

import { useDragOffset } from "./useDragOffset";
import { m } from "motion/react";
import { useSyncExternalStore } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAgent } from "./AgentProvider";
import { Mascot } from "./Mascot";

const noop = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const useShortcut = () => (useSyncExternalStore(noop, isMac, () => true) ? "⌘K" : "Ctrl K");

export function AgentBar() {
  const { setOpen } = useAgent();
  const key = useShortcut();
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      data-tour="pergunte"
      aria-keyshortcuts="Meta+K Control+K"
      className="inline-flex h-9 w-56 items-center gap-2 rounded-control border border-line bg-field pr-2 pl-2.5 text-left text-[13px] text-fg-2 outline-none transition-colors hover:border-fg-2/60 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent"
    >
      <Mascot size={18} />
      <span className="flex-1 truncate">Pergunte ao VYZ…</span>
      <kbd className="rounded-[5px] border border-line px-1.5 py-0.5 font-sans text-[11px] text-fg-2">{key}</kbd>
    </button>
  );
}

const desktopQuery = (cb: () => void) => {
  const mq = window.matchMedia("(min-width: 768px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useDesktop = () => useSyncExternalStore(desktopQuery, () => window.matchMedia("(min-width: 768px)").matches, () => true);

/**
 * Mascote flutuante no canto inferior direito (só no painel). Ao abrir o
 * drawer, ele "voa" até o cabeçalho (mesmo layoutId) e volta ao fechar.
 */
export function AgentFab() {
  const { open, setOpen, mascot } = useAgent();
  const desktop = useDesktop();
  // a pessoa arrasta o botão para onde ele não atrapalha; o lugar fica salvo neste navegador
  const { ref: fabRef, offset, dragging, wasDrag, handlers } = useDragOffset("vyz:agent-fab");
  if (open) return null;
  const size = desktop ? 64 : 56;
  return (
    <div
      ref={fabRef}
      className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 md:right-7 md:bottom-7 print:hidden"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
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
