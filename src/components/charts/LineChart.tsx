"use client";

import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { widest, xTickIndices, yTicks } from "./axis";
import { FitChart } from "./FitChart";
import { textWidth } from "./labels";
import { useRangeSelect, type IndexRange } from "./range-select";

type LineChartProps = {
  /** Série diária (contexto, em neutro). */
  values: number[];
  /** Média móvel (a série que importa, em verde). */
  avg?: number[];
  /** Período anterior (referência, tracejado claro). */
  previous?: number[];
  /** Meta (linha tracejada cinza). */
  goal?: number;
  /** Quantos dias do fim estão em maturação. */
  maturingDays?: number;
  /** Texto curto da meta, já formatado ("R$ 60"). */
  goalLabel?: string;
  /** Resumo para leitores de tela. */
  summary: string;
  /** Marca a linha da meta (alvo da intro da LP). */
  markGoal?: boolean;
  /** Dias atrás de cada ponto (0 = hoje): vira data no eixo X. */
  ago?: number[];
  /** Formato dos valores do eixo Y. Sem ele, o eixo Y fica sem rótulos. */
  formatY?: (v: number) => string;
  /** Largura e altura já medidas. Sem as duas, o gráfico mede o contêiner. */
  width?: number;
  /** Altura em px (medida, ou fixa quando o gráfico mede só a largura). */
  height?: number;
  /** Texto dos rótulos, em px (fixo, não escala com a largura). */
  fontSize?: number;
  /** Legenda em cima (desligue quando ela vem de fora). */
  showLegend?: boolean;
  /** Trecho filtrado, em destaque. */
  selection?: IndexRange | null;
  /** Arrastar seleciona um trecho; clicar ou tocar, um dia; no teclado, Enter e Shift + setas. */
  onSelectRange?: (from: number, to: number) => void;
};

/**
 * Linha diária com média móvel, meta e dias em maturação, desenhada sempre
 * em px reais: o SVG tem o tamanho do contêiner e o viewBox igual a ele, então
 * o texto fica com 11 px em qualquer largura. Legenda em cima; etiqueta da
 * meta no fim da linha tracejada, fora da área do traçado.
 */
export function LineChart({ showLegend = true, width, height, ...props }: LineChartProps) {
  const legend = showLegend && <LineLegend avg={!!props.avg} goal={props.goal !== undefined} previous={!!props.previous} maturing={(props.maturingDays ?? 0) > 0} />;
  if (width !== undefined && height !== undefined) {
    return (
      <figure className="m-0">
        {legend}
        <LineSvg {...props} W={width} H={height} />
      </figure>
    );
  }
  return (
    <figure className="m-0">
      {legend}
      <FitChart height={height ?? 200}>{({ width: W, height: H }) => <LineSvg {...props} W={W} H={H} />}</FitChart>
    </figure>
  );
}

const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Datas do eixo X. Só roda no cliente, depois da medida (nunca no prerender). */
function dayLabels(ago: number[] | undefined, n: number): string[] {
  if (!ago) return Array.from({ length: n }, (_, i) => `dia ${i + 1}`);
  const now = new Date();
  return ago.map((a) => ddmm(new Date(now.getFullYear(), now.getMonth(), now.getDate() - a)));
}

function LineSvg({
  values,
  avg,
  previous,
  goal,
  maturingDays = 0,
  goalLabel,
  summary,
  markGoal,
  ago,
  formatY,
  fontSize: fs = 11,
  W,
  H,
  selection,
  onSelectRange,
}: Omit<LineChartProps, "width" | "height" | "showLegend"> & { W: number; H: number }) {
  const range = useRangeSelect(values.length, onSelectRange);
  const [cursor, setCursor] = useState<number | null>(null);
  const n = Math.max(2, values.length);
  const finite = (v: number[]) => v.filter(Number.isFinite);
  // a escala ignora os dias em maturação (o custo do dia dispara enquanto as
  // conversões não chegam); o pico fica preso no topo da área
  const settled = maturingDays ? values.slice(0, -maturingDays) : values;
  const all = [...finite(settled), ...finite(avg ?? []), ...finite(previous ?? []), ...(goal !== undefined ? [goal] : [])];
  const rawMin = Math.min(...all);
  const rawMax = Math.max(...all);

  const tagH = fs + 8;
  const tagW = goalLabel ? textWidth(goalLabel, fs) + 14 : 0;
  const xLabelH = fs + 10;
  const top = 8;
  const plotH = Math.max(40, H - top - xLabelH);
  const { lo, hi, ticks } = yTicks(rawMin, rawMax, plotH);
  const yLabels = formatY ? ticks.map(formatY) : [];
  const pad = { l: formatY ? widest(yLabels, fs) + 10 : 4, r: goalLabel ? tagW + 8 : 8, t: top, b: xLabelH };
  const plotW = Math.max(40, W - pad.l - pad.r);
  const plotRight = pad.l + plotW;
  const plotBottom = pad.t + plotH;

  const x = (i: number) => pad.l + (i / (n - 1)) * plotW;
  const y = (v: number) => pad.t + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * plotH;
  const path = (vals: number[]) =>
    vals
      .map((v, i) => (Number.isFinite(v) ? `${i && Number.isFinite(vals[i - 1]) ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}` : ""))
      .join("");

  const labels = dayLabels(ago, values.length);
  const xIdx = xTickIndices(values.length, plotW, widest(labels, fs));
  const matX = maturingDays ? x(n - maturingDays) - plotW / (n - 1) / 2 : 0;
  const lastAvg = avg ? [...avg].reverse().findIndex(Number.isFinite) : -1;
  const lastIdx = lastAvg >= 0 && avg ? avg.length - 1 - lastAvg : -1;
  const goalY = goal !== undefined ? y(goal) : 0;
  const tagY = Math.min(plotBottom - tagH, Math.max(pad.t, goalY - tagH / 2));

  const indexAt = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - pad.l) / plotW) * (n - 1));
    return i >= 0 && i < values.length ? i : null;
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      const next = Math.min(values.length - 1, Math.max(0, (cursor ?? (step > 0 ? -1 : values.length)) + step));
      setCursor(next);
      range.keyMove(cursor ?? next, next, e.shiftKey);
    } else if (e.key === "Escape") {
      setCursor(null);
      range.cancel();
    } else if ((e.key === "Enter" || e.key === " ") && cursor != null) {
      e.preventDefault();
      range.keyCommit(cursor);
    }
  };
  const band = range.preview ?? selection ?? null;
  const step = plotW / (n - 1);
  const bandX = band ? Math.max(pad.l, x(band.from) - step / 2) : 0;
  const interactive = onSelectRange
    ? {
        tabIndex: 0,
        onPointerDown: (e: PointerEvent<SVGSVGElement>) => range.down(e, indexAt(e)),
        onPointerMove: (e: PointerEvent<SVGSVGElement>) => range.move(indexAt(e)),
        onPointerUp: (e: PointerEvent<SVGSVGElement>) => range.up(e, indexAt(e)),
        onPointerCancel: range.cancel,
        onKeyDown: onKey,
        onBlur: () => {
          setCursor(null);
          range.cancel();
        },
      }
    : {};

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={onSelectRange ? `${summary} Use as setas para escolher o dia: Enter filtra; Shift e as setas selecionam um trecho.` : summary} className={`block ${onSelectRange ? "cursor-crosshair touch-pan-y rounded-[6px] select-none" : ""}`} {...interactive}>
      <title>{summary}</title>
      {band && <rect data-chart-selection x={bandX} y={pad.t} width={Math.min(plotRight, x(band.to) + step / 2) - bandX} height={plotH} fill="var(--accent)" opacity="0.16" rx="3" />}
      {cursor != null && <line x1={x(cursor)} x2={x(cursor)} y1={pad.t} y2={plotBottom} stroke="var(--fg-2)" strokeWidth="1" strokeDasharray="3 3" />}
      {ticks.map((t, i) => (
        <g key={t}>
          <line x1={pad.l} x2={plotRight} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
          {formatY && (
            <text x={pad.l - 6} y={y(t) + fs * 0.36} textAnchor="end" fontSize={fs} fill="var(--fg-2)" className="tnum">
              {yLabels[i]}
            </text>
          )}
        </g>
      ))}

      {maturingDays > 0 && (
        <rect className="m-late" style={{ "--d": "1500ms" } as CSSProperties} x={matX} y={pad.t} width={plotRight - matX} height={plotH} fill="var(--accent)" opacity="0.14" rx="3" />
      )}

      {xIdx.map((i) => (
        <text key={i} x={x(i)} y={H - 4} textAnchor={i === values.length - 1 ? "end" : "middle"} fontSize={fs} fill="var(--fg-2)" className="tnum">
          {labels[i]}
        </text>
      ))}

      {previous && <path d={path(previous)} fill="none" stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 3" opacity="0.8" />}

      {goal !== undefined && (
        <g>
          <line data-intro-target={markGoal ? "" : undefined} x1={pad.l} x2={plotRight} y1={goalY} y2={goalY} stroke="var(--fg-2)" strokeWidth="1" strokeDasharray="4 4" opacity="0.85" />
          {goalLabel && (
            // no fim da linha tracejada, fora do traçado: a série nunca cruza a etiqueta
            <g transform={`translate(${plotRight + 4} ${tagY})`}>
              <rect width={tagW} height={tagH} rx="4" fill="var(--bg)" stroke="var(--line)" />
              <text x={tagW / 2} y={tagH / 2 + fs * 0.36} textAnchor="middle" fontSize={fs} fill="var(--fg-2)" className="tnum">
                {goalLabel}
              </text>
            </g>
          )}
        </g>
      )}

      <path d={path(values)} pathLength={1} className="m-draw" style={{ "--d": "420ms" } as CSSProperties} fill="none" stroke="var(--muted)" strokeWidth="1.3" strokeLinejoin="round" />
      {avg && (
        <g className="m-late" style={{ "--d": "1250ms" } as CSSProperties}>
          <path d={path(avg)} fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
          {lastIdx >= 0 && <circle cx={x(lastIdx)} cy={y(avg[lastIdx])} r="3.4" fill="var(--accent)" />}
        </g>
      )}
    </svg>
  );
}

/** Legenda da linha (fora do traçado). 11 px no painel, 12 px no palco da LP. */
export function LineLegend({ avg, goal, previous, maturing, large = false }: { avg: boolean; goal: boolean; previous: boolean; maturing: boolean; large?: boolean }) {
  return (
    <p className={`mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 leading-none text-fg-2 ${large ? "text-[12px]" : "text-[11px]"}`} aria-hidden>
      {avg && (
        <span className="inline-flex items-center gap-1">
          <span className="h-[2.5px] w-3 rounded-full bg-accent" /> média 7 dias
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <span className="h-px w-3 bg-muted" /> dia a dia
      </span>
      {goal && (
        <span className="inline-flex items-center gap-1">
          <span className="w-3 border-t border-dashed border-fg-2" /> meta
        </span>
      )}
      {previous && (
        <span className="inline-flex items-center gap-1">
          <span className="w-3 border-t border-dotted border-muted" /> período anterior
        </span>
      )}
      {maturing && (
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-[2px] bg-accent/30" /> em maturação
        </span>
      )}
    </p>
  );
}
