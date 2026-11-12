"use client";

// Passo 1: o nicho. Define as métricas e quais layouts aparecem primeiro.

import { Briefcase, Building2, GraduationCap, Rocket, ShoppingBag, Stethoscope, Store, Target, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { BUSINESS_TYPES, type BusinessType } from "@/features/catalog/business-types";
import { chooseBusiness } from "@/server/onboarding/actions";
import { ChoiceCard, StepFooter, StepHeader, useStepAction } from "./ui";

const ICONS: Record<BusinessType["icon"], LucideIcon> = { ShoppingBag, Target, Building2, Store, Rocket, Stethoscope, GraduationCap, Briefcase };

export function BusinessStep({ initial, firstName }: { initial: string | null; firstName: string }) {
  const [value, setValue] = useState<string | null>(BUSINESS_TYPES.find((b) => b.id === initial && b.available)?.id ?? BUSINESS_TYPES.find((b) => b.available)?.id ?? null);
  const { pending, error, run } = useStepAction();

  return (
    <section aria-labelledby="passo-titulo">
      <StepHeader
        eyebrow="Passo 1 de 4 · Segmento"
        title={firstName ? `${firstName}, qual é o negócio do seu cliente?` : "Qual é o negócio do seu cliente?"}
        text="O VYZ usa as métricas e o vocabulário do nicho e mostra primeiro os layouts feitos para ele."
      />
      <div role="radiogroup" aria-labelledby="passo-titulo" className="mt-8 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {BUSINESS_TYPES.map((b) => {
          const Icon = ICONS[b.icon];
          const selected = value === b.id;
          return (
            <ChoiceCard
              key={b.id}
              role="radio"
              selected={selected}
              disabled={!b.available}
              onToggle={() => setValue(b.id)}
              badge={!b.available ? <span className="rounded-chip border border-dashed border-line px-2 py-0.5 text-[11px] text-fg-2">Em breve</span> : null}
            >
              <span
                aria-hidden
                className={`inline-flex size-10 items-center justify-center rounded-control transition-colors duration-200 ${selected ? "bg-accent text-on-accent" : "bg-accent-soft text-fg"}`}
              >
                <Icon size={20} />
              </span>
              <span>
                <span className="block text-[15px] font-semibold text-fg">{b.name}</span>
                <span className="mt-1 block text-[13px] leading-snug text-fg-2">{b.description}</span>
              </span>
            </ChoiceCard>
          );
        })}
      </div>
      <StepFooter pending={pending} error={error} disabled={!value} onContinue={() => value && run(() => chooseBusiness(value))} />
    </section>
  );
}
