"use client";

// Primeiro passo do novo dashboard: o objetivo (decide os números e o funil) e o
// visual. Só 5 visuais; os que o plano não cobre aparecem borrados, com o plano que libera.
// As páginas não se escolhem aqui: saem das contas, no passo seguinte.

import Link from "next/link";
import { useState } from "react";
import { LockBadge } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { availableIn, canUse, type Tier } from "@/features/pricing/entitlements";
import { anyDashboardTemplate } from "@/features/templates/live";
import { composedId, OBJECTIVES, VISUALS, type ObjectiveId } from "@/features/templates/dashboards/composed";
import { TemplatePreview } from "./TemplateGallery";

export function ModelPicker({ tier, initialObjective = "ecommerce", onUse }: { tier: Tier; initialObjective?: ObjectiveId; onUse: (templateId: string) => void }) {
  const [objective, setObjective] = useState<ObjectiveId>(initialObjective);
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="title text-[17px] text-fg">1. Qual é o objetivo?</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {OBJECTIVES.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={objective === o.id}
              onClick={() => setObjective(o.id)}
              className={`rounded-card border p-3 text-left transition-colors ${objective === o.id ? "border-accent bg-accent-soft/60" : "border-line bg-card hover:border-accent/60"}`}
            >
              <span className="block font-medium text-fg">{o.label}</span>
              <span className="mt-1 block text-[12.5px] text-fg-2">{o.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="title text-[17px] text-fg">2. Escolha o visual</h2>
        <p className="text-[13.5px] text-fg-2">Depois você escolhe as contas: o dashboard ganha uma página para cada plataforma e uma visão geral juntando tudo.</p>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {VISUALS.map((v) => {
            const t = anyDashboardTemplate(composedId(v.id, objective));
            const open = canUse(tier, v.tier);
            if (!t) return null;
            return (
              <li key={v.id} className="relative overflow-hidden rounded-card border border-line bg-card">
                <div className={open ? "" : "pointer-events-none select-none blur-[3px] opacity-70"} aria-hidden={!open}>
                  <TemplatePreview t={t} variant="compact" />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{v.name}</p>
                    <p className="text-[12.5px] text-fg-2">{v.description}</p>
                  </div>
                  {open ? (
                    <button type="button" className={`${btn.small} shrink-0`} onClick={() => onUse(t.id)}>
                      Usar
                    </button>
                  ) : (
                    <Link href="/painel/plano" className="shrink-0">
                      <LockBadge label={availableIn(v.tier)} />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
