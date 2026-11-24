"use client";

// Peças visuais dos blocos exclusivos (ritmo da verba, barra com marcador, grade de horários,
// cascata, ranking com subiu/desceu, mapa do Brasil em quadrados, horas, minigráficos). SVG e
// HTML simples, sem biblioteca nova; as cores vêm de cada visual. As contas estão em insights.ts.

import { ArrowDown, ArrowUp, Sparkles } from "lucide-react";
import { BR_TILES, WEEKDAYS, type MonthClose, type Pacing, type Waterfall } from "./insights";

type Tone = { fg: string; fg2: string; line: string; accent: string; good: string; bad: string };

/** Minigráfico de linha numa célula de tabela (sem eixo; o último ponto marcado). */
export function MiniSpark({ values, color, className = "h-6 w-20", label, scaleMax }: { values: readonly number[]; color: string; className?: string; label?: string; /** Teto comum (minigráficos lado a lado na mesma escala). */ scaleMax?: number }) {
  if (values.length < 2) return <span className={className} aria-hidden />;
  const max = scaleMax ?? Math.max(...values, 1e-9);
  const min = scaleMax != null ? 0 : Math.min(...values, 0);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * 100, 28 - ((v - min) / span) * 24]);
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r={2.4} fill={color} />
    </svg>
  );
}

/**
 * Barra com marcador: o valor numa barra, a meta (ou a média) num traço e a faixa do normal ao
 * fundo. No lugar de mostrador: lê-se o comprimento contra a mesma base.
 */
export function BulletBar({ value, target, lo, hi, max, color, tone, label }: { value: number; target?: number | null; lo?: number; hi?: number; max?: number; color: string; tone: Tone; label: string }) {
  const top = Math.max(max ?? 0, value, target ?? 0, hi ?? 0) * 1.1 || 1;
  const pc = (v: number) => `${Math.min(100, Math.max(0, (v / top) * 100))}%`;
  return (
    <div role="img" aria-label={label} className="relative h-3.5 w-full rounded-full" style={{ background: tone.line }}>
      {lo != null && hi != null && <span className="absolute inset-y-0 rounded-full opacity-60" style={{ left: pc(lo), width: `calc(${pc(hi)} - ${pc(lo)})`, background: tone.fg2 }} aria-hidden />}
      <span className="absolute inset-y-[3px] left-0 rounded-full" style={{ width: pc(value), background: color }} aria-hidden />
      {target != null && target > 0 && <span className="absolute -inset-y-1 w-[3px] rounded-full" style={{ left: `calc(${pc(target)} - 1.5px)`, background: tone.fg }} aria-hidden />}
    </div>
  );
}

/** Ritmo da verba: o gasto acumulado do mês, a linha ideal (tracejada) e para onde vai no ritmo atual. */
export function PacingChart({ p, tone, format, className = "h-[120px]" }: { p: Pacing; tone: Tone; format: (cents: number) => string; className?: string }) {
  const top = Math.max(p.monthly, p.projected, p.actual.at(-1) ?? 0) * 1.08 || 1;
  const x = (d: number) => (d / Math.max(1, p.daysInMonth - 1)) * 100;
  const y = (v: number) => 100 - (v / top) * 100;
  const actual = p.actual.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const lastX = x(p.actual.length - 1);
  const lastY = y(p.actual.at(-1) ?? 0);
  const color = p.status === "no ritmo" ? tone.good : p.status === "estoura" ? tone.bad : tone.accent;
  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" role="img" aria-label={`Verba do mês: ${format(p.spent)} de ${format(p.monthly)} até o dia ${p.day}; no ritmo atual, fecha em ${format(p.projected)}.`}>
        <line x1={0} x2={100} y1={y(p.monthly)} y2={y(p.monthly)} stroke={tone.fg2} strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" opacity={0.6} />
        <polyline points={p.ideal.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={tone.fg2} strokeWidth={1.4} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        <polygon points={`0,100 ${actual} ${lastX},100`} fill={color} opacity={0.18} />
        <polyline points={actual} fill="none" stroke={color} strokeWidth={2.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <line x1={lastX} y1={lastY} x2={100} y2={y(p.projected)} stroke={color} strokeWidth={2} strokeDasharray="1 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="absolute top-0 left-0 text-[10px]" style={{ color: tone.fg2 }}>
        verba {format(p.monthly)}
      </span>
    </div>
  );
}

/** Grade dia da semana × hora: quanto mais forte a cor, mais resultado. */
export function HeatGrid({ grid, color, tone, what, format }: { grid: readonly (readonly number[])[]; color: string; tone: Tone; what: string; format: (v: number) => string }) {
  const max = Math.max(...grid.flat(), 1e-9);
  return (
    <div className="min-w-0" role="img" aria-label={`${what} por dia da semana e hora`}>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: "28px repeat(24, minmax(0, 1fr))" }}>
        {grid.map((row, d) => (
          <div key={d} className="contents">
            <span className="pr-1 text-right text-[9.5px] leading-[14px]" style={{ color: tone.fg2 }}>
              {WEEKDAYS[d]}
            </span>
            {row.map((v, h) => (
              <span
                key={h}
                title={`${WEEKDAYS[d]}, ${String(h).padStart(2, "0")}h: ${format(v)} ${what.toLowerCase()}`}
                className="h-[14px] rounded-[3px]"
                style={{ background: v > 0 ? color : tone.line, opacity: v > 0 ? 0.15 + 0.85 * (v / max) : 1 }}
              />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="text-center text-[8.5px] leading-3" style={{ color: tone.fg2 }}>
            {h % 6 === 0 ? `${h}h` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Cascata: do total anterior ao atual, o quanto cada item somou (verde) ou tirou (vermelho). */
export function WaterfallBars({ w, tone, format, base }: { w: Waterfall; tone: Tone; format: (v: number) => string; base: string }) {
  const bars: { label: string; from: number; to: number; kind: "total" | "up" | "down" }[] = [{ label: "Anterior", from: 0, to: w.start, kind: "total" }];
  let run = w.start;
  for (const s of w.steps) {
    bars.push({ label: s.label, from: run, to: run + s.delta, kind: s.delta >= 0 ? "up" : "down" });
    run += s.delta;
  }
  bars.push({ label: "Atual", from: 0, to: w.end, kind: "total" });
  const top = Math.max(...bars.map((b) => Math.max(b.from, b.to)), 1);
  return (
    <div className="flex min-h-0 flex-1 flex-col" role="img" aria-label={`De ${format(w.start)} para ${format(w.end)}: ${w.steps.map((s) => `${s.label} ${s.delta >= 0 ? "+" : "−"}${format(Math.abs(s.delta))}`).join("; ")}.`}>
      <div className="flex h-[130px] items-stretch gap-1.5 @[700px]:h-auto @[700px]:min-h-[90px] @[700px]:flex-1">
        {bars.map((b, i) => {
          const lo = Math.min(b.from, b.to);
          const hi = Math.max(b.from, b.to);
          const fill = b.kind === "total" ? base : b.kind === "up" ? tone.good : tone.bad;
          return (
            <div key={i} className="relative min-w-0 flex-1" title={`${b.label}: ${b.kind === "total" ? format(b.to) : `${b.kind === "up" ? "+" : "−"}${format(hi - lo)}`}`}>
              <span className="absolute inset-x-0 rounded-[4px]" style={{ bottom: `${(lo / top) * 100}%`, height: `${Math.max(1.5, ((hi - lo) / top) * 100)}%`, background: fill }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5" aria-hidden>
        {bars.map((b, i) => (
          <span key={i} className="min-w-0 flex-1 text-center text-[9.5px] leading-tight" style={{ color: tone.fg2 }} title={b.label}>
            {/* o nome (cortado; inteiro ao apontar) e, embaixo, quanto somou ou tirou */}
            <span className="block truncate">{b.label}</span>
            <span className="block font-semibold tnum" style={{ color: b.kind === "total" ? tone.fg : b.kind === "up" ? tone.good : tone.bad }}>
              {b.kind === "total" ? format(b.to) : `${b.kind === "up" ? "+" : "−"}${format(Math.abs(b.to - b.from))}`}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Subiu/desceu no ranking contra o período anterior (null = nova). */
export function MoveTag({ moved, tone }: { moved: number | null; tone: Tone }) {
  if (moved === null)
    return (
      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold" style={{ background: tone.line, color: tone.accent }} title="Nova no ranking">
        <Sparkles size={10} aria-hidden /> nova
      </span>
    );
  if (moved === 0)
    return (
      <span className="w-9 shrink-0 text-center text-[10px]" style={{ color: tone.fg2 }} title="Mesma posição">
        =
      </span>
    );
  const up = moved > 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex w-9 shrink-0 items-center justify-center gap-0.5 text-[10.5px] font-semibold tnum" style={{ color: up ? tone.good : tone.bad }} title={`${up ? "Subiu" : "Desceu"} ${Math.abs(moved)} ${Math.abs(moved) === 1 ? "posição" : "posições"}`}>
      <Icon size={11} aria-hidden /> {Math.abs(moved)}
    </span>
  );
}

/** Mapa do Brasil em quadrados: um por estado, mais forte onde há mais resultado. */
export function BrTiles({ shares, color, tone }: { shares: Map<string, number>; color: string; tone: Tone }) {
  const max = Math.max(...shares.values(), 1e-9);
  return (
    // quadrados de tamanho fixo: o mapa cabe no bloco em qualquer largura (7 × 8 quadrados de 20 px)
    <div className="grid shrink-0 gap-[2px]" style={{ gridTemplateColumns: "repeat(7, 20px)", gridTemplateRows: "repeat(8, 20px)" }} role="img" aria-label={`Por estado: ${[...shares].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([uf, v]) => `${uf} ${Math.round(v * 100)}%`).join(", ")}.`}>
      {Object.entries(BR_TILES).map(([uf, [r, c]]) => {
        const v = shares.get(uf) ?? 0;
        return (
          <span
            key={uf}
            title={`${uf}: ${Math.round(v * 100)}%`}
            className="grid size-5 place-items-center rounded-[4px] text-[7.5px] font-semibold"
            style={{ gridRow: r + 1, gridColumn: c + 1, background: v > 0 ? color : tone.line, opacity: v > 0 ? 0.25 + 0.75 * (v / max) : 1, color: v / max > 0.5 ? "#fff" : v > 0 ? tone.fg : tone.fg2 }}
          >
            {uf}
          </span>
        );
      })}
    </div>
  );
}

/** Barras por hora do dia, com o pico em destaque. */
export function HourBars({ values, color, tone, what }: { values: readonly number[]; color: string; tone: Tone; what: string }) {
  const max = Math.max(...values, 1e-9);
  const peak = values.indexOf(Math.max(...values));
  return (
    <div className="flex min-h-0 flex-1 flex-col" role="img" aria-label={`${what} por hora: pico às ${peak}h.`}>
      <div className="flex h-[110px] items-end gap-[2px] @[700px]:h-auto @[700px]:min-h-[70px] @[700px]:flex-1">
        {values.map((v, h) => (
          <span key={h} title={`${String(h).padStart(2, "0")}h`} className="min-w-0 flex-1 rounded-t-[2px]" style={{ height: `${Math.max(2, (v / max) * 100)}%`, background: h === peak ? color : tone.fg2, opacity: h === peak ? 1 : 0.35 }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[9px]" style={{ color: tone.fg2 }} aria-hidden>
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}

/** Onde o mês fecha: o acumulado até hoje (cheio) e o previsto até o fim do mês (tracejado, com a faixa). */
export function MonthCloseChart({ m, color, tone, label, format, className = "h-[110px]" }: { m: MonthClose; color: string; tone: Tone; label: string; /** Valor do eixo (R$ ou contagem). */ format: (v: number) => string; className?: string }) {
  const n = m.done.length + m.future.length;
  const top = Math.max(m.totalHi, m.done.at(-1) ?? 0) * 1.05 || 1;
  const x = (i: number) => (i / Math.max(1, n - 1)) * 100;
  const y = (v: number) => 100 - (v / top) * 100;
  const off = m.done.length;
  const band = [...m.hi.map((v, i) => `${x(off + i)},${y(v)}`), ...m.lo.map((v, i) => `${x(off + i)},${y(v)}`).reverse()].join(" ");
  const last = `${x(off - 1)},${y(m.done.at(-1) ?? 0)}`;
  // eixo: o valor em três linhas (0, metade, topo) e os dias do mês (o 1º, o último com dados, o último do mês)
  const ticks = [top, top / 2, 0];
  const days = [
    { at: 0, text: "dia 1" },
    ...(off > 1 && off < n ? [{ at: off - 1, text: `dia ${off}` }] : []),
    { at: n - 1, text: `dia ${n}` },
  ];
  return (
    <div className={`grid grid-cols-[auto_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto] gap-x-2 ${className}`} role="img" aria-label={label}>
      <div className="flex flex-col justify-between py-0 text-right text-[10px] leading-none tnum" style={{ color: tone.fg2 }} aria-hidden>
        {ticks.map((t, k) => (
          <span key={k}>{format(t)}</span>
        ))}
      </div>
      <div className="relative min-h-0">
        {ticks.map((_, k) => (
          <span key={k} className="absolute inset-x-0 border-t" style={{ top: `${k * 50}%`, borderColor: tone.line, opacity: 0.7 }} aria-hidden />
        ))}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
          {m.future.length > 0 && <polygon points={`${last} ${band}`} fill={color} opacity={0.14} />}
          <polyline points={m.done.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={color} strokeWidth={2.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {m.future.length > 0 && <polyline points={`${last} ${m.future.map((v, i) => `${x(off + i)},${y(v)}`).join(" ")}`} fill="none" stroke={color} strokeWidth={2} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
          <line x1={x(off - 1)} x2={x(off - 1)} y1={0} y2={100} stroke={tone.fg2} strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" opacity={0.6} />
        </svg>
      </div>
      <span aria-hidden />
      <div className="relative mt-1 h-3.5 text-[10px] leading-none tnum" style={{ color: tone.fg2 }} aria-hidden>
        {days.map((d) => (
          <span key={d.at} className="absolute whitespace-nowrap" style={{ left: `${x(d.at)}%`, transform: d.at === 0 ? "none" : d.at === n - 1 ? "translateX(-100%)" : "translateX(-50%)" }}>
            {d.text}
          </span>
        ))}
      </div>
    </div>
  );
}
