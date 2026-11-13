"use client";

// Peças pequenas de interface do painel: aviso de pendência, modal, campos,
// estado vazio, abas e cadeado. Mesmos tokens da LP, sem sombra.

import { Info, Lock, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { PortalContainer } from "./portal";

/** Aviso discreto do que depende de backend, com tooltip. */
export function PendingChip({ label, detail, className = "" }: { label: string; detail?: string; className?: string }) {
  const id = useId();
  return (
    <span className={`group relative inline-flex ${className}`}>
      <span
        tabIndex={0}
        aria-describedby={detail ? id : undefined}
        className="inline-flex items-center gap-1 rounded-chip border border-dashed border-line px-2 py-0.5 text-[11.5px] leading-snug text-fg-2 outline-none focus-visible:border-accent"
      >
        <Info size={12} aria-hidden className="shrink-0" />
        {label}
      </span>
      {detail && (
        <span
          id={id}
          role="tooltip"
          className="pointer-events-none invisible absolute top-full left-0 z-50 mt-1.5 w-64 rounded-control border border-line bg-card p-2.5 text-[12px] leading-snug text-fg opacity-0 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
        >
          {detail}
        </span>
      )}
    </span>
  );
}

export function LockBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-fg">
      <Lock size={11} aria-hidden />
      {label}
    </span>
  );
}

/** Modal com <dialog> nativo (foco preso e Esc de graça). */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  full = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  full?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [host, setHost] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    const d = ref.current;
    setHost(d);
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const size = full ? "h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[1400px]" : wide ? "w-[min(920px,calc(100vw-2rem))]" : "w-[min(520px,calc(100vw-2rem))]";
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // Esc com um popover aberto fecha só o popover
      onCancel={(e) => ref.current?.querySelector("[data-radix-popper-content-wrapper]") && e.preventDefault()}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`m-auto max-h-[calc(100dvh-2rem)] overflow-hidden rounded-card border border-line bg-bg p-0 text-fg backdrop:bg-black/55 ${size}`}
    >
      {open && (
        // altura cheia só no modal de tela cheia: num <dialog> de altura automática, o WebKit lê 100% como 0 e o modal some
        <div className={`flex max-h-[calc(100dvh-2rem)] flex-col ${full ? "h-full" : ""}`}>
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 className="title text-lg">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Fechar" className="inline-flex size-9 items-center justify-center rounded-control border border-line hover:border-accent">
              <X size={18} aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <PortalContainer.Provider value={host}>{children}</PortalContainer.Provider>
          </div>
        </div>
      )}
    </dialog>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  error?: string | null;
  type?: string;
  disabled?: boolean;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email" | "url";
  prefix?: string;
  suffix?: string;
};

export function TextField({ label, value, onChange, placeholder, hint, error, type = "text", disabled, inputMode, prefix, suffix }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      <div
        className={`flex h-10 items-center rounded-control border bg-field text-[14px] transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent ${error ? "border-error" : "border-line"} ${disabled ? "opacity-50" : ""}`}
      >
        {prefix && <span className="pl-3 text-fg-2">{prefix}</span>}
        <input
          id={id}
          type={type}
          value={value}
          disabled={disabled}
          inputMode={inputMode}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-d` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-fg outline-none placeholder:text-fg-2/70"
        />
        {suffix && <span className="pr-3 text-fg-2">{suffix}</span>}
      </div>
      {(error || hint) && (
        <p id={`${id}-d`} className={`text-[12px] ${error ? "text-error-fg" : "text-fg-2"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

// Select e Checkbox moraram aqui com controles nativos; agora são os da marca.
export { SelectField } from "./Select";
export { Checkbox } from "./controls";

/** Estado vazio com ilustração geométrica no estilo da malha do logo. */
export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-line px-6 py-12 text-center">
      <svg viewBox="0 0 120 80" className="w-36 text-accent" aria-hidden>
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1="0" x2="120" y1={i * 10} y2={i * 10} stroke="var(--line)" strokeWidth="0.6" />
        ))}
        {Array.from({ length: 13 }, (_, i) => (
          <line key={`v${i}`} y1="0" y2="80" x1={i * 10} x2={i * 10} stroke="var(--line)" strokeWidth="0.6" />
        ))}
        <rect x="0" y="42" width="120" height="11" fill="var(--accent)" opacity="0.08" />
        <polygon points="40,20 52,20 56,42 44,42" fill="currentColor" />
        <polygon points="80,20 68,20 64,42 76,42" fill="currentColor" />
        <polygon points="45,53 75,53 70,68 50,68" fill="currentColor" />
      </svg>
      <h2 className="title mt-5 text-xl">{title}</h2>
      <p className="mt-2 max-w-md text-[14px] text-fg-2">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ items, value, onChange, label }: { items: { value: T; label: string; locked?: boolean }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          type="button"
          aria-selected={it.value === value}
          onClick={() => onChange(it.value)}
          className={`relative shrink-0 px-3 py-2.5 text-[14px] font-medium whitespace-nowrap transition-colors duration-150 ${it.value === value ? "text-fg" : "text-fg-2 hover:text-fg"}`}
        >
          {it.label}
          {it.value === value && <span className="absolute inset-x-2 -bottom-px h-[var(--cut)] bg-accent" aria-hidden />}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, text, actions, eyebrow }: { title: string; text?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="label-caps text-fg-2">{eyebrow}</p>}
        <h1 className="display mt-1 text-[clamp(1.8rem,3.4vw,2.6rem)]">{title}</h1>
        {text && <div className="mt-2 max-w-2xl text-[14.5px] text-fg-2">{text}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
