"use client";

// Período do dashboard com a comparação junto: um botão só no topo, que abre atalhos à
// esquerda, dois meses de calendário (um no celular) e, no pé, a chave de comparar com o
// período anterior (mostrando as datas dele). Atalho aplica na hora; intervalo escolhido
// no calendário espera o Aplicar. O período atual termina ontem (hoje ainda está
// acontecendo), como em analytics/ranges.

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, GitCompareArrows } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { usePortalContainer } from "./portal";
import type { Period, Range } from "./PeriodPicker";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MON = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];
const DAY = 86_400_000;

const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const add = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const same = (a: Date, b: Date) => a.getTime() === b.getTime();
const span = (r: Range) => Math.round((day0(r.to).getTime() - day0(r.from).getTime()) / DAY) + 1;
const short = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]}`;
const fmt = (r: Range) => (r.from.getFullYear() === r.to.getFullYear() ? `${short(r.from)} – ${short(r.to)}` : `${short(r.from)} ${r.from.getFullYear()} – ${short(r.to)} ${r.to.getFullYear()}`);

type Preset = { id: string; label: string; period: Period; days?: number };
const PRESETS: Preset[] = [
  { id: "7d", label: "Últimos 7 dias", period: "7d" },
  { id: "14d", label: "Últimos 14 dias", period: "custom", days: 14 },
  { id: "30d", label: "Últimos 30 dias", period: "30d" },
  { id: "mes", label: "Este mês", period: "mes" },
  { id: "60d", label: "Últimos 60 dias", period: "custom", days: 60 },
];

/** O intervalo que o período cobre (termina ontem; "Este mês" começa no dia 1). */
export function periodRange(period: Period, range: Range | null, customDays: number, today = day0(new Date())): Range {
  const to = add(today, -1);
  if (period === "custom" && range) return { from: day0(range.from), to: day0(range.to) };
  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "mes" ? to.getDate() : Math.min(60, Math.max(3, customDays || 14));
  return { from: add(to, -(days - 1)), to };
}

/** O período anterior: os mesmos N dias logo antes. */
export const previousRange = (r: Range): Range => ({ from: add(r.from, -span(r)), to: add(r.from, -1) });

/** Qual atalho o período atual é (14 e 60 dias são intervalos que terminam ontem). */
function presetOf(period: Period, range: Range | null, today: Date): string | null {
  if (period !== "custom") return period;
  if (!range || !same(day0(range.to), add(today, -1))) return null;
  return PRESETS.find((p) => p.days === span(range))?.id ?? null;
}

type Props = {
  period: Period;
  range: Range | null;
  customDays: number;
  onChange: (p: Period, range?: Range) => void;
  compare: boolean;
  onCompare: (on: boolean) => void;
  maxDays?: number;
  /** Só o ícone e o atalho, sem as datas (barra recolhida, celular). */
  compact?: boolean;
  className?: string;
};

export function DateRangePicker({ period, range, customDays, onChange, compare, onCompare, maxDays = 60, compact = false, className = "" }: Props) {
  const container = usePortalContainer();
  const [open, setOpen] = useState(false);
  const [today] = useState(() => day0(new Date()));
  const current = periodRange(period, range, customDays, today);
  const preset = presetOf(period, range, today);
  const label = preset ? PRESETS.find((p) => p.id === preset)!.label : `${span(current)} dias`;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        data-tour="periodo"
        aria-label={`Período: ${label}, ${fmt(current)}${compare ? ", comparando com o período anterior" : ""}`}
        className={`group inline-flex h-9 min-w-0 items-center gap-2 rounded-full border border-line bg-field/70 pr-2.5 pl-3 text-left text-[13px] text-fg outline-none transition-colors hover:border-fg-2/50 focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:border-accent ${className}`}
      >
        <CalendarDays size={15} aria-hidden className="shrink-0 text-fg-2" />
        <span className="truncate font-medium">{label}</span>
        {!compact && <span className="hidden truncate text-fg-2 tnum @[1100px]:inline">{fmt(current)}</span>}
        {compare && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-fg" title="Comparando com o período anterior">
            <GitCompareArrows size={11} aria-hidden />
            {!compact && <span className="hidden @[900px]:inline">vs anterior</span>}
          </span>
        )}
        <ChevronDown size={15} aria-hidden className="shrink-0 text-fg-2 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Content sideOffset={8} collisionPadding={12} align="end" className="pop z-[90] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-[18px] border border-line bg-card text-fg shadow-pop outline-none">
          {open && (
            <Body
              today={today}
              current={current}
              preset={preset}
              maxDays={maxDays}
              compare={compare}
              onCompare={onCompare}
              onPreset={(p) => {
                if (p.days) onChange("custom", { from: add(today, -p.days), to: add(today, -1) });
                else onChange(p.period);
                setOpen(false);
              }}
              onApply={(r) => {
                onChange("custom", r);
                setOpen(false);
              }}
              onCancel={() => setOpen(false)}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

type BodyProps = {
  today: Date;
  current: Range;
  preset: string | null;
  maxDays: number;
  compare: boolean;
  onCompare: (on: boolean) => void;
  onPreset: (p: Preset) => void;
  onApply: (r: Range) => void;
  onCancel: () => void;
};

function Body({ today, current, preset, maxDays, compare, onCompare, onPreset, onApply, onCancel }: BodyProps) {
  const last = add(today, -1);
  // o mês da direita é o do fim do período; o da esquerda, o anterior
  const [month, setMonth] = useState(() => new Date(current.to.getFullYear(), current.to.getMonth() - 1, 1));
  const [draft, setDraft] = useState<Range>(current);
  const [start, setStart] = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);

  // em destaque: o que está sendo escolhido ou o rascunho
  const a = start ?? draft.from;
  const b = start ? (hover ?? start) : draft.to;
  const lo = a < b ? a : b;
  const hi = a < b ? b : a;
  const shown: Range = { from: lo, to: hi };
  const prev = previousRange(start ? (hover ? shown : { from: start, to: start }) : draft);
  const tooLong = (d: Date) => !!start && Math.abs(span({ from: start, to: d })) > maxDays;
  const changed = !start && (!same(draft.from, current.from) || !same(draft.to, current.to));

  const choose = (d: Date) => {
    if (!start) {
      setStart(d);
      return;
    }
    setDraft(d < start ? { from: d, to: start } : { from: start, to: d });
    setStart(null);
  };
  const canNext = new Date(month.getFullYear(), month.getMonth() + 2, 1) <= today;

  return (
    <div className="flex w-[min(92vw,640px)] flex-col sm:flex-row">
      <ul className="flex gap-1 overflow-x-auto border-b border-line p-2 sm:w-44 sm:shrink-0 sm:flex-col sm:border-r sm:border-b-0" aria-label="Atalhos de período">
        {PRESETS.map((p) => (
          <li key={p.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onPreset(p)}
              aria-pressed={preset === p.id}
              className={`h-9 w-full rounded-[10px] px-3 text-left text-[13px] whitespace-nowrap outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent ${preset === p.id ? "bg-accent-soft font-semibold text-fg" : "text-fg-2 hover:text-fg"}`}
            >
              {p.label}
            </button>
          </li>
        ))}
        <li className="shrink-0 sm:mt-auto">
          <p className={`px-3 py-2 text-[12px] ${preset ? "text-fg-2" : "font-semibold text-fg"}`}>{preset ? "Ou escolha no calendário" : "Personalizado"}</p>
        </li>
      </ul>
      <div className="min-w-0 flex-1 p-3">
        <div className="mb-1 flex items-center justify-between">
          <button type="button" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="inline-flex size-8 items-center justify-center rounded-full text-fg-2 outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
            <ChevronLeft size={16} aria-hidden />
          </button>
          <p className="text-[12.5px] text-fg-2" aria-live="polite">
            {start ? "Agora escolha o último dia" : `Até ${maxDays} dias`}
          </p>
          <button type="button" aria-label="Próximo mês" disabled={!canNext} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="inline-flex size-8 items-center justify-center rounded-full text-fg-2 outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30">
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2" onMouseLeave={() => setHover(null)}>
          {[0, 1].map((i) => (
            <Month
              key={i}
              month={new Date(month.getFullYear(), month.getMonth() + i, 1)}
              className={i === 0 ? "hidden sm:block" : ""}
              lo={lo}
              hi={hi}
              prev={compare ? prev : null}
              last={last}
              off={(d) => d > last || tooLong(d)}
              onPick={choose}
              onHover={setHover}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
          <button type="button" role="switch" aria-checked={compare} onClick={() => onCompare(!compare)} className="group inline-flex items-center gap-2 rounded-full text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${compare ? "border-accent bg-accent" : "border-line bg-field"}`} aria-hidden>
              <span className={`block size-3.5 rounded-full transition-transform ${compare ? "translate-x-[18px] bg-on-accent" : "translate-x-[2px] bg-fg-2"}`} />
            </span>
            <span className="text-left leading-tight">
              <span className="block font-medium">Comparar com o período anterior</span>
              <span className="block text-[11.5px] text-fg-2 tnum">{fmt(prev)}</span>
            </span>
          </button>
          <span className="flex-1" />
          <span className="text-[12.5px] text-fg-2 tnum">
            {fmt(shown)} · {span(shown)} dias
          </span>
          <button type="button" onClick={onCancel} className="h-8 rounded-full px-3 text-[13px] font-medium text-fg-2 outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
            Cancelar
          </button>
          <button type="button" disabled={!changed} onClick={() => onApply(draft)} className="h-8 rounded-full bg-accent px-4 text-[13px] font-semibold text-on-accent outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40">
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

function Month({ month, lo, hi, prev, last, off, onPick, onHover, className = "" }: { month: Date; lo: Date; hi: Date; prev: Range | null; last: Date; off: (d: Date) => boolean; onPick: (d: Date) => void; onHover: (d: Date) => void; className?: string }) {
  const first = month.getDay();
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: first + count }, (_, i) => (i < first ? null : new Date(month.getFullYear(), month.getMonth(), i - first + 1)));
  return (
    <div className={className}>
      <p className="mb-1 text-center text-[13px] font-semibold">
        {MONTHS[month.getMonth()]} {month.getFullYear()}
      </p>
      <div className="grid grid-cols-7 text-center text-[11px] text-fg-2" aria-hidden>
        {WEEK.map((w, i) => (
          <span key={i} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5" role="grid" aria-label={`${MONTHS[month.getMonth()]} de ${month.getFullYear()}`}>
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const inRange = d >= lo && d <= hi;
          const isLo = same(d, lo);
          const isHi = same(d, hi);
          const inPrev = !!prev && d >= prev.from && d <= prev.to;
          const disabled = off(d);
          return (
            <span key={d.getDate()} className={`relative flex h-8 items-center justify-center ${inRange ? `bg-accent-soft ${isLo ? "rounded-l-full" : ""} ${isHi ? "rounded-r-full" : ""}` : ""}`}>
              <button
                type="button"
                disabled={disabled}
                aria-label={`${d.getDate()} de ${MONTHS[d.getMonth()]}`}
                aria-pressed={isLo || isHi}
                onClick={() => onPick(d)}
                onMouseEnter={() => onHover(d)}
                onFocus={() => onHover(d)}
                className={`relative size-8 rounded-full text-[12.5px] tnum outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-25 ${isLo || isHi ? "bg-accent font-semibold text-on-accent" : inRange ? "text-fg" : "hover:bg-surface-2"} ${same(d, last) && !(isLo || isHi) ? "font-semibold text-accent" : ""}`}
              >
                {d.getDate()}
                {/* o período anterior, quando comparando: um ponto embaixo do dia */}
                {inPrev && !inRange && <span className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-fg-2/60" aria-hidden />}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
