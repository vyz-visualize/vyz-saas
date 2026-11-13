"use client";

import { funnelRows, funnelSummary, type FunnelStep } from "@/features/metrics/funnel";
import { StageFunnel } from "./StageFunnel";

/** Índice da etapa que recebe a maior queda relativa. */
export function biggestDrop(steps: { pct: number }[]): number {
  let idx = 1;
  let worst = -1;
  for (let i = 1; i < steps.length; i++) {
    const loss = 1 - steps[i].pct / steps[i - 1].pct;
    if (loss > worst) {
      worst = loss;
      idx = i;
    }
  }
  return idx;
}

type FunnelProps = {
  steps: FunnelStep[];
  title: string;
  /** "lg": texto de leitura (painel de "Como funciona"). */
  size?: "sm" | "lg";
  /** Ocupa a altura toda do contêiner. */
  fill?: boolean;
};

/**
 * Funil com a passagem entre etapas, desenhado pela Bklit UI: os rótulos ficam ao
 * lado do desenho (nunca em cima da cor), a etapa da maior queda vai em vermelho
 * terroso e o aviso dela fica embaixo.
 */
export function Funnel({ steps, title, size = "sm", fill = false }: FunnelProps) {
  // dados reais sem nenhuma etapa no período (conta nova, sem sessões): aviso em vez do desenho
  if (steps.length < 2) return <p className="grid h-full min-h-24 place-items-center text-[13px] text-fg-2">Sem dados de funil neste período.</p>;
  const drop = biggestDrop(steps);
  const lg = size === "lg";
  const summary = `${funnelSummary(title, steps)} Maior queda antes de ${steps[drop].label}.`;
  const data = funnelRows(steps).map((r, i) => ({ ...r, color: i === drop ? "var(--chart-negative)" : undefined }));
  return (
    <div className={`flex flex-col ${fill ? "min-h-0 flex-1" : ""}`} data-chart-theme style={fill ? { minHeight: 190 } : { height: lg ? 330 : 220 }}>
      <StageFunnel steps={data} color="var(--chart-line-primary)" summary={summary} large={lg} className="flex-1" />
      <p className={`mt-1.5 shrink-0 font-semibold text-error-fg ${lg ? "text-[12px]" : "text-[11px]"}`} aria-hidden>
        ↓ maior queda: {steps[drop - 1]?.label} → {steps[drop].label}
      </p>
    </div>
  );
}
