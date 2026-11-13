"use client";

// Abas em largura total, sem rolagem: as que não cabem vão para "Mais". A aba
// aberta fica sempre à vista.

import { ChevronDown } from "lucide-react";
import { FIT_HIDDEN, useFitItems } from "./fit-items";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "./Menu";

const GAP = 4;

export function OverflowTabs<T extends string>({ items, value, onChange, label, tourId }: { items: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; /** Alvo do tour do primeiro dashboard (data-tour). */ tourId?: string }) {
  const active = items.findIndex((it) => it.value === value);
  const { rootRef, moreRef, itemRef, visible } = useFitItems({ count: items.length, gap: GAP, pinned: active });
  const hidden = items.filter((_, i) => !visible.includes(i));

  return (
    <div ref={rootRef} data-tour={tourId} className="relative flex items-stretch overflow-x-clip border-b border-line">
      <div role="tablist" aria-label={label} className="flex min-w-0 flex-1" style={{ gap: GAP }}>
        {items.map((it, i) => (
          <button
            key={it.value}
            ref={itemRef(i)}
            role="tab"
            type="button"
            aria-selected={it.value === value}
            onClick={() => onChange(it.value)}
            className={`shrink-0 px-3 py-2.5 text-[14px] font-medium whitespace-nowrap transition-colors duration-150 ${visible.includes(i) ? "relative" : FIT_HIDDEN} ${it.value === value ? "text-fg" : "text-fg-2 hover:text-fg"}`}
          >
            {it.label}
            {it.value === value && <span className="absolute inset-x-2 -bottom-px h-[var(--cut)] bg-accent" aria-hidden />}
          </button>
        ))}
      </div>
      <Menu modal={false}>
        <MenuTrigger
          ref={moreRef as React.Ref<HTMLButtonElement>}
          className={`inline-flex shrink-0 items-center gap-1 px-3 py-2.5 text-[14px] font-medium whitespace-nowrap text-fg-2 outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent ${hidden.length ? "" : FIT_HIDDEN}`}
        >
          Mais <ChevronDown size={14} aria-hidden />
        </MenuTrigger>
        <MenuContent align="end">
          {hidden.map((it) => (
            <MenuItem key={it.value} onSelect={() => onChange(it.value)}>
              {it.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}
