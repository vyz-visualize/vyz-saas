"use client";

// A explicação de uma métrica, no mesmo padrão do ⓘ do Personalizar: passar o mouse
// mostra, o toque fixa ou tira, e no teclado aparece com o foco. O atributo title do
// navegador não serve aqui porque não existe no toque.

import { Info } from "lucide-react";
import { useState, type FocusEvent, type PointerEvent } from "react";

export function useMetricHelp(label: string) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = pinned || hovered || focused;
  return {
    open,
    button: (
      <button
        type="button"
        data-metric-help
        aria-label={`O que é ${label}`}
        aria-expanded={open}
        onClick={() => setPinned((v) => !v)}
        onPointerEnter={(e: PointerEvent) => e.pointerType === "mouse" && setHovered(true)}
        onPointerLeave={(e: PointerEvent) => e.pointerType === "mouse" && setHovered(false)}
        // só o foco do teclado: no toque, o foco chega junto com o clique e fecharia o que acabou de abrir
        onFocus={(e: FocusEvent<HTMLButtonElement>) => e.currentTarget.matches(":focus-visible") && setFocused(true)}
        onBlur={() => setFocused(false)}
        className="ml-0.5 inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full align-[-2px] text-fg-2 outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent print:hidden"
      >
        <Info size={12} aria-hidden />
      </button>
    ),
  };
}

export function MetricHelpNote({ text }: { text: string }) {
  return (
    <span role="note" data-metric-help-note onClick={(e) => e.stopPropagation()} className="mt-1 block cursor-text text-[10.5px] leading-snug font-normal whitespace-normal text-fg-2">
      {text}
    </span>
  );
}
