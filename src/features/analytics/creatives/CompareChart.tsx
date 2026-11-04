"use client";

// "Evolução por dia de veiculação": uma linha por anúncio, alinhadas pelo dia de
// veiculação. Desenhado em px reais, como os outros gráficos do painel.

import { FitChart } from "@/components/charts/FitChart";
import { widest, xTickIndices, yTicks } from "@/components/charts/axis";

const FS = 11;

export function CompareChart({ labels, series, colors, format, summary, height = 240 }: { labels: string[]; series: (number | null)[][]; colors: readonly string[]; format: (v: number) => string; summary: string; height?: number }) {
  return (
    <FitChart height={height}>
      {({ width: W, height: H }) => {
        const all = series.flat().filter((v): v is number => v != null && Number.isFinite(v));
        if (!all.length) return <p className="py-8 text-center text-[13px] text-fg-2">Sem dados desta métrica.</p>;
        const n = Math.max(2, labels.length);
        const xLabelH = FS + 10;
        const top = 8;
        const plotH = Math.max(40, H - top - xLabelH);
        const min = Math.min(0, ...all);
        const max = Math.max(...all);
        const { lo, hi, ticks } = yTicks(min, max === min ? min + 1 : max, plotH);
        const yLabels = ticks.map(format);
        const left = widest(yLabels, FS) + 10;
        const plotW = Math.max(40, W - left - 12);
        const x = (i: number) => left + (labels.length <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
        const y = (v: number) => top + (1 - (v - lo) / (hi - lo || 1)) * plotH;
        const xIdx = xTickIndices(labels.length, plotW, widest(labels, FS));
        return (
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={summary} className="block">
            <title>{summary}</title>
            {ticks.map((t, i) => (
              <g key={t}>
                <line x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
                <text x={left - 6} y={y(t) + FS * 0.36} textAnchor="end" fontSize={FS} fill="var(--fg-2)" className="tnum">
                  {yLabels[i]}
                </text>
              </g>
            ))}
            {xIdx.map((i) => (
              <text key={i} x={x(i)} y={H - 4} textAnchor={i === labels.length - 1 && labels.length > 1 ? "end" : "middle"} fontSize={FS} fill="var(--fg-2)" className="tnum">
                {labels[i]}
              </text>
            ))}
            {series.map((values, s) => {
              const d = values.map((v, i) => (v == null ? "" : `${i && values[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join("");
              const last = values.reduce<number>((acc, v, i) => (v == null ? acc : i), -1);
              return (
                <g key={s}>
                  <path d={d} fill="none" stroke={colors[s]} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                  {last >= 0 && <circle cx={x(last)} cy={y(values[last]!)} r="3.2" fill={colors[s]} />}
                </g>
              );
            })}
          </svg>
        );
      }}
    </FitChart>
  );
}
