"use client";

import { useState, type KeyboardEvent, type PointerEvent } from "react";
import { widest, xTickIndices, yTicks } from "./axis";
import { FitChart } from "./FitChart";
import { useRangeSelect, type IndexRange } from "./range-select";

export type ComboPoint = {
  /** Rótulo do eixo X ("29/10"). */
  label: string;
  /** Barra (ex.: investimento). null = sem dado. */
  bar: number | null;
  /** Linha (ex.: receita), no MESMO eixo da barra. */
  line: number | null;
  /** Dia em maturação (faixa no fim). */
  maturing?: boolean;
};

type ComboChartProps = {
  points: ComboPoint[];
  barLabel: string;
  lineLabel: string;
  /** Rótulos do eixo Y (curtos). */
  formatY: (v: number) => string;
  /** Linhas do tooltip do dia i: [rótulo, valor]. */
  tooltip: (i: number) => [string, string][];
  /** Resumo para leitores de tela. */
  summary: string;
  height?: number;
  fontSize?: number;
  /** Trecho filtrado: fica em destaque, e o resto esmaece. */
  selection?: IndexRange | null;
  /** Arrastar seleciona um trecho; clicar ou tocar, um dia; no teclado, Enter e Shift + setas. */
  onSelectRange?: (from: number, to: number) => void;
};

/**
 * Barras + linha num eixo só (as duas na mesma unidade: nunca dois eixos Y).
 * Desenhado em px reais. Passar o mouse ou as setas do teclado mostra o dia.
 * Os dias em maturação ficam numa faixa clara no fim.
 */
export function ComboChart({ height = 260, ...props }: ComboChartProps) {
  return (
    <figure className="m-0">
      <p className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] leading-none text-fg-2" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2 rounded-[2px] bg-muted" /> {props.barLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[2px] w-3.5 rounded-full bg-accent" /> {props.lineLabel}
        </span>
        {props.points.some((p) => p.maturing) && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px] bg-accent/20" /> em maturação
          </span>
        )}
      </p>
      <FitChart height={height}>{({ width, height: h }) => <ComboSvg {...props} W={width} H={h} />}</FitChart>
    </figure>
  );
}

function ComboSvg({ points, formatY, tooltip, summary, fontSize: fs = 11, W, H, barLabel, lineLabel, selection, onSelectRange }: Omit<ComboChartProps, "height"> & { W: number; H: number }) {
  const [active, setActive] = useState<number | null>(null);
  const range = useRangeSelect(points.length, onSelectRange);
  const n = Math.max(1, points.length);
  const values = points.flatMap((p) => [p.bar, p.line]).filter((v): v is number => v != null && Number.isFinite(v));
  const top = 10;
  const xLabelH = fs + 12;
  const plotH = Math.max(40, H - top - xLabelH);
  const { lo, hi, ticks } = yTicks(Math.min(0, ...values), Math.max(1, ...values), plotH);
  const yLabels = ticks.map(formatY);
  const pad = { l: widest(yLabels, fs) + 12, r: 8 };
  const plotW = Math.max(40, W - pad.l - pad.r);
  const slot = plotW / n;
  const barW = Math.max(2, Math.min(28, slot * 0.62));
  const cx = (i: number) => pad.l + slot * (i + 0.5);
  const y = (v: number) => top + (1 - (v - lo) / (hi - lo || 1)) * plotH;
  const base = y(Math.max(lo, 0));
  const labels = points.map((p) => p.label);
  const xIdx = xTickIndices(n, plotW - slot, widest(labels, fs));
  const firstMaturing = points.findIndex((p) => p.maturing);

  let line = "";
  points.forEach((p, i) => {
    if (p.line == null) return;
    line += `${line && points[i - 1]?.line != null ? "L" : "M"}${cx(i).toFixed(1)},${y(p.line).toFixed(1)}`;
  });

  const indexAt = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - pad.l) / slot);
    return i >= 0 && i < n ? i : null;
  };
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const i = indexAt(e);
    setActive(i);
    range.move(i);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      const next = Math.min(n - 1, Math.max(0, (active ?? (step > 0 ? -1 : n)) + step));
      setActive(next);
      range.keyMove(active ?? next, next, e.shiftKey);
    } else if (e.key === "Escape") {
      setActive(null);
      range.cancel();
    } else if ((e.key === "Enter" || e.key === " ") && onSelectRange && active != null) {
      e.preventDefault();
      range.keyCommit(active);
    }
  };
  const band = range.preview ?? selection ?? null;
  const dimmed = (i: number) => !!band && (i < band.from || i > band.to);

  const tip = active != null ? tooltip(active) : null;
  const tipLeft = active != null ? Math.min(Math.max(cx(active) + 12, 0), W - 188) : 0;
  const flip = active != null && cx(active) + 200 > W;

  return (
    <div className="relative" onPointerLeave={() => setActive(null)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={`${summary} Use as setas para ver cada dia.${onSelectRange ? " Enter filtra o dia; Shift e as setas selecionam um trecho." : ""}`}
        tabIndex={0}
        onPointerDown={(e) => range.down(e, indexAt(e))}
        onPointerMove={pick}
        onPointerUp={(e) => range.up(e, indexAt(e))}
        onPointerCancel={range.cancel}
        onKeyDown={onKey}
        onBlur={() => {
          setActive(null);
          range.cancel();
        }}
        className={`block touch-pan-y rounded-[6px] ${onSelectRange ? "cursor-crosshair select-none" : ""}`}
      >
        <title>{summary}</title>
        {firstMaturing >= 0 && (
          <g>
            <rect x={pad.l + slot * firstMaturing} y={top} width={slot * (n - firstMaturing)} height={plotH} fill="var(--accent)" opacity="0.09" rx="4" />
          </g>
        )}
        {band && <rect data-chart-selection x={pad.l + slot * band.from} y={top} width={slot * (band.to - band.from + 1)} height={plotH} fill="var(--accent)" opacity="0.16" rx="4" />}
        {ticks.map((t, i) => (
          <g key={t}>
            <line x1={pad.l} x2={pad.l + plotW} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={pad.l - 8} y={y(t) + fs * 0.36} textAnchor="end" fontSize={fs} fill="var(--fg-2)" className="tnum">
              {yLabels[i]}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          p.bar == null || p.bar <= 0 ? null : (
            <rect
              key={i}
              x={cx(i) - barW / 2}
              y={y(p.bar)}
              width={barW}
              height={Math.max(1, base - y(p.bar))}
              rx={Math.min(3, barW / 3)}
              fill={active === i ? "var(--fg-2)" : "var(--muted)"}
              opacity={dimmed(i) ? 0.3 : p.maturing ? 0.6 : 1}
            />
          ),
        )}
        {line && <path d={line} pathLength={1} className="m-draw" fill="none" stroke="var(--accent)" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />}
        {active != null && (
          <g aria-hidden>
            <line x1={cx(active)} x2={cx(active)} y1={top} y2={top + plotH} stroke="var(--fg-2)" strokeWidth="1" strokeDasharray="3 3" />
            {points[active].line != null && <circle cx={cx(active)} cy={y(points[active].line!)} r="4.5" fill="var(--accent)" stroke="var(--card)" strokeWidth="2" />}
          </g>
        )}
        {xIdx.map((i) => (
          <text key={i} x={cx(i)} y={H - 4} textAnchor="middle" fontSize={fs} fill="var(--fg-2)" className="tnum">
            {labels[i]}
          </text>
        ))}
      </svg>
      {tip && active != null && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 w-44 rounded-control border border-line bg-bg/95 p-2.5 text-[12px] leading-snug backdrop-blur-sm"
          style={flip ? { left: Math.max(0, cx(active) - 188) } : { left: tipLeft }}
        >
          <p className="mb-1 flex items-center justify-between font-semibold text-fg">
            <span className="tnum">{labels[active]}</span>
            {points[active].maturing && <span className="text-[10.5px] font-medium text-fg-2">em maturação</span>}
          </p>
          <dl className="space-y-0.5">
            {tip.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-fg-2">{k}</dt>
                <dd className="font-semibold tnum text-fg">{v}</dd>
              </div>
            ))}
          </dl>
          <span className="sr-only">
            {barLabel} e {lineLabel}
          </span>
        </div>
      )}
    </div>
  );
}
