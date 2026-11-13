"use client";

// Peças comuns do primeiro acesso: o hook que chama a ação do passo, a linha de
// erro, o cartão de escolha e o título de cada passo dentro do modal.

import { ArrowLeft, ArrowRight, CircleAlert, LoaderCircle } from "lucide-react";
import { btn } from "@/components/ui/styles";
import { AgentSpeech } from "./stage/AgentSpeech";
import { useState, useTransition, type ReactNode } from "react";
import type { ActionResult } from "@/server/supabase/errors";

/** Corpo de um passo: rola dentro do modal; o rodapé (Pular, Voltar e o botão principal) fica sempre à vista. */
export const STEP_BODY = "min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 lg:px-10 lg:py-7";

/** Roda a ação do passo; sucesso vira redirect no servidor (ou a tela segue), erro fica na tela. */
export function useStepAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run<T>(action: () => Promise<ActionResult<T>>, onOk?: (data: T) => void) {
    setError(null);
    start(async () => {
      const res = await action();
      if (res && !res.ok) setError(res.error.message);
      else if (res && res.ok) onOk?.(res.data);
    });
  }
  return { pending, error, setError, run };
}

/** O título grande do passo e, no lugar do subtítulo, o agente VYZ falando. */
export function StepTitle({ title, text }: { title: ReactNode; text?: string }) {
  return (
    <header>
      {/* o foco vai para o título de cada passo (leitor de tela anuncia o passo) */}
      <h2 id="passo-titulo" tabIndex={-1} className="display text-[clamp(1.7rem,3.2vw,2.5rem)] leading-[1.05] text-fg outline-none">
        {title}
      </h2>
      {text && <AgentSpeech text={text} />}
    </header>
  );
}

export function ErrorLine({ message }: { message: string | null }) {
  return (
    <p role="alert" aria-live="assertive" className="min-h-0 text-[14px] text-error-fg">
      {message && (
        <span className="inline-flex items-start gap-1.5">
          <CircleAlert size={16} aria-hidden className="mt-0.5 shrink-0" />
          {message}
        </span>
      )}
    </p>
  );
}

/** Cartão de escolha (segmento): a área toda é clicável. */
export function ChoiceCard({
  selected,
  disabled,
  onToggle,
  children,
  badge,
  role = "checkbox",
}: {
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
  children: ReactNode;
  badge?: ReactNode;
  role?: "checkbox" | "radio";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onToggle()}
      className={`group relative flex h-full w-full flex-col items-start gap-3 rounded-card border p-4 text-left transition-[border-color,background-color,transform] duration-200 ease-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        disabled
          ? "cursor-not-allowed border-dashed border-line opacity-60"
          : selected
            ? "border-accent bg-accent-soft/40"
            : "border-line bg-card hover:border-fg-2/60 active:scale-[0.99]"
      }`}
    >
      {badge && <span className="absolute top-3 right-3">{badge}</span>}
      {children}
    </button>
  );
}

type FlowFooterProps = {
  /** "Pular por agora": conclui o primeiro acesso sem criar nada. */
  onSkip: () => void;
  skipping: boolean;
  onBack?: () => void;
  backing?: boolean;
  primaryLabel: string;
  pendingLabel?: string;
  onPrimary: () => void;
  pending: boolean;
  disabled?: boolean;
  error: string | null;
  /** Dica curta ao lado do botão (ex.: por que ele está desligado). */
  hint?: ReactNode;
};

/** Rodapé do modal: "Pular por agora" à esquerda; Voltar e o botão principal à direita. */
export function FlowFooter({ onSkip, skipping, onBack, backing, primaryLabel, pendingLabel = "Salvando…", onPrimary, pending, disabled, error, hint }: FlowFooterProps) {
  const busy = pending || skipping || !!backing;
  return (
    <footer className="border-t border-line bg-bg px-5 py-3.5 sm:px-8 lg:px-10">
      <ErrorLine message={error} />
      {hint && !error && <p className="text-[13px] text-fg-2">{hint}</p>}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <button type="button" onClick={onSkip} disabled={busy} data-skip className="inline-flex h-10 items-center gap-1.5 rounded-control px-2 text-[14px] font-medium text-fg-2 underline-offset-4 outline-none hover:text-fg hover:underline focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50">
          {skipping && <LoaderCircle size={15} aria-hidden className="animate-spin motion-reduce:animate-none" />}
          Pular por agora
        </button>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onBack && (
            <button type="button" onClick={onBack} disabled={busy} className={btn.ghost}>
              {backing ? <LoaderCircle size={16} aria-hidden className="animate-spin motion-reduce:animate-none" /> : <ArrowLeft size={16} aria-hidden />}
              Voltar
            </button>
          )}
          <button type="button" onClick={onPrimary} disabled={busy || disabled} aria-busy={pending} className={btn.primary}>
            {pending && <LoaderCircle size={18} aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {pending ? pendingLabel : primaryLabel}
            {!pending && <ArrowRight size={18} aria-hidden />}
          </button>
        </div>
      </div>
    </footer>
  );
}
