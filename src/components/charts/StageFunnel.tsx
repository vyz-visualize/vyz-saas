"use client";

import { useMemo } from "react";
import { FunnelChart } from "@/components/bklit/charts/funnel-chart";
import { FitChart } from "./FitChart";

export type FunnelStep = { label: string; value: number; display: string; /** Linha de apoio ("43% do anterior"). */ note?: string; color?: string };

type StageFunnelProps = { steps: FunnelStep[]; orientation?: "horizontal" | "vertical"; color?: string; summary: string; className?: string; /** Texto de leitura (painel de "Como funciona"). */ large?: boolean };

/**
 * Funil em camadas com os rótulos fora do desenho (ao lado no vertical, embaixo no
 * horizontal): o texto nunca fica em cima da cor. Mede o espaço e não passa do bloco.
 */
export function StageFunnel({ steps, orientation = "vertical", color = "var(--accent)", summary, className = "", large = false }: StageFunnelProps) {
  const vertical = orientation === "vertical";
  const top = Math.max(1, ...steps.map((s) => s.value));
  // etapa muito pequena some no desenho: um mínimo mantém o formato legível
  const data = useMemo(() => steps.map((s) => ({ label: s.label, value: Math.max(top * 0.04, s.value), color: s.color })), [steps, top]);
  if (!steps.length) return <p className="text-[12px] text-fg-2">Sem dados neste recorte.</p>;
  const chart = (
    <FitChart className="flex-1" minHeight={vertical ? Math.max(150, steps.length * 46) : 80}>
      {({ width, height }) => (
        <div aria-hidden style={{ width, height }}>
          <FunnelChart data={data} orientation={orientation} color={color} layers={3} gap={4} showValues={false} showPercentage={false} showLabels={false} style={{ width, height }} />
        </div>
      )}
    </FitChart>
  );
  const labels = (
    <ol className={vertical ? "flex w-[40%] max-w-[168px] shrink-0 flex-col overflow-hidden" : "mt-2.5 grid shrink-0"} style={vertical ? undefined : { gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((s) =>
        vertical ? (
          // cada etapa mede a própria altura: baixa demais, a nota sai; mais baixa ainda, nome e número dividem a linha
          <li key={s.label} className="min-h-0 flex-1 border-t border-line [container-type:size] first:border-t-0">
            <div className="flex h-full flex-col justify-center overflow-hidden [@container_(max-height:35px)]:flex-row [@container_(max-height:35px)]:items-center [@container_(max-height:35px)]:justify-between [@container_(max-height:35px)]:gap-2">
              <span className={`block min-w-0 truncate text-fg-2 ${large ? "text-[12.5px]" : "text-[11px]"}`}>{s.label}</span>
              <span className={`block shrink-0 leading-tight font-bold tnum ${large ? "text-[18px]" : "text-[15px]"}`} style={s.color ? { color: s.color } : undefined}>
                {s.display}
              </span>
              {s.note && <span className={`hidden truncate text-fg-2 [@container_(min-height:50px)]:block ${large ? "text-[11.5px]" : "text-[10.5px]"}`}>{s.note}</span>}
            </div>
          </li>
        ) : (
          <li key={s.label} className="min-w-0 border-l border-line px-2 first:border-l-0 first:pl-0">
            <span className={`block truncate text-fg-2 ${large ? "text-[12.5px]" : "text-[11px]"}`}>{s.label}</span>
            <span className={`block leading-tight font-bold tnum ${large ? "text-[18px]" : "text-[15px]"}`} style={s.color ? { color: s.color } : undefined}>
              {s.display}
            </span>
            {s.note && <span className={`block truncate text-fg-2 ${large ? "text-[11.5px]" : "text-[10.5px]"}`}>{s.note}</span>}
          </li>
        ),
      )}
    </ol>
  );
  return (
    <div role="img" aria-label={summary} className={`flex min-h-0 ${vertical ? "flex-row gap-3" : "flex-col"} ${className}`}>
      {vertical ? (
        <>
          {labels}
          {chart}
        </>
      ) : (
        <>
          {chart}
          {labels}
        </>
      )}
    </div>
  );
}
