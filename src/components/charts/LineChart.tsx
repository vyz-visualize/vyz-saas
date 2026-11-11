"use client";

import { curveLinear, curveMonotoneX } from "d3-shape";
import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useChart } from "@/components/bklit/charts/chart-context";
import { ComposedChart } from "@/components/bklit/charts/composed-chart";
import { Grid } from "@/components/bklit/charts/grid";
import { Line } from "@/components/bklit/charts/line";
import { ChartTooltip } from "@/components/bklit/charts/tooltip";
import { XAxis } from "@/components/bklit/charts/x-axis";
import { YAxis } from "@/components/bklit/charts/y-axis";
import { widest, xTickIndices, yTicks } from "./axis";
import { textWidth } from "./labels";
import { useRangeSelect, type IndexRange } from "./range-select";
import { useElementSize } from "./useSize";

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
  /** Altura em px (medida, ou fixa quando o gráfico mede só a largura). "fill" ocupa a altura do contêiner (flex), com mínimo de 200 px. */
  height?: number | "fill";
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
 * Linha diária com média móvel, meta e dias em maturação, sobre a Bklit UI
 * (ComposedChart): traçado, grade, eixos e a dica ao passar o mouse vêm dela; a
 * faixa de maturação, a linha do alvo com a etiqueta e o trecho selecionado
 * são camadas nossas, desenhadas com as escalas do gráfico (useChart).
 */
export function LineChart({ showLegend = true, width, height, ...props }: LineChartProps) {
  const legend = showLegend && <LineLegend avg={!!props.avg} goal={props.goal !== undefined} previous={!!props.previous} maturing={(props.maturingDays ?? 0) > 0} />;
  const fill = height === "fill";
  return (
    <figure className={fill ? "m-0 flex min-h-0 flex-1 flex-col" : "m-0"}>
      {legend}
      <LinePlot {...props} width={width} height={fill ? undefined : (height ?? 200)} />
    </figure>
  );
}

const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Dia de cada ponto (hoje menos `ago`). Só roda no cliente: o gráfico desenha depois de medir. */
function dayDates(ago: number[] | undefined, n: number): Date[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - (ago?.[i] ?? n - 1 - i)));
}

const num = (v: number | undefined) => (v !== undefined && Number.isFinite(v) ? v : null);

/** Sem altura = ocupa a do contêiner (medida). */
type PlotProps = Omit<LineChartProps, "width" | "height" | "showLegend"> & { width?: number; height?: number };

function LinePlot({ values, avg, previous, goal, maturingDays = 0, goalLabel, summary, markGoal, ago, formatY, fontSize: fs = 11, width, height, selection, onSelectRange }: PlotProps) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const W = width ?? size?.width ?? 0;
  const H = height ?? Math.max(200, Math.floor(size?.height ?? 0));
  const range = useRangeSelect(values.length, onSelectRange);
  const [cursor, setCursor] = useState<number | null>(null);
  const n = Math.max(2, values.length);

  // a escala ignora os dias em maturação (o custo do dia dispara enquanto as
  // conversões não chegam); o pico fica preso no topo da área
  const finite = (v: number[]) => v.filter(Number.isFinite);
  const settled = maturingDays ? values.slice(0, -maturingDays) : values;
  const all = [...finite(settled), ...finite(avg ?? []), ...finite(previous ?? []), ...(goal !== undefined ? [goal] : [])];
  const rawMin = all.length ? Math.min(...all) : 0;
  const rawMax = all.length ? Math.max(...all) : 1;

  const tagW = goalLabel ? textWidth(goalLabel, fs) + 14 : 0;
  const top = 8;
  const bottom = fs + 22;
  const plotH = Math.max(40, H - top - bottom);
  const { lo, hi, ticks } = yTicks(rawMin, rawMax, plotH);
  const yLabelW = formatY ? widest(ticks.map(formatY), fs) : 0;
  const margin = useMemo(() => ({ top, bottom, left: yLabelW ? yLabelW + 14 : 6, right: goalLabel ? tagW + 10 : 10 }), [bottom, goalLabel, tagW, yLabelW]);
  const plotW = Math.max(40, W - margin.left - margin.right);
  const yDomains = useMemo(() => ({ left: [lo, hi] as [number, number] }), [lo, hi]);

  const dates = useMemo(() => dayDates(ago, values.length), [ago, values.length]);
  const labels = useMemo(() => (ago ? dates.map(ddmm) : dates.map((_, i) => `dia ${i + 1}`)), [ago, dates]);
  const clampY = (v: number | null) => (v === null ? null : Math.min(hi, Math.max(lo, v)));
  const data = useMemo(
    () => values.map((v, i) => ({ date: dates[i], dia: clampY(num(v)), media: clampY(num(avg?.[i])), anterior: clampY(num(previous?.[i])), diaReal: num(v) })),
    // clampY depende só de lo e hi
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values, avg, previous, dates, lo, hi],
  );
  const xTicks = Math.max(2, xTickIndices(values.length, plotW, widest(labels, fs)).length);
  const fmt = (v: unknown) => (typeof v === "number" ? (formatY ? formatY(v) : String(Math.round(v * 100) / 100)) : "—");

  const indexAt = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - rect.left - margin.left) / plotW) * (n - 1));
    return i >= 0 && i < values.length ? i : null;
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
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
  const interactive = onSelectRange
    ? {
        tabIndex: 0,
        onPointerDown: (e: PointerEvent<HTMLDivElement>) => range.down(e, indexAt(e)),
        onPointerMove: (e: PointerEvent<HTMLDivElement>) => range.move(indexAt(e)),
        onPointerUp: (e: PointerEvent<HTMLDivElement>) => range.up(e, indexAt(e)),
        onPointerCancel: range.cancel,
        onKeyDown: onKey,
        onBlur: () => {
          setCursor(null);
          range.cancel();
        },
      }
    : {};
  const band = range.preview ?? selection ?? null;

  return (
    <div
      ref={ref}
      role="img"
      aria-label={onSelectRange ? `${summary} Use as setas para escolher o dia: Enter filtra; Shift e as setas selecionam um trecho.` : summary}
      data-chart-theme
      className={`relative w-full overflow-hidden text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-accent ${onSelectRange ? "cursor-crosshair touch-pan-y rounded-[6px] select-none" : ""}`}
      style={{ ...(height ? { height: H } : { flex: "1 1 0", minHeight: 200 }), width: width ?? undefined, fontSize: fs }}
      {...interactive}
    >
      {W > 0 && (
        <ComposedChart data={data} margin={margin} aspectRatio="" style={{ height: H, touchAction: "pan-y" }} yDomains={yDomains} animationDuration={900}>
          <Grid horizontal numTicksRows={Math.max(2, ticks.length - 1)} strokeDasharray="0" />
          {maturingDays > 0 && <MaturingBand days={maturingDays} count={n} />}
          {band && <SelectionBand from={band.from} to={band.to} count={n} />}
          {cursor != null && <CursorLine index={cursor} count={n} />}
          {previous && <Line dataKey="anterior" stroke="var(--muted)" strokeWidth={1} curve={curveLinear} fadeEdges={false} showHighlight={false} dashFromIndex={0} dashArray="2,3" />}
          <Line dataKey="dia" stroke="var(--muted)" strokeWidth={1.3} curve={curveLinear} fadeEdges={false} showHighlight={false} />
          {avg && <Line dataKey="media" stroke="var(--chart-line-primary)" strokeWidth={2.6} curve={curveMonotoneX} fadeEdges={false} />}
          {goal !== undefined && <GoalLine value={goal} label={goalLabel} labelWidth={tagW} fontSize={fs} mark={markGoal} />}
          {formatY && <YAxis formatValue={formatY} numTicks={ticks.length} />}
          <XAxis labels={labels} numTicks={xTicks} />
          <ChartTooltip
            showDatePill={false}
            rows={(p) => [
              ...(avg ? [{ color: "var(--chart-line-primary)", label: "Média 7 dias", value: fmt(p.media) }] : []),
              { color: "var(--muted)", label: "No dia", value: fmt(p.diaReal) },
              ...(previous ? [{ color: "var(--muted)", label: "Período anterior", value: fmt(p.anterior) }] : []),
            ]}
          />
        </ComposedChart>
      )}
    </div>
  );
}

/** Passo entre dois dias, em px, e o x de um índice. */
function useSlots(count: number) {
  const { innerWidth, innerHeight } = useChart();
  const step = innerWidth / Math.max(1, count - 1);
  return { step, innerWidth, innerHeight, x: (i: number) => i * step };
}

/** Dias que ainda recebem conversões: faixa no fim do gráfico. */
function MaturingBand({ days, count }: { days: number; count: number }) {
  const { step, innerWidth, innerHeight, x } = useSlots(count);
  const from = Math.max(0, x(count - days) - step / 2);
  return <rect x={from} y={0} width={Math.max(0, innerWidth - from)} height={innerHeight} fill="var(--chart-line-primary)" opacity={0.14} rx={3} />;
}

/** Trecho filtrado (ou sendo arrastado). */
function SelectionBand({ from, to, count }: { from: number; to: number; count: number }) {
  const { step, innerWidth, innerHeight, x } = useSlots(count);
  const x0 = Math.max(0, x(from) - step / 2);
  return <rect data-chart-selection x={x0} y={0} width={Math.max(0, Math.min(innerWidth, x(to) + step / 2) - x0)} height={innerHeight} fill="var(--chart-line-primary)" opacity={0.16} rx={3} />;
}

/** Dia escolhido pelo teclado. */
function CursorLine({ index, count }: { index: number; count: number }) {
  const { innerHeight, x } = useSlots(count);
  return <line x1={x(index)} x2={x(index)} y1={0} y2={innerHeight} stroke="var(--chart-crosshair)" strokeWidth={1} strokeDasharray="3 3" />;
}

// a etiqueta do alvo fica na margem direita: precisa sair do recorte da animação de entrada
(GoalLine as unknown as { __isPostOverlay?: boolean }).__isPostOverlay = true;

/** Alvo: linha tracejada e a etiqueta no fim dela, fora do traçado (a série nunca cruza a etiqueta). */
function GoalLine({ value, label, labelWidth, fontSize: fs, mark }: { value: number; label?: string; labelWidth: number; fontSize: number; mark?: boolean }) {
  const { yScale, innerWidth, innerHeight } = useChart();
  const y = yScale(value);
  if (!Number.isFinite(y)) return null;
  const tagH = fs + 8;
  const tagY = Math.min(innerHeight - tagH, Math.max(0, y - tagH / 2));
  return (
    <g>
      <line data-intro-target={mark ? "" : undefined} x1={0} x2={innerWidth} y1={y} y2={y} stroke="var(--chart-foreground-muted)" strokeWidth={1} strokeDasharray="4 4" opacity={0.85} />
      {label && (
        <g transform={`translate(${innerWidth + 4} ${tagY})`}>
          <rect width={labelWidth} height={tagH} rx={4} fill="var(--bg)" stroke="var(--chart-grid)" />
          <text x={labelWidth / 2} y={tagH / 2 + fs * 0.36} textAnchor="middle" fontSize={fs} fill="var(--chart-label)" className="tnum">
            {label}
          </text>
        </g>
      )}
    </g>
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
          <span className="w-3 border-t border-dashed border-fg-2" /> alvo
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
