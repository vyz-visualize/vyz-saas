"use client";

// Trocar o modelo de um dashboard (página Dashboards): o visual e o objetivo. Contas, metas,
// métricas e filtros ficam; só muda o desenho e os números do topo.

import { Lock } from "lucide-react";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { canUse, TIER_LABEL, type Tier } from "@/features/pricing/entitlements";
import { composedId, OBJECTIVES, VISUALS, type ObjectiveId, type VisualId } from "@/features/templates/dashboards/composed";
import { changeDashboardTemplate } from "@/server/dashboards/actions";

export type ChangeTemplateTarget = { id: string; name: string; visual: VisualId; objective: ObjectiveId };

export function ChangeTemplateModal({ dashboard, tier, onClose }: { dashboard: ChangeTemplateTarget | null; tier: Tier; onClose: () => void }) {
  return (
    <Modal open={!!dashboard} onClose={onClose} title="Trocar modelo" wide>
      {/* uma instância por dashboard: a escolha começa no modelo atual */}
      {dashboard && <Picker key={dashboard.id} dashboard={dashboard} tier={tier} onClose={onClose} />}
    </Modal>
  );
}

function Picker({ dashboard, tier, onClose }: { dashboard: ChangeTemplateTarget; tier: Tier; onClose: () => void }) {
  const [visual, setVisual] = useState<VisualId>(dashboard.visual);
  const [objective, setObjective] = useState<ObjectiveId>(dashboard.objective);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const changed = visual !== dashboard.visual || objective !== dashboard.objective;

  const save = () =>
    start(async () => {
      setError(null);
      const res = await changeDashboardTemplate(dashboard.id, composedId(visual, objective));
      if (!res.ok) setError(res.error.message);
      else onClose();
    });

  return (
    <div className="space-y-5" data-change-template>
      <p className="text-[13.5px] text-fg-2">
        <strong className="text-fg">{dashboard.name}</strong> muda de desenho e de números do topo. Contas, metas, métricas e filtros ficam como estão.
      </p>
      <fieldset>
        <legend className="label-caps mb-2 text-fg-2">Visual</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {VISUALS.map((v) => {
            const locked = !canUse(tier, v.tier);
            const on = v.id === visual;
            return (
              <label key={v.id} className={`flex cursor-pointer items-start gap-3 rounded-control border p-3 ${on ? "border-accent bg-accent-soft" : "border-line"} ${locked ? "cursor-not-allowed opacity-55" : "hover:border-accent"}`}>
                <input type="radio" name="visual" className="mt-1 accent-[var(--accent)]" checked={on} disabled={locked} onChange={() => setVisual(v.id)} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[14px] font-semibold text-fg">
                    {v.name}
                    {locked && (
                      <span className="inline-flex items-center gap-1 text-[11.5px] font-normal text-fg-2">
                        <Lock size={12} aria-hidden /> {TIER_LABEL[v.tier]}
                      </span>
                    )}
                  </span>
                  <span className="block text-[12.5px] text-fg-2">{v.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="label-caps mb-2 text-fg-2">Objetivo</legend>
        <div className="flex flex-wrap gap-2">
          {OBJECTIVES.map((o) => (
            <label key={o.id} className={`cursor-pointer rounded-chip border px-3 py-1.5 text-[13px] ${o.id === objective ? "border-accent bg-accent-soft text-fg" : "border-line text-fg-2 hover:border-accent"}`}>
              <input type="radio" name="objetivo" className="sr-only" checked={o.id === objective} onChange={() => setObjective(o.id)} />
              {o.label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-fg-2">{OBJECTIVES.find((o) => o.id === objective)?.hint}</p>
      </fieldset>
      {error && <p className="text-[13px] text-error-fg">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={`${btn.ghost} h-10`} disabled={pending}>
          Cancelar
        </button>
        <button type="button" onClick={save} className={btn.primary} disabled={!changed || pending}>
          {pending ? "Trocando…" : "Trocar modelo"}
        </button>
      </div>
    </div>
  );
}
