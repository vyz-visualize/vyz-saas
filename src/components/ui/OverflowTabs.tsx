"use client";

// Abas em largura total, sem rolagem: as que não cabem vão para "Mais". A aba
// aberta fica sempre à vista.

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { FIT_HIDDEN, useFitItems } from "./fit-items";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./Menu";

const GAP = 4;

export function OverflowTabs<T extends string>({ items, value, onChange, label, tourId, variant = "line" }: { items: { value: T; label: string; /** Ícone antes do nome (aba e menu "Mais"). */ icon?: ReactNode }[]; value: T; onChange: (v: T) => void; label: string; /** Alvo do tour do primeiro dashboard (data-tour). */ tourId?: string; /** "pill": aba aberta em cápsula, sem a linha de baixo (barra flutuante do dashboard). */ variant?: "line" | "pill" }) {
  const active = items.findIndex((it) => it.value === value);
  const pill = variant === "pill";
  const { rootRef, moreRef, itemRef, visible } = useFitItems({ count: items.length, gap: GAP, pinned: active });
  const hidden = items.filter((_, i) => !visible.includes(i));

  return (
    <div ref={rootRef} data-tour={tourId} className={`relative flex items-stretch overflow-x-clip ${pill ? "" : "border-b border-line"}`}>
      <div role="tablist" aria-label={label} className="flex min-w-0 flex-1" style={{ gap: GAP }}>
        {items.map((it, i) => (
          <button
            key={it.value}
            ref={itemRef(i)}
            role="tab"
            type="button"
            aria-selected={it.value === value}
            onClick={() => onChange(it.value)}
            className={`inline-flex shrink-0 items-center gap-1.5 font-medium whitespace-nowrap transition-colors duration-150 ${pill ? "rounded-full px-3.5 py-1.5 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-accent" : "px-3 py-2.5 text-[14px]"} ${visible.includes(i) ? "relative" : FIT_HIDDEN} ${it.value === value ? (pill ? "bg-fg text-bg" : "text-fg") : pill ? "text-fg-2 hover:bg-surface-2 hover:text-fg" : "text-fg-2 hover:text-fg"}`}
          >
            {it.icon}
            {it.label}
            {!pill && it.value === value && <span className="absolute inset-x-2 -bottom-px h-[var(--cut)] bg-accent" aria-hidden />}
          </button>
        ))}
      </div>
      <Menu modal={false}>
        <MenuTrigger
          ref={moreRef as React.Ref<HTMLButtonElement>}
          className={`inline-flex shrink-0 items-center gap-1 font-medium whitespace-nowrap text-fg-2 outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent ${pill ? "rounded-full px-3 py-1.5 text-[13.5px]" : "px-3 py-2.5 text-[14px]"} ${hidden.length ? "" : FIT_HIDDEN}`}
        >
          Mais <ChevronDown size={14} aria-hidden />
        </MenuTrigger>
        <MenuContent align="end">
          {hidden.map((it) => (
            <MenuItem key={it.value} icon={it.icon} onSelect={() => onChange(it.value)}>
              {it.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}
