"use client";

// Peças pequenas de interface do painel: aviso de pendência, modal (folha que sobe no
// celular), campos, estado vazio, abas, selo, cabeçalho de página e de seção e cartão de
// número. Tudo pelos tokens: dentro do painel ([data-ui="app"]) ganham os raios e a
// elevação do painel; fora dele, ficam no visual plano da marca.

import { Info, Lock, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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

/** Modal com <dialog> nativo (foco preso e Esc de graça). No celular vira uma folha que sobe do rodapé. */
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
  // Com Cache Components, a página de onde se navegou fica escondida (Activity), não desmontada:
  // um <dialog> modal aberto ali deixaria a página nova inteira inerte (nada clicável). Ao esconder,
  // o diálogo fecha sem avisar quem abriu (o estado continua "aberto"), e o efeito acima reabre se
  // a página voltar a aparecer. Sem o aviso, o StrictMode (que monta duas vezes) também não fecha.
  const silent = useRef(false);
  useLayoutEffect(() => {
    const d = ref.current;
    return () => {
      if (!d?.open) return;
      silent.current = true;
      d.close();
    };
  }, []);
  const size = full ? "h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[1400px] max-sm:h-[calc(100dvh-1.5rem)]" : wide ? "w-[min(920px,calc(100vw-2rem))]" : "w-[min(520px,calc(100vw-2rem))]";
  return (
    <dialog
      ref={ref}
      // o evento close chega depois (assíncrono): o fechamento ao esconder a página não conta
      onClose={() => {
        if (silent.current) silent.current = false;
        else onClose();
      }}
      // Esc com um popover aberto fecha só o popover
      onCancel={(e) => ref.current?.querySelector("[data-radix-popper-content-wrapper]") && e.preventDefault()}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className={`modal m-auto max-h-[calc(100dvh-2rem)] overflow-hidden rounded-[calc(var(--r-card)+4px)] border border-line bg-bg p-0 text-fg shadow-pop backdrop:bg-black/50 max-sm:mx-0 max-sm:mt-auto max-sm:mb-0 max-sm:max-h-[calc(100dvh-1.5rem)] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 ${size}`}
    >
      {open && (
        // altura cheia só no modal de tela cheia: num <dialog> de altura automática, o WebKit lê 100% como 0 e o modal some
        <div className={`flex max-h-[calc(100dvh-2rem)] flex-col max-sm:max-h-[calc(100dvh-1.5rem)] ${full ? "h-full" : ""}`}>
          <span aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line sm:hidden" />
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 max-sm:pt-2">
            <h2 className="min-w-0 truncate text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Fechar" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg">
              <X size={18} aria-hidden />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
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
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      <div
        className={`flex h-10 items-center rounded-control border bg-field text-[14px] transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent max-sm:h-11 max-sm:text-[16px] ${error ? "border-error" : "border-line hover:border-fg-2/50"} ${disabled ? "opacity-50" : ""}`}
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
    <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-[color-mix(in_srgb,var(--card)_55%,transparent)] px-6 py-12 text-center sm:py-16">
      <svg viewBox="0 0 120 80" className="w-32 text-accent" aria-hidden>
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
      <h2 className="mt-6 text-[19px] font-semibold tracking-[-0.015em]">{title}</h2>
      <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-fg-2">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/** Abas em trilho: a ativa é um cartão claro. Rola de lado quando não cabe (celular). */
export function Tabs<T extends string>({ items, value, onChange, label }: { items: { value: T; label: string; locked?: boolean }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <div role="tablist" aria-label={label} className="inline-flex gap-1 rounded-[calc(var(--r-control)+4px)] bg-surface-2 p-1">
        {items.map((it) => (
          <button
            key={it.value}
            role="tab"
            type="button"
            aria-selected={it.value === value}
            onClick={() => onChange(it.value)}
            className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control px-3.5 text-[13.5px] font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent ${it.value === value ? "bg-card text-fg shadow-card" : "text-fg-2 hover:text-fg"}`}
          >
            {it.label}
            {it.locked && <Lock size={12} aria-hidden className="text-fg-2" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Cabeçalho de página: título, uma linha de contexto e as ações (no celular, as ações ocupam a largura). */
export function PageHeader({ title, text, actions, eyebrow }: { title: string; text?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      <div className="min-w-0">
        {eyebrow && <p className="text-[12.5px] font-medium text-fg-2">{eyebrow}</p>}
        <h1 className={`text-[26px] leading-[1.12] font-bold tracking-[-0.028em] text-balance sm:text-[30px] ${eyebrow ? "mt-1" : ""}`}>{title}</h1>
        {text && <div className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-fg-2">{text}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:[&>*]:flex-1">{actions}</div>}
    </header>
  );
}

/** Título de seção dentro da página, com a ação à direita. */
export function SectionHeader({ title, text, action, id }: { title: string; text?: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 id={id} className="text-[17px] font-semibold tracking-[-0.015em]">
          {title}
        </h2>
        {text && <p className="mt-0.5 text-[13.5px] text-fg-2">{text}</p>}
      </div>
      {action}
    </div>
  );
}

const BADGE_TONE = {
  neutral: "bg-surface-2 text-fg-2",
  accent: "bg-accent-soft text-accent",
  ok: "bg-accent-soft text-fg",
  warn: "bg-[color-mix(in_srgb,var(--color-warning)_20%,transparent)] text-fg",
  error: "bg-error-soft text-error-fg",
  outline: "border border-line text-fg-2",
  dashed: "border border-dashed border-line text-fg-2",
} as const;
export type BadgeTone = keyof typeof BADGE_TONE;

/** Selo curto (situação, plano, contagem). */
export function Badge({ children, tone = "neutral", className = "", title }: { children: ReactNode; tone?: BadgeTone; className?: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-[11.5px] leading-snug font-medium whitespace-nowrap ${BADGE_TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** Cartão de número: rótulo, valor grande e uma linha de apoio. */
export function StatTile({ label, value, hint, icon, className = "" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line bg-card p-4 shadow-card sm:p-5 ${className}`}>
      <p className="flex items-center justify-between gap-2 text-[12.5px] font-medium text-fg-2">
        <span className="truncate">{label}</span>
        {icon && <span className="shrink-0 text-fg-2/70">{icon}</span>}
      </p>
      <p className="mt-2 text-[24px] leading-none font-bold tracking-[-0.025em] tnum sm:text-[28px]">{value}</p>
      {hint && <p className="mt-2 text-[12px] leading-snug text-fg-2">{hint}</p>}
    </div>
  );
}

/** Rodapé de ações de um modal: à direita no computador; no celular, em largura cheia com a principal em cima. */
export function ModalActions({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end ${className}`}>{children}</div>;
}
