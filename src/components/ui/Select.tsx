"use client";

// Select da marca sobre Radix: gatilho de 40 px e 8 px de raio, chevron que
// gira ao abrir; menu no card com 12 px de raio, sem sombra, 4 px do gatilho,
// opções de 36 px com hover suave e check no destaque. Teclado, typeahead e
// desvio de colisão vêm do Radix.

import { Check, ChevronDown } from "lucide-react";
import { Select as S } from "radix-ui";
import { useId } from "react";
import { usePortalContainer } from "./portal";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectProps = {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  /** Rótulo acessível quando não há <label> visível. */
  ariaLabel?: string;
  id?: string;
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
};

export function Select({ value, onChange, options, ariaLabel, id, placeholder, size = "md", className = "", disabled }: SelectProps) {
  const container = usePortalContainer();
  return (
    <S.Root value={value} onValueChange={onChange} disabled={disabled}>
      <S.Trigger
        id={id}
        aria-label={ariaLabel}
        className={`group inline-flex w-full items-center justify-between gap-2 rounded-control border border-line bg-field text-left text-fg outline-none transition-colors duration-150 hover:border-fg-2/60 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent data-[state=open]:border-accent data-[state=open]:ring-1 data-[state=open]:ring-accent disabled:opacity-50 ${size === "sm" ? "h-9 px-2.5 text-[13.5px]" : "h-10 px-3 text-[14px]"} ${className}`}
      >
        <span className="min-w-0 truncate">
          <S.Value placeholder={placeholder} />
        </span>
        <S.Icon asChild>
          <ChevronDown size={16} aria-hidden className="shrink-0 text-fg-2 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </S.Icon>
      </S.Trigger>
      <S.Portal container={container}>
        <S.Content
          position="popper"
          sideOffset={4}
          collisionPadding={8}
          className="pop z-[90] max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-card border border-line bg-card text-fg shadow-pop"
        >
          <S.Viewport className="p-1">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex h-9 cursor-default items-center rounded-control pr-8 pl-2.5 text-[14px] outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent-soft data-[state=checked]:font-semibold"
              >
                <S.ItemText>{o.label}</S.ItemText>
                <S.ItemIndicator className="absolute right-2.5 inline-flex text-accent">
                  <Check size={15} aria-hidden />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}

/** Select com rótulo e dica, no padrão dos campos do painel. */
export function SelectField({ label, hint, ...rest }: Omit<SelectProps, "id" | "ariaLabel"> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      <Select id={id} {...rest} />
      {hint && <p className="text-[12px] text-fg-2">{hint}</p>}
    </div>
  );
}
