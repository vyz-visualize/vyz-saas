"use client";

// Checkbox, rádio e switch da marca (Brand Showcase, pág. 12) sobre Radix.
// Quadrado de 4 px de raio preenchido no destaque; switch com trilho no
// destaque e bolinha clara (escura no modo escuro). Foco com 2 px.

import { Check } from "lucide-react";
import { Checkbox as C, Switch as Sw } from "radix-ui";
import { useId, type ReactNode } from "react";

const focus = "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

export function CheckboxBox({ checked, onChange, disabled, id, ariaLabel }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; id?: string; ariaLabel?: string }) {
  return (
    <C.Root
      id={id}
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(v) => onChange(v === true)}
      className={`inline-flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] border-fg-2/70 bg-field text-on-accent transition-colors duration-150 data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-50 ${focus}`}
    >
      <C.Indicator>
        <Check size={13} strokeWidth={3} aria-hidden />
      </C.Indicator>
    </C.Root>
  );
}

export function Checkbox({ label, checked, onChange, disabled, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className={`flex items-start gap-2.5 text-[14px] ${disabled ? "opacity-50" : ""}`}>
      <span className="pt-px">
        <CheckboxBox id={id} checked={checked} onChange={onChange} disabled={disabled} />
      </span>
      <label htmlFor={id} className="cursor-pointer select-none">
        {label}
        {hint && <span className="block text-[12px] text-fg-2">{hint}</span>}
      </label>
    </div>
  );
}

export function Switch({ label, checked, onChange, disabled, hint, ariaLabel }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: ReactNode; /** Nome do botão para leitor de tela quando o rótulo visível não basta (ex.: "Ligar Conta X"). */ ariaLabel?: string }) {
  const id = useId();
  return (
    <div className={`flex items-center gap-3 text-[14px] ${disabled ? "opacity-50" : ""}`}>
      <Sw.Root
        id={id}
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-chip border border-line bg-field transition-colors duration-200 data-[state=checked]:border-accent data-[state=checked]:bg-accent ${focus}`}
      >
        <Sw.Thumb className="block size-[18px] translate-x-[2px] rounded-full bg-fg-2 transition-transform duration-200 ease-brand data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-on-accent" />
      </Sw.Root>
      <label htmlFor={id} className="cursor-pointer select-none">
        {label}
        {hint && <span className="block text-[12px] text-fg-2">{hint}</span>}
      </label>
    </div>
  );
}
