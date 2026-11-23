// Texto do visual na escolha (Novo dashboard, Trocar modelo, primeiro acesso): para quem é, o que
// só ele tem e o selo "Recomendado para …" quando combina com o objetivo escolhido. Qualquer
// visual funciona com qualquer objetivo; o selo só ajuda a escolher.

import { Sparkles } from "lucide-react";
import { OBJECTIVES, recommendedFor, VISUALS, type ObjectiveId, type Visual } from "@/features/templates/dashboards/composed";

export function VisualBlurb({ v, objective, className = "" }: { v: Pick<Visual, "description" | "forWhom" | "only" | "recommended">; objective?: ObjectiveId | null; className?: string }) {
  const goal = OBJECTIVES.find((o) => o.id === objective);
  return (
    <span className={`block min-w-0 ${className}`}>
      {recommendedFor(v, objective) && goal && (
        <span className="mb-1 inline-flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-fg" data-recomendado>
          <Sparkles size={11} aria-hidden /> Recomendado para {goal.label.charAt(0).toLowerCase() + goal.label.slice(1)}
        </span>
      )}
      <span className="block text-[12.5px] text-fg-2">{v.forWhom ?? v.description}</span>
      {v.only && (
        <span className="mt-0.5 block text-[12px] text-fg-2">
          <span className="font-semibold text-fg">Só nele:</span> {v.only}.
        </span>
      )}
    </span>
  );
}

/** O visual de um modelo novo (visual + objetivo), para os cartões que só têm o modelo. */
export const visualOf = (id: string | undefined) => VISUALS.find((v) => v.id === id);
