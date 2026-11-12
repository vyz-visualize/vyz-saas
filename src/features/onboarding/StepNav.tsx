"use client";

// Passo a passo no topo do onboarding. Os passos já feitos são botões que
// voltam (o servidor grava o passo); os seguintes ficam travados.

import { Check } from "lucide-react";
import { ONBOARDING_STEPS, STEP_LABEL, stepIndex, type ActiveStep } from "./steps";
import { useGoBack } from "./ui";

export function StepNav({ current }: { current: ActiveStep }) {
  const { pending, go } = useGoBack();
  const at = stepIndex(current);
  return (
    <nav aria-label="Etapas do começo">
      <p className="mb-3 text-[13px] text-fg-2 sm:hidden">
        Passo <span className="tnum font-semibold text-fg">{at + 1}</span> de {ONBOARDING_STEPS.length} · {STEP_LABEL[current]}
      </p>
      <ol className="grid grid-cols-4 gap-1.5 sm:gap-3">
        {ONBOARDING_STEPS.map((step, i) => {
          const done = i < at;
          const active = i === at;
          const content = (
            <>
              <span aria-hidden className={`block h-1 rounded-full transition-colors duration-200 ${done || active ? "bg-accent" : "bg-line"}`} />
              <span className="mt-2 hidden items-center gap-1.5 text-[13px] sm:flex">
                <span
                  aria-hidden
                  className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tnum ${done || active ? "bg-accent text-on-accent" : "border border-line text-fg-2"}`}
                >
                  {done ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span className={active ? "font-semibold text-fg" : done ? "text-fg" : "text-fg-2"}>{STEP_LABEL[step]}</span>
              </span>
              <span className="sr-only">
                {STEP_LABEL[step]}
                {done ? " (concluído, voltar)" : active ? " (atual)" : ""}
              </span>
            </>
          );
          return (
            <li key={step} aria-current={active ? "step" : undefined}>
              {done ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => go(step)}
                  className="block w-full rounded-control text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  {content}
                </button>
              ) : (
                <div>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
