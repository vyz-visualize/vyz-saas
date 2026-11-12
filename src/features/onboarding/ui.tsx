"use client";

// Peças comuns dos passos: título, rodapé com Voltar/Continuar, erro e o hook
// que chama a Server Action do passo (ela grava e volta para /comecar).

import { ArrowLeft, ArrowRight, CircleAlert, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { btn } from "@/components/ui/styles";
import type { ActionResult } from "@/server/supabase/errors";
import { goToStep } from "@/server/onboarding/actions";
import type { ActiveStep } from "./steps";

/** Roda a action do passo; sucesso vira redirect no servidor, erro fica na tela. */
export function useStepAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(action: () => Promise<ActionResult>) {
    setError(null);
    start(async () => {
      const res = await action();
      if (res && !res.ok) setError(res.error.message);
    });
  }
  return { pending, error, setError, run };
}

/** Ir a um passo anterior: os do banco pelo servidor; o conectar (antes de recursos e marca) só pela URL. */
export function useGoBack() {
  const router = useRouter();
  const nav = useStepAction();
  const [routing, start] = useTransition();
  function go(step: ActiveStep) {
    if (step === "connect" || step === "finish") start(() => router.push("/comecar"));
    else nav.run(() => goToStep(step));
  }
  return { pending: nav.pending || routing, error: nav.error, go };
}

export function StepHeader({ eyebrow, title, text }: { eyebrow: string; title: ReactNode; text?: ReactNode }) {
  return (
    <header className="max-w-2xl">
      <p className="label-caps text-fg-2">{eyebrow}</p>
      <h1 id="passo-titulo" className="display mt-2 text-[clamp(1.75rem,4vw,2.6rem)] text-fg">
        {title}
      </h1>
      {text && <p className="mt-3 text-[15px] leading-relaxed text-fg-2">{text}</p>}
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

type StepFooterProps = {
  /** Passo para onde "Voltar" leva (sem = sem botão). */
  back?: ActiveStep;
  onContinue: () => void;
  continueLabel?: string;
  pendingLabel?: string;
  disabled?: boolean;
  pending: boolean;
  error: string | null;
  /** Ação secundária ao lado (ex.: "Pular por agora"). */
  aside?: ReactNode;
};

/** Rodapé fixo no celular (o botão principal fica sempre à mão). */
export function StepFooter({ back, onContinue, continueLabel = "Continuar", pendingLabel = "Salvando…", disabled, pending, error, aside }: StepFooterProps) {
  const nav = useGoBack();
  const busy = pending || nav.pending;
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-line bg-bg/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
      <ErrorLine message={error ?? nav.error} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        {back ? (
          <button type="button" onClick={() => nav.go(back)} disabled={busy} className={btn.ghost}>
            {nav.pending ? <LoaderCircle size={16} aria-hidden className="animate-spin motion-reduce:animate-none" /> : <ArrowLeft size={16} aria-hidden />}
            Voltar
          </button>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {aside}
          <button type="button" onClick={onContinue} disabled={busy || disabled} aria-busy={pending} className={btn.primary}>
            {pending && <LoaderCircle size={18} aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {pending ? pendingLabel : continueLabel}
            {!pending && <ArrowRight size={18} aria-hidden />}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Cartão de escolha (negócio, plataforma, template): a área toda é clicável. */
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
      className={`group relative flex h-full w-full flex-col items-start gap-3 rounded-card border p-4 text-left transition-[border-color,background-color,transform] duration-200 ease-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:p-5 ${
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
