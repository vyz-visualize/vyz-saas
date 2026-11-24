"use client";

// Desempenho diário: uma métrica por vez (a pessoa escolhe no seletor), uma linha por
// plataforma de anúncios e, com mais de uma, o total junto. Métrica de custo (CPA, CPL, CPC,
// CPM) oscila muito de um dia para o outro: as linhas mostram a média móvel de 7 dias e o dia
// a dia fica em pontinhos claros, com a explicação no próprio bloco. Os últimos 3 dias ficam
// numa faixa "em maturação" (as conversões ainda chegam). Passar o mouse mostra o dia inteiro.

import { Check, ChevronDown } from "lucide-react";
import { useState, type PointerEvent } from "react";
import { useElementSize } from "@/components/charts/useSize";
import { niceStep } from "@/components/charts/axis";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/Menu";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { totals } from "@/features/metrics/compute";
import { formatMetric, formatValue, metric, type MetricDef, type MetricId } from "@/features/metrics/definitions";
import type { DayRow } from "@/features/metrics/source";
import { sampleRowDate } from "@/features/metrics/filter-dataset";
import { brl, brlCompact, decimal, int, pct } from "@/lib/format";
import { hasGoal } from "@/features/metrics/targets";
import { isSampleSpendDerived } from "../metric-prefs";
import { platformColor, type WidgetContext } from "./Widgets";

/** Métricas de custo: a linha é a média móvel de 7 dias. */
const COST: ReadonlySet<MetricId> = new Set(["cpa", "cpl", "cplq", "cpc", "cpm", "cpv"]);
const MATURING = 3;

/** O dia de uma plataforma como linha completa: o que ela não divide (receita, leads) vai na parte das conversões dela. */
export function platformRows(rows: readonly DayRow[], id: PlatformId, all: readonly PlatformId[]): DayRow[] {
  return rows.map((d) => {
    const p = d.byPlatform[id];
    const attributed = all.reduce((a, o) => a + (d.byPlatform[o]?.conv ?? 0), 0);
    const share = p && attributed > 0 ? p.conv / attributed : 0;
    return {
      ...d,
      spend: p?.spend ?? 0,
      impressions: p?.impressions ?? 0,
      clicks: p?.clicks ?? 0,
      conversions: p?.conv ?? 0,
      revenue: d.revenue * share,
      leads: d.leads * share,
      qualified: d.qualified * share,
      visits: d.visits * share,
      calls: d.calls * share,
      sessions: d.sessions * share,
      views: d.views * share,
      byPlatform: {},
    };
  });
}

/** Valor de cada dia e a média móvel de 7 dias (que pula os dias em maturação). */
function seriesOf(rows: readonly DayRow[], id: MetricId) {
  const daily = rows.map((d) => totals([d])[id]);
  const avg = rows.map((_, i) => {
    const slice = rows.slice(Math.max(0, i - 6), i + 1).filter((d) => !d.maturing);
    return slice.length ? totals(slice)[id] : NaN;
  });
  return { daily, avg };
}

function axisFmt(format: MetricDef["format"]): (v: number) => string {
  switch (format) {
    case "brl":
      return (v) => brl(v, { decimals: false });
    case "brlCompact":
      return brlCompact;
    case "int":
      return (v) => (v >= 10000 ? `${decimal(v / 1000, 0)} mil` : int(Math.round(v)));
    case "pct":
      return (v) => pct(v, v !== 0 && Math.abs(v) < 0.1 ? 1 : 0);
    case "decimal":
      return (v) => decimal(v, 1);
  }
}

type Series = { id: string; label: string; color: string; daily: number[]; avg: number[]; total?: boolean };

const MON = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dayLabel = (iso: string) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]}`;

export function TrendWidget({ ctx, metrics, title }: { ctx: WidgetContext; metrics: readonly MetricId[]; title?: string }) {
  const options = metrics.filter((m) => !(ctx.hideSpend && isSampleSpendDerived(m)));
  const [picked, setPicked] = useState<MetricId>(options[0] ?? "conversions");
  const id = options.includes(picked) ? picked : (options[0] ?? "conversions");
  const def = metric(id, ctx.profile);
  const cost = COST.has(id);
  const [showDaily, setShowDaily] = useState(false);
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const rows = ctx.chart?.current ?? ctx.ds.current;
  const plats = ctx.ds.adPlatforms;

  // uma linha por plataforma (com mais de uma) e o total
  const all: Series[] = (() => {
    const out: Series[] = [];
    if (plats.length > 1)
      for (const p of plats) {
        const s = seriesOf(platformRows(rows, p, plats), id);
        out.push({ id: p, label: PLATFORMS[p].name, color: platformColor(p), ...s });
      }
    const t = seriesOf(rows, id);
    out.unshift({ id: "total", label: plats.length > 1 ? "Total" : (plats[0] ? PLATFORMS[plats[0]].name : def.label), color: "var(--fg)", total: true, ...t });
    return out;
  })();

  const shown = all.filter((s) => !off.has(s.id));
  const dates = ctx.today ? rows.map((r) => sampleRowDate(ctx.today!, r.ago)) : rows.map((_, i) => `dia ${i + 1}`);
  const goal = (id === "cpa" || id === "cpl" || id === "cplq") && hasGoal(ctx.ds) ? ctx.ds.goal : undefined;
  const totalNow = formatMetric(id, ctx.cur[id], def.format);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <h3 className="text-[12.5px] font-semibold text-fg">{title ?? "Desempenho diário"}</h3>
          <p className="text-[11px] text-fg-2">{cost ? "Média móvel de 7 dias: suaviza a oscilação do dia a dia" : "Valor de cada dia do período"}</p>
        </div>
        <span className="flex-1" />
        <Menu modal={false}>
          <MenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-field/60 pr-2 pl-3 text-[12.5px] font-medium outline-none hover:border-fg-2/50 focus-visible:ring-2 focus-visible:ring-accent">
            <span className="text-fg-2">Métrica</span> {def.label}
            <ChevronDown size={14} aria-hidden className="text-fg-2" />
          </MenuTrigger>
          <MenuContent align="end">
            {options.map((m) => (
              <MenuItem key={m} icon={m === id ? <Check size={14} /> : <span className="size-3.5" />} onSelect={() => setPicked(m)}>
                {metric(m, ctx.profile).label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </header>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
        {all.map((s) => {
          const hidden = off.has(s.id);
          const last = s.total ? totalNow : null;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={!hidden}
              onClick={() =>
                setOff((o) => {
                  const n = new Set(o);
                  if (n.has(s.id)) n.delete(s.id);
                  else if (shown.length > 1) n.add(s.id);
                  return n;
                })
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-accent ${hidden ? "border-line opacity-45" : "border-line/80 bg-surface-2"}`}
            >
              <span className="h-[3px] w-3 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="font-medium">{s.label}</span>
              {last && <span className="text-fg-2 tnum">{last}</span>}
            </button>
          );
        })}
        <span className="flex-1" />
        {cost && (
          <button type="button" aria-pressed={showDaily} onClick={() => setShowDaily((v) => !v)} className={`rounded-full px-2 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-accent ${showDaily ? "bg-accent-soft text-fg" : "text-fg-2 hover:text-fg"}`}>
            {showDaily ? "✓ " : ""}dia a dia
          </button>
        )}
        {goal !== undefined && (
          <span className="inline-flex items-center gap-1 text-fg-2">
            <span className="w-3 border-t border-dashed border-fg-2" aria-hidden /> alvo {brl(goal, { decimals: false })}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-fg-2">
          <span className="size-2 rounded-[2px] bg-fg-2/25" aria-hidden /> em maturação
        </span>
      </div>
      <Plot series={shown} cost={cost} showDaily={!cost || showDaily} dates={dates} goal={goal} format={(v) => formatValue(v, def.format)} axis={axisFmt(def.format)} label={def.label} />
    </div>
  );
}

function Plot({ series, cost, showDaily, dates, goal, format, axis, label }: { series: Series[]; cost: boolean; showDaily: boolean; dates: string[]; goal?: number; format: (v: number) => string; axis: (v: number) => string; label: string }) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const W = size?.width ?? 0;
  const H = Math.max(110, size?.height ?? 0);
  const n = dates.length;

  // escala: linha principal (média, nos custos; o dia, no resto), sem os dias em maturação
  const main = (s: Series) => (cost ? s.avg : s.daily);
  const settled = (v: number[]) => v.slice(0, Math.max(1, n - MATURING)).filter(Number.isFinite);
  const pool = [...series.flatMap((s) => settled(main(s))), ...(showDaily && cost ? series.flatMap((s) => settled(s.daily)) : []), ...(goal ? [goal] : [])];
  const rawMax = pool.length ? Math.max(...pool) : 1;
  const rawMin = pool.length ? Math.min(...pool) : 0;
  // custo e taxas: o eixo começa perto do menor valor (as linhas não ficam achatadas no meio); volume começa no zero
  const from = cost || rawMin > rawMax * 0.5 ? rawMin * 0.85 : 0;
  const step = niceStep(rawMax - from || 1, Math.max(2, Math.min(5, Math.floor(H / 44))));
  const lo = Math.max(0, Math.floor(from / step) * step);
  const hi = Math.ceil((rawMax * 1.04) / step) * step || 1;
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const left = Math.max(...ticks.map((t) => axis(t).length)) * 6.2 + 10;
  const right = 8;
  const top = 6;
  const bottom = 20;
  const pw = Math.max(10, W - left - right);
  const ph = Math.max(10, H - top - bottom);
  const x = (i: number) => left + (n > 1 ? (i / (n - 1)) * pw : pw / 2);
  const y = (v: number) => top + ph - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1)) * ph;
  const path = (v: number[]) => {
    let d = "";
    let pen = false;
    v.forEach((val, i) => {
      if (!Number.isFinite(val)) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(val).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 64))));
  const matX = x(Math.max(0, n - MATURING)) - (n > 1 ? pw / (n - 1) / 2 : 0);
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - left) / pw) * (n - 1));
    setHover(i >= 0 && i < n ? i : null);
  };
  const single = series.length === 1;
  const summary = `${label} por dia${cost ? ", média móvel de 7 dias" : ""}: ${series.map((s) => `${s.label} ${format(main(s).filter(Number.isFinite).at(-1) ?? NaN)}`).join(", ")}.`;

  return (
    <div ref={ref} role="img" aria-label={summary} data-chart-theme className="relative min-h-[110px] flex-1 select-none" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      {W > 0 && (
        <svg width={W} height={H} className="absolute inset-0 overflow-visible" aria-hidden>
          <defs>
            {series.map((s, k) => (
              <linearGradient key={s.id} id={`trend-fill-${k}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.total ? "var(--accent)" : s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.total ? "var(--accent)" : s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={left + pw} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeOpacity={0.6} strokeDasharray={t === lo ? undefined : "2 4"} />
              <text x={left - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10.5} fill="var(--fg-2)" className="tnum">
                {axis(t)}
              </text>
            </g>
          ))}
          {/* dias em maturação */}
          <rect x={matX} y={top} width={Math.max(0, left + pw - matX)} height={ph} fill="var(--fg-2)" opacity={0.08} rx={4} />
          {goal !== undefined && <line x1={left} x2={left + pw} y1={y(goal)} y2={y(goal)} stroke="var(--fg-2)" strokeDasharray="5 4" strokeWidth={1.2} />}
          {/* uma série: área suave embaixo da linha */}
          {single && (() => {
            const v = main(series[0]);
            const first = v.findIndex(Number.isFinite);
            const lastI = v.length - 1 - [...v].reverse().findIndex(Number.isFinite);
            if (first < 0) return null;
            return <path d={`${path(v)}L${x(lastI)},${top + ph}L${x(first)},${top + ph}Z`} fill="url(#trend-fill-0)" />;
          })()}
          {showDaily &&
            cost &&
            series.map((s) =>
              s.daily.map((v, i) => (Number.isFinite(v) ? <circle key={`${s.id}-${i}`} cx={x(i)} cy={y(v)} r={1.8} fill={s.total ? "var(--fg-2)" : s.color} opacity={0.45} /> : null)),
            )}
          {series.map((s) => (
            <path key={s.id} d={path(main(s))} fill="none" stroke={s.total && !single ? "var(--fg)" : s.total ? "var(--accent)" : s.color} strokeWidth={s.total ? 2.4 : 2} strokeDasharray={s.total && !single ? "0" : undefined} strokeLinejoin="round" strokeLinecap="round" opacity={s.total && !single ? 0.85 : 1} />
          ))}
          {dates.map((dt, i) =>
            i % labelEvery === (n - 1) % labelEvery ? (
              <text key={i} x={x(i)} y={H - 4} textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"} fontSize={10.5} fill="var(--fg-2)">
                {dt.includes("-") ? dayLabel(dt) : dt}
              </text>
            ) : null,
          )}
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + ph} stroke="var(--fg-2)" strokeOpacity={0.6} strokeDasharray="3 3" />
              {series.map((s) => {
                const v = main(s)[hover];
                return Number.isFinite(v) ? <circle key={s.id} cx={x(hover)} cy={y(v)} r={3.5} fill="var(--card)" stroke={s.total && !single ? "var(--fg)" : s.total ? "var(--accent)" : s.color} strokeWidth={2} /> : null;
              })}
            </g>
          )}
        </svg>
      )}
      {hover != null && W > 0 && (
        <div
          className="pointer-events-none absolute top-1 z-10 min-w-[150px] rounded-[10px] border border-line bg-card/95 px-2.5 py-2 text-[11.5px] shadow-pop backdrop-blur"
          style={x(hover) > W * 0.6 ? { right: W - x(hover) + 12 } : { left: x(hover) + 12 }}
        >
          <p className="mb-1 font-semibold">
            {dates[hover].includes("-") ? dayLabel(dates[hover]) : dates[hover]}
            {hover >= n - MATURING && <span className="ml-1 font-normal text-fg-2">· em maturação</span>}
          </p>
          {series.map((s) => (
            <p key={s.id} className="flex items-center justify-between gap-3 tnum">
              <span className="inline-flex items-center gap-1.5 text-fg-2">
                <span className="size-2 rounded-full" style={{ background: s.total ? (single ? "var(--accent)" : "var(--fg)") : s.color }} />
                {s.label}
              </span>
              <span className="font-semibold">
                {format(main(s)[hover])}
                {cost && showDaily && Number.isFinite(s.daily[hover]) && <span className="ml-1 font-normal text-fg-2">(dia {format(s.daily[hover])})</span>}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
