"use client";

// Gráficos dos visuais próprios desenhados com a Bklit UI. A cor vem dos tokens do
// contêiner: o visual declara a paleta dele (themeVars) e tudo o que está dentro,
// dos gráficos aos cartões soltos na grade, acompanha.

import { curveMonotoneX, curveNatural } from "d3-shape";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useEffect, useMemo, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { Area } from "@/components/bklit/charts/area";
import { Bar } from "@/components/bklit/charts/bar";
import { BarChart } from "@/components/bklit/charts/bar-chart";
import { useChart } from "@/components/bklit/charts/chart-context";
import type { ChartStatFlowFormat } from "@/components/bklit/charts/chart-stat-flow";
import { ComposedChart } from "@/components/bklit/charts/composed-chart";
import { Grid } from "@/components/bklit/charts/grid";
import { Line } from "@/components/bklit/charts/line";
import { Ring } from "@/components/bklit/charts/ring";
import { RingCenter } from "@/components/bklit/charts/ring-center";
import { RingChart } from "@/components/bklit/charts/ring-chart";
import { SeriesBar } from "@/components/bklit/charts/series-bar";
import { AreaSparkline, BarSparkline, LineSparkline } from "@/components/bklit/charts/sparkline";
import { ChartTooltip } from "@/components/bklit/charts/tooltip";
import { XAxis } from "@/components/bklit/charts/x-axis";
import { YAxis } from "@/components/bklit/charts/y-axis";
import { FitChart } from "@/components/charts/FitChart";
import { textWidth } from "@/components/charts/labels";

// ---- paleta ---------------------------------------------------------------------------

export type SkinPalette = {
  scheme: "light" | "dark";
  /** Fundo da moldura do visual. */
  bg: string;
  card: string;
  fg: string;
  fg2: string;
  line: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  /** Neutro dos gráficos (trilhos, barras de apoio). */
  muted: string;
  error: string;
  errorSoft: string;
  /** Variação boa (subiu o que devia subir). */
  good: string;
};

/**
 * Tokens da VYZ trocados pelos do visual. Vai no contêiner junto com
 * `data-chart-theme`, que faz os gráficos da Bklit lerem a paleta dali.
 */
export function themeVars(p: SkinPalette): CSSProperties {
  return {
    colorScheme: p.scheme,
    color: p.fg,
    "--bg": p.bg,
    "--card": p.card,
    "--fg": p.fg,
    "--fg-2": p.fg2,
    "--line": p.line,
    "--accent": p.accent,
    "--accent-soft": p.accentSoft,
    "--on-accent": p.onAccent,
    "--muted": p.muted,
    "--field": p.card,
    "--error-fg": p.error,
    "--error-soft": p.errorSoft,
    "--good": p.good,
    "--panel": p.bg,
    // escala dos blocos padrão (funil, etapas): do destaque para o claro, na paleta do visual
    "--seq-a": p.accent,
    "--seq-b": `color-mix(in srgb, ${p.accent} 78%, ${p.card})`,
    "--seq-c": `color-mix(in srgb, ${p.accent} 56%, ${p.card})`,
    "--seq-d": `color-mix(in srgb, ${p.accent} 36%, ${p.card})`,
  } as CSSProperties;
}

/**
 * Controles do dashboard (período, comparar, ações) e a nota dos filtros dentro da
 * moldura de um visual: são os componentes de sempre, lendo a paleta dele.
 */
export function SkinChrome({ palette, controls, note, className = "" }: { palette: SkinPalette; controls?: ReactNode; note?: ReactNode; className?: string }) {
  if (!controls && !note) return null;
  return (
    <div data-chart-theme style={themeVars(palette)} className={`@container space-y-2 print:hidden ${className}`}>
      {controls}
      {note}
    </div>
  );
}

/**
 * As outras abas do dashboard dentro da moldura de um visual: os blocos padrão
 * (cards, tabelas, gráficos) ganham a paleta e o canto arredondado dele.
 */
export function SkinPage({ palette, children, className = "" }: { palette: SkinPalette; children: ReactNode; className?: string }) {
  return (
    <div data-chart-theme style={themeVars(palette)} className={`@container [&_.m-in]:rounded-[18px] ${className}`}>
      {children}
    </div>
  );
}

/**
 * Trecho com a paleta de um visual que não troca os tokens da tela toda (Lavanda,
 * Pulso, Monocromo): só os gráficos dali dentro leem estas cores.
 */
export function ChartTheme({ palette, className = "", children }: { palette: SkinPalette; className?: string; children: ReactNode }) {
  return (
    <div data-chart-theme className={className} style={themeVars(palette)}>
      {children}
    </div>
  );
}

// ---- peças dos blocos -----------------------------------------------------------------

/** Cartão de um bloco: título, apoio à direita e o conteúdo ocupando o resto da altura. */
export function Block({ title, aside, children, className = "" }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex h-full min-h-0 min-w-0 flex-col rounded-[22px] border border-line bg-card p-4 ${className}`}>
      {(title || aside) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          {title && <h3 className="text-[13.5px] font-semibold tracking-tight">{title}</h3>}
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

export type Delta = { text: string; up: boolean; good: boolean | null };

/** Variação contra o período anterior: seta e percentual, na cor de bom ou ruim. */
export function DeltaChip({ delta, solid = false }: { delta: Delta; solid?: boolean }) {
  const Arrow = delta.up ? ArrowUpRight : ArrowDownRight;
  const color = solid ? "currentColor" : delta.good === null ? "var(--fg-2)" : delta.good ? "var(--good)" : "var(--error-fg)";
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tnum" style={{ color, background: solid ? "rgb(0 0 0 / 0.12)" : `color-mix(in srgb, ${color} 14%, transparent)` }}>
      <Arrow size={12} strokeWidth={2.4} aria-hidden />
      {delta.text}
    </span>
  );
}

type StatBlockProps = {
  title: string;
  v: string;
  delta?: Delta;
  /** Texto curto ao lado da variação ("alvo R$ 60"). */
  note?: string;
  /** Série do período (minilinha). */
  values?: number[];
  /** Em vez da minilinha: poucas barras (etapas de um funil, por exemplo). */
  bars?: number[];
  color?: string;
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>;
  /** Cartão de destaque: fundo na cor do visual. */
  solid?: string;
};

/** Número do período com a variação e a minilinha embaixo. */
export function StatBlock({ title, v, delta, note, values, bars, color = "var(--accent)", icon: Icon, solid }: StatBlockProps) {
  return (
    <section
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[22px] p-4 ${solid ? "" : "border border-line bg-card"}`}
      style={solid ? { background: solid, color: "var(--on-accent)" } : undefined}
    >
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className={`truncate text-[12px] font-medium ${solid ? "opacity-80" : "text-fg-2"}`}>{title}</p>
        {Icon && (
          <span className="grid size-7 shrink-0 place-items-center rounded-[9px]" style={{ background: solid ? "rgb(0 0 0 / 0.12)" : `color-mix(in srgb, ${color} 16%, transparent)`, color: solid ? "currentColor" : color }}>
            <Icon size={14} strokeWidth={2.2} />
          </span>
        )}
      </div>
      <p className="mt-1 shrink-0 truncate text-[26px] leading-tight font-bold tracking-tight tnum">{v}</p>
      <div className="mt-1 flex min-w-0 shrink-0 items-center gap-1.5">
        {delta && <DeltaChip delta={delta} solid={!!solid} />}
        {note && <span className={`truncate text-[11px] ${solid ? "opacity-75" : "text-fg-2"}`}>{note}</span>}
      </div>
      {/* a minilinha é a parte que encolhe quando o bloco fica baixo (edição, bloco redimensionado) */}
      {values && <Spark values={values} color={solid ? "currentColor" : color} className="mt-1 -mx-1 min-h-0 flex-[1_1_40px]" />}
      {bars && <MiniBars values={bars} color={solid ? "currentColor" : color} className="mt-2 min-h-0 flex-[1_1_36px]" />}
    </section>
  );
}

/** Troca entre duas ou três visões do mesmo bloco. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex rounded-full border border-line p-0.5 text-[11px] font-medium">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-2.5 py-1 transition-colors ${o.value === value ? "bg-accent text-on-accent" : "text-fg-2 hover:text-fg"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LegendDots({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Data de cada ponto (título do tooltip). Sem o dia de hoje (miniatura, render no
 * servidor), datas fixas: nada de relógio no render.
 */
export function dayDates(agos: number[], today?: string): Date[] {
  return agos.map((ago, i) => {
    if (!today) return new Date(2000, 0, 1 + i);
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() - ago);
    return d;
  });
}

/**
 * Soma por semana, só com semanas completas: conta de 7 em 7 a partir do dia mais
 * recente e deixa de fora os dias que sobram no começo (uma semana pela metade
 * pareceria uma queda).
 */
export function weekly(values: number[]): number[] {
  const out: number[] = [];
  for (let i = values.length % 7; i < values.length; i += 7) out.push(values.slice(i, i + 7).reduce((a, b) => a + b, 0));
  return out;
}

/** O primeiro dia de cada semana completa (mesma conta de `weekly`). */
export function weekStarts<T>(days: T[]): T[] {
  return days.filter((_, i) => i >= days.length % 7 && (i - (days.length % 7)) % 7 === 0);
}

// ---- minilinha ------------------------------------------------------------------------

type SparkProps = {
  values: number[];
  color?: string;
  className?: string;
  /** "area": linha com degradê (padrão); "solid": área cheia, sem traço forte; "line": só a linha. */
  variant?: "area" | "solid" | "line";
  strokeWidth?: number;
  endDot?: boolean;
};

/** Minilinha do período, sem eixo. Decorativa: o número vem ao lado. */
export function Spark({ values, color = "var(--accent)", className = "", variant = "area", strokeWidth = 1.9, endDot = true }: SparkProps) {
  const data = useMemo(() => values.map((v) => ({ v })), [values]);
  if (values.length < 2) return <div className={className} aria-hidden />;
  const common = { data, dataKey: "v" as const, color, strokeWidth, endDot, interactive: false, animationDuration: 800 };
  return (
    <FitChart className={className} minHeight={0}>
      {({ width, height }) => (
        <div aria-hidden>
          {variant === "line" ? (
            <LineSparkline {...common} width={width} height={height} padding={{ top: 3, bottom: 3, left: 1, right: endDot ? 5 : 1 }} />
          ) : (
            <AreaSparkline {...common} width={width} height={height} padding={{ top: 4, bottom: variant === "solid" ? 0 : 2, left: 0, right: endDot ? 5 : 0 }} fill={variant === "solid" ? "solid" : "gradient"} fillOpacity={variant === "solid" ? 0.45 : 0.26} />
          )}
        </div>
      )}
    </FitChart>
  );
}

/** Poucas barras lado a lado, sem eixo. Decorativa. */
export function MiniBars({ values, color = "var(--accent)", className = "" }: { values: number[]; color?: string; className?: string }) {
  const data = useMemo(() => values.map((v) => ({ v })), [values]);
  if (!values.length) return <div className={className} aria-hidden />;
  return (
    <FitChart className={className} minHeight={0}>
      {({ width, height }) => (
        <div aria-hidden>
          <BarSparkline data={data} dataKey="v" width={width} height={height} color={color} barGap={6} barRadius={4} yDomain={[0, undefined]} padding={0} interactive={false} animationDuration={800} />
        </div>
      )}
    </FitChart>
  );
}

// ---- gráfico por dia ------------------------------------------------------------------

export type DailySeries = { key: string; label: string; color: string; kind: "area" | "bar" | "line" };

type DailyChartProps = {
  /** Um ponto por dia (ou semana): o valor de cada série pela chave dela. */
  points: Record<string, number>[];
  dates: Date[];
  /** Rótulos do eixo X, um por ponto. */
  labels: string[];
  series: DailySeries[];
  /** Valor no tooltip. */
  format: (key: string, v: number) => string;
  /** Rótulo curto do eixo Y. */
  formatY: (v: number) => string;
  /** Resumo para leitores de tela. */
  summary: string;
};

/** Barras, área e linha no mesmo eixo; ocupa a altura que sobrar no bloco. */
export function DailyChart({ points, dates, labels, series, format, formatY, summary }: DailyChartProps) {
  const data = useMemo(() => points.map((p, i) => ({ date: dates[i], ...p })), [points, dates]);
  const peak = Math.max(1, ...points.flatMap((p) => series.map((s) => p[s.key] ?? 0)));
  const left = Math.ceil(textWidth(formatY(peak), 11)) + 16;
  return (
    <div role="img" aria-label={summary} className="flex min-h-0 flex-1 flex-col text-[11px]">
      <FitChart className="flex-1" minHeight={150}>
        {({ width, height }) => {
          const margin = { top: 10, right: 10, bottom: 26, left };
          const ticks = Math.max(2, Math.min(labels.length, Math.floor((width - left - 10) / 62)));
          return (
            <ComposedChart data={data} margin={margin} aspectRatio="" style={{ width, height, touchAction: "pan-y" }} animationDuration={900} maxBarSize={points.length <= 10 ? 56 : 20}>
              <Grid horizontal numTicksRows={4} strokeDasharray="2 5" />
              {series.map((s) =>
                s.kind === "bar" ? (
                  <SeriesBar key={s.key} dataKey={s.key} fill={s.color} radius={4} />
                ) : s.kind === "area" ? (
                  <Area key={s.key} dataKey={s.key} fill={s.color} fillOpacity={0.3} stroke={s.color} strokeWidth={2.3} curve={curveMonotoneX} fadeEdges={false} />
                ) : (
                  <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={2.3} curve={curveMonotoneX} fadeEdges={false} />
                ),
              )}
              <YAxis formatValue={(v) => (v === 0 ? "" : formatY(v))} numTicks={4} />
              <XAxis labels={labels} numTicks={ticks} />
              <ChartTooltip showDatePill={false} rows={(p) => series.map((s) => ({ color: s.color, label: s.label, value: format(s.key, Number(p[s.key] ?? 0)) }))} />
            </ComposedChart>
          );
        }}
      </FitChart>
    </div>
  );
}

// ---- barras por semana ----------------------------------------------------------------

type WeekBarsProps = {
  values: number[];
  labels: string[];
  /** Cor da última barra (a semana atual) e das anteriores. */
  color: string;
  soft: string;
  /** Nome do que está sendo somado, para o tooltip ("Receita"). */
  what: string;
  format: (v: number) => string;
  summary: string;
  className?: string;
};

/** Uma barra por semana, com a mais recente em destaque e o valor ao apontar. */
export function WeekBars({ values, labels, color, soft, what, format, summary, className = "" }: WeekBarsProps) {
  const last = values.length - 1;
  // duas séries empilhadas (só uma tem valor em cada barra): é o que dá duas cores
  const data = useMemo(() => values.map((v, i) => ({ name: labels[i] ?? String(i + 1), antes: i === last ? 0 : v, atual: i === last ? v : 0 })), [labels, last, values]);
  return (
    <div role="img" aria-label={summary} className={`flex min-h-0 flex-col text-[10px] ${className}`}>
      <FitChart className="flex-1" minHeight={0}>
        {({ width, height }) => (
          <div aria-hidden style={{ width, height }}>
            <BarChart data={data} xDataKey="name" aspectRatio="auto" className="h-full" stacked barGap={0.16} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} animationDuration={900}>
              <Bar dataKey="antes" fill={soft} lineCap={5} />
              <Bar dataKey="atual" fill={color} lineCap={5} />
              <ChartTooltip showCrosshair={false} showDatePill={false} showDots={false} rows={(p) => [{ color, label: what, value: format(Number(p.antes ?? 0) + Number(p.atual ?? 0)) }]} />
            </BarChart>
          </div>
        )}
      </FitChart>
      {/* rótulos fora do gráfico: o eixo da biblioteca pede uma margem que não cabe num card pequeno */}
      <div className="mt-1 grid shrink-0 text-center leading-none text-fg-2" style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }} aria-hidden>
        {data.map((d) => (
          <span key={d.name}>{d.name}</span>
        ))}
      </div>
    </div>
  );
}

type PatternBarsProps = { values: number[]; labels: string[]; fill: string; what: string; format: (v: number) => string; summary: string; className?: string };

/** Barras com preenchimento próprio (um padrão em `url(#id)`, por exemplo) e o valor ao apontar. */
export function PatternBars({ values, labels, fill, what, format, summary, className = "" }: PatternBarsProps) {
  const data = useMemo(() => values.map((v, i) => ({ name: labels[i] ?? String(i + 1), v })), [labels, values]);
  return (
    <div role="img" aria-label={summary} className={`flex min-h-0 flex-col ${className}`}>
      <FitChart className="flex-1" minHeight={0}>
        {({ width, height }) => (
          <div aria-hidden style={{ width, height }}>
            <BarChart data={data} xDataKey="name" aspectRatio="auto" className="h-full" barGap={0.18} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} animationDuration={900}>
              <Bar dataKey="v" fill={fill} stroke="currentColor" lineCap="butt" />
              <ChartTooltip showCrosshair={false} showDatePill={false} showDots={false} rows={(p) => [{ color: "currentColor", label: what, value: format(Number(p.v ?? 0)) }]} />
            </BarChart>
          </div>
        )}
      </FitChart>
    </div>
  );
}

// ---- linhas sem eixo ------------------------------------------------------------------

/** Avisa o visual de qual ponto está apontado (para ele marcar o rótulo do eixo, por exemplo). */
function HoverReporter({ onHover }: { onHover: (i: number | null) => void }) {
  const { tooltipData } = useChart();
  const index = tooltipData?.index ?? null;
  useEffect(() => {
    onHover(index);
  }, [index, onHover]);
  return null;
}

export type Pin = {
  index: number;
  /** Série em que o ponto fica. */
  key: string;
  color: string;
  ring: string;
  /** Raio do ponto. Padrão: 8,5. */
  r?: number;
  /** Faixa vertical de destaque atrás do ponto. */
  column?: boolean;
  /** Etiqueta ao lado do ponto: valor em cima, nome embaixo. */
  caption?: { value: string; label: string; bg: string; fg: string };
};

/** Marca fixa num ponto (o pico, por exemplo). Some enquanto a pessoa aponta outro. */
function PinnedPoint({ pin }: { pin: Pin }) {
  const { tooltipData, xScale, yScale, data, innerHeight, innerWidth } = useChart();
  const row = data[pin.index] as Record<string, unknown> | undefined;
  if (tooltipData || !row) return null;
  const x = xScale(row.date as Date);
  const y = yScale(Number(row[pin.key] ?? 0));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const r = pin.r ?? 8.5;
  const col = Math.min(46, (innerWidth / Math.max(1, data.length)) * 0.78);
  const c = pin.caption;
  const boxW = c ? Math.max(textWidth(c.value, 14), textWidth(c.label, 11.5)) + 24 : 0;
  const boxH = 44;
  const left = x > innerWidth * 0.7;
  const bx = left ? x - r - 10 - boxW : x + r + 10;
  const by = Math.min(Math.max(0, y - 8), Math.max(0, innerHeight - boxH));
  return (
    <g pointerEvents="none">
      {pin.column && <rect x={x - col / 2} y={0} width={col} height={innerHeight} rx={10} fill={pin.ring} opacity={0.14} />}
      <circle cx={x} cy={y} r={r} fill={pin.color} stroke={pin.ring} strokeWidth={Math.max(1, r / 2.8)} />
      {c && (
        <g transform={`translate(${bx} ${by})`}>
          <rect width={boxW} height={boxH} rx={8} fill={c.bg} />
          <text x={12} y={19} fill={c.fg} fontSize={14} fontWeight={700} className="tnum">
            {c.value}
          </text>
          <text x={12} y={35} fill={c.fg} fontSize={11.5} opacity={0.8}>
            {c.label}
          </text>
        </g>
      )}
    </g>
  );
}
(PinnedPoint as unknown as { __isPostOverlay?: boolean }).__isPostOverlay = true;

export type FlowSeries = { key: string; label: string; color: string; width?: number; area?: number; dashed?: boolean };

type FlowLinesProps = {
  points: Record<string, number>[];
  dates: Date[];
  series: FlowSeries[];
  format: (key: string, v: number) => string;
  summary: string;
  /** Ponto marcado quando ninguém está apontando (o pico, por exemplo). */
  pin?: Pin;
  onHover?: (i: number | null) => void;
  className?: string;
  /** Curva mais solta (onda) em vez da monotônica. */
  wavy?: boolean;
};

/** Linhas (e áreas) sem eixo nem grade, de ponta a ponta do bloco, com o valor ao apontar. */
export function FlowLines({ points, dates, series, format, summary, pin, onHover, className = "", wavy = false }: FlowLinesProps) {
  const data = useMemo(() => points.map((p, i) => ({ date: dates[i], ...p })), [points, dates]);
  const curve = wavy ? curveNatural : curveMonotoneX;
  // folga em cima e embaixo: a linha não encosta nas bordas do bloco
  const all = points.flatMap((p) => series.map((s) => p[s.key]).filter((v) => Number.isFinite(v)));
  const lo = all.length ? Math.min(...all) : 0;
  const hi = all.length ? Math.max(...all) : 1;
  const pad = (hi - lo || 1) * 0.18;
  const yDomains = useMemo(() => ({ left: [lo - pad, hi + pad] as [number, number] }), [hi, lo, pad]);
  return (
    <div role="img" aria-label={summary} className={`flex min-h-0 flex-col ${className}`}>
      <FitChart className="flex-1" minHeight={0}>
        {({ width, height }) => (
          <ComposedChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} aspectRatio="" style={{ width, height, touchAction: "pan-y" }} yDomains={yDomains} animationDuration={900}>
            {series.map((s) =>
              s.area ? (
                <Area key={s.key} dataKey={s.key} fill={s.color} fillOpacity={s.area} stroke={s.color} strokeWidth={s.width ?? 2} curve={curve} fadeEdges={false} />
              ) : (
                <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={s.width ?? 2} curve={curve} fadeEdges={false} showHighlight={false} {...(s.dashed ? { dashFromIndex: 0, dashArray: "3,4" } : {})} />
              ),
            )}
            {pin && <PinnedPoint pin={pin} />}
            {onHover && <HoverReporter onHover={onHover} />}
            <ChartTooltip showDatePill={false} rows={(p) => series.map((s) => ({ color: s.color, label: s.label, value: format(s.key, Number(p[s.key] ?? 0)) }))} />
          </ComposedChart>
        )}
      </FitChart>
    </div>
  );
}

// ---- anéis ----------------------------------------------------------------------------

export type RingItem = { label: string; value: number; color: string };

type ShareRingsProps = {
  items: RingItem[];
  /** Texto do centro quando nada está apontado. */
  centerLabel: string;
  /** Formato do número do centro (Intl.NumberFormat). */
  format?: ChartStatFlowFormat;
  summary: string;
  className?: string;
};

const CENTER_VALUE = "font-bold tabular-nums leading-none text-[clamp(0.7rem,15cqw,1.375rem)]";

/** Um anel por item (o maior por fora), cada um preenchido pela parte dele no total. */
export function ShareRings({ items, centerLabel, format, summary, className = "" }: ShareRingsProps) {
  const total = Math.max(1, items.reduce((a, i) => a + i.value, 0));
  // o anel 0 é o de dentro: a lista vem do maior para o menor, então inverte
  const data = useMemo(() => [...items].reverse().map((i) => ({ label: i.label, value: i.value, maxValue: total, color: i.color })), [items, total]);
  return (
    <div role="img" aria-label={summary} className={`flex min-h-0 flex-col ${className}`}>
      <FitChart className="flex-1" minHeight={130}>
        {({ width, height }) => {
          const size = Math.max(120, Math.min(width, height, 260));
          const n = Math.max(1, data.length);
          const stroke = Math.max(7, Math.min(12, size / 18));
          const gap = 5;
          return (
            <div className="grid h-full place-items-center" aria-hidden>
              <RingChart data={data} size={size} strokeWidth={stroke} ringGap={gap} baseInnerRadius={Math.max(30, size / 2 - 8 - n * stroke - (n - 1) * gap)} animationDuration={1000}>
                {data.map((d, i) => (
                  <Ring key={d.label} index={i} lineCap="round" />
                ))}
                <RingCenter defaultLabel={centerLabel} formatOptions={format} valueClassName={CENTER_VALUE} />
              </RingChart>
            </div>
          );
        }}
      </FitChart>
    </div>
  );
}

type GaugeProps = { value: number; max: number; color: string; label: string; summary: string; className?: string };

/** Anel de progresso (quanto de `max` já foi), com o percentual no centro. */
export function Gauge({ value, max, color, label, summary, className = "" }: GaugeProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const data = useMemo(() => [{ label, value: pct, maxValue: 100, color }], [color, label, pct]);
  return (
    <div role="img" aria-label={summary} className={`flex min-h-0 flex-col ${className}`}>
      <FitChart className="flex-1" minHeight={110}>
        {({ width, height }) => {
          const size = Math.max(110, Math.min(width, height, 230));
          const stroke = Math.max(10, size / 11);
          return (
            <div className="grid h-full place-items-center" aria-hidden>
              <RingChart data={data} size={size} strokeWidth={stroke} baseInnerRadius={size / 2 - 8 - stroke} animationDuration={1000}>
                <Ring index={0} lineCap="round" />
                <RingCenter defaultLabel={label} formatOptions={{ maximumFractionDigits: 0 }} suffix="%" />
              </RingChart>
            </div>
          );
        }}
      </FitChart>
    </div>
  );
}

// ---- funil ----------------------------------------------------------------------------

export { StageFunnel, type FunnelStep } from "@/components/charts/StageFunnel";

// ---- ranking --------------------------------------------------------------------------

export type RankRow = { name: string; value: number; display: string };

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…` : text);

/** Nome à esquerda e valor à direita, logo acima de cada barra. */
function RowLabels({ rows }: { rows: RankRow[] }) {
  const { barScale, innerWidth } = useChart();
  if (!barScale) return null;
  return (
    <g>
      {rows.map((r, i) => {
        const y = (barScale(String(i)) ?? 0) - 7;
        const room = Math.max(6, Math.floor((innerWidth - textWidth(r.display, 11.5) - 14) / 6.1));
        return (
          <g key={i}>
            <text x={0} y={y} fill="var(--chart-foreground)" fontSize={11.5} fontWeight={500}>
              {clip(r.name, room)}
            </text>
            <text x={innerWidth} y={y} textAnchor="end" fill="var(--chart-foreground-muted)" fontSize={11.5} className="tnum">
              {r.display}
            </text>
          </g>
        );
      })}
    </g>
  );
}
// os rótulos ficam fora das barras: não entram no recorte da animação de entrada
(RowLabels as unknown as { __isPostOverlay?: boolean }).__isPostOverlay = true;

type RankBarsProps = { rows: RankRow[]; color?: string; summary: string; className?: string };

/** Barras deitadas, da maior para a menor, com o nome e o valor em cima de cada uma. */
export function RankBars({ rows, color = "var(--accent)", summary, className = "" }: RankBarsProps) {
  const data = useMemo(() => rows.map((r, i) => ({ id: String(i), v: r.value })), [rows]);
  if (!rows.length) return <p className="text-[12px] text-fg-2">Sem dados neste recorte.</p>;
  return (
    <div role="img" aria-label={summary} className={`flex min-h-0 flex-col ${className}`}>
      <FitChart className="flex-1" minHeight={rows.length * 30}>
        {({ width, height }) => {
          // altura de cada linha limitada: com poucas linhas, elas não se espalham pelo bloco
          const h = Math.min(height, rows.length * 54 + 20);
          return (
            <div aria-hidden style={{ width, height: h }}>
              <BarChart data={data} xDataKey="id" orientation="horizontal" aspectRatio="auto" className="h-full" barGap={0} barWidth={8} margin={{ top: 20, right: 0, bottom: 0, left: 0 }} animationDuration={900}>
                <Bar dataKey="v" fill={color} lineCap="round" />
                <RowLabels rows={rows} />
              </BarChart>
            </div>
          );
        }}
      </FitChart>
    </div>
  );
}
