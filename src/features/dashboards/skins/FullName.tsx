"use client";

// Nome longo (campanha, criativo) numa linha só, com reticências: o nome inteiro aparece ao
// passar o mouse (title) e ao tocar, que abre e fecha o nome inteiro (no celular não há hover).

import { useState } from "react";

export function FullName({ text, className = "", lines = 1 }: { text: string; className?: string; /** Linhas antes das reticências. */ lines?: 1 | 2 }) {
  const [open, setOpen] = useState(false);
  const toggle = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setOpen((o) => !o);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      title={text}
      aria-expanded={open}
      aria-label={open ? text : `${text} (toque para ver inteiro)`}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle(e);
        }
      }}
      className={`min-w-0 cursor-pointer outline-none focus-visible:underline ${open ? "block break-words whitespace-normal" : lines === 2 ? "line-clamp-2 break-words" : "block truncate"} ${className}`}
      data-full-name
    >
      {text}
    </span>
  );
}
