"use client";

// Aba "Personalizar métricas": escolher os cards de um cliente. Os mesmos cards do
// produto, com os números da amostra. Aqui nada é salvo.

import { Check, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { kpiMetric } from "@/features/analytics/metrics";
import { KpiCard } from "@/features/analytics/ui";
import { track } from "@/features/marketing/track";
import { sampleData } from "./engine";

const START = ["spend", "revenue", "roas", "purchases"];
const MAX = 8;

export function PersonalizeDemo() {
  const data = useMemo(() => sampleData("meta"), []);
  const all = useMemo(() => [...data.view.kpis, ...(data.view.extraKpis ?? [])].filter((k) => k.value != null), [data]);
  const [ids, setIds] = useState<string[]>(START);
  const chosen = all.filter((k) => ids.includes(k.id));
  const toggle = (id: string) => {
    setIds((list) => (list.includes(id) ? (list.length > 1 ? list.filter((x) => x !== id) : list) : list.length < MAX ? [...list, id] : list));
    track("demo_interacao", { local: "demonstracao", acao: "personalizar", metrica: id });
  };
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-line bg-card p-4">
        <p className="text-[14px] text-fg">
          <strong className="font-semibold">Escolha os cards deste cliente</strong>
          <span className="text-fg-2"> · {chosen.length} de {MAX}</span>
        </p>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Métricas disponíveis">
          {all.map((k) => {
            const on = ids.includes(k.id);
            return (
              <li key={k.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={!on && ids.length >= MAX}
                  onClick={() => toggle(k.id)}
                  className={`inline-flex items-center gap-1.5 rounded-chip border px-3 py-1.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-45 ${on ? "border-accent bg-accent-soft font-medium text-fg" : "border-line text-fg-2 hover:border-accent hover:text-fg"}`}
                >
                  {on ? <Check size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
                  {k.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="@container">
        <div className="grid grid-cols-2 gap-2.5 @[640px]:grid-cols-4">
          {chosen.map((k) => (
            <div key={k.id} className="motion-safe:animate-[fade-in_300ms_ease-out]">
              <KpiCard kpi={k} currency={data.currency} maturing={3} featured={k.id === "roas"} metric={kpiMetric("meta", k.id)} />
            </div>
          ))}
        </div>
      </div>
      <p className="text-[13px] text-fg-2">No produto, a escolha fica salva no dashboard: cada cliente vê as métricas que importam para ele.</p>
    </div>
  );
}
