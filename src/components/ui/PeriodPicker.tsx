"use client";

// Período do dashboard: popover com atalhos (7 dias, 30 dias, este mês) e um
// calendário simples de intervalo. Datas futuras ficam desligadas. A data de
// hoje só é lida no cliente, ao abrir.

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { usePortalContainer } from "./portal";

export type Period = "7d" | "30d" | "mes" | "custom";
export type Range = { from: Date; to: Date };

const SHORTCUTS: { value: Exclude<Period, "custom">; label: string }[] = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "mes", label: "Este mês" },
];
const WEEK = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const same = (a: Date, b: Date) => a.getTime() === b.getTime();
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
export const rangeDays = (r: Range) => Math.round((day0(r.to).getTime() - day0(r.from).getTime()) / 86_400_000) + 1;

type Props = {
  period: Period;
  range: Range | null;
  /** Dias do personalizado quando não há intervalo guardado. */
  customDays: number;
  onChange: (p: Period, range?: Range) => void;
  maxDays?: number;
  label?: string;
  /** Sem o rótulo em cima (o botão continua dizendo o que é para leitor de tela): ganha altura onde ela é curta. */
  labelHidden?: boolean;
};

export function PeriodPicker({ period, range, customDays, onChange, maxDays = 90, label = "Período", labelHidden = false }: Props) {
  const container = usePortalContainer();
  const [open, setOpen] = useState(false);
  const text =
    period === "custom" ? (range ? `${ddmm(range.from)} – ${ddmm(range.to)} · ${rangeDays(range)} dias` : `Últimos ${customDays} dias`) : SHORTCUTS.find((s) => s.value === period)?.label;
  return (
    <div className="space-y-1">
      {!labelHidden && <p className="text-[13px] font-medium text-fg">{label}</p>}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger
          aria-label={`${label}: ${text}`}
          className="group inline-flex h-10 w-full min-w-[13rem] items-center gap-2 rounded-control border border-line bg-field px-3 text-left text-[14px] text-fg outline-none hover:border-fg-2/60 focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent data-[state=open]:border-accent data-[state=open]:ring-1 data-[state=open]:ring-accent"
        >
          <CalendarDays size={15} aria-hidden className="shrink-0 text-fg-2" />
          <span className="min-w-0 flex-1 truncate tnum">{text}</span>
          <ChevronDown size={16} aria-hidden className="shrink-0 text-fg-2 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Content sideOffset={4} collisionPadding={8} align="end" className="pop z-[90] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto rounded-card border border-line bg-card text-fg outline-none">
            {open && (
              <Body
                period={period}
                range={range}
                maxDays={maxDays}
                onPick={(p, r) => {
                  onChange(p, r);
                  setOpen(false);
                }}
              />
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function Body({ period, range, maxDays, onPick }: { period: Period; range: Range | null; maxDays: number; onPick: (p: Period, r?: Range) => void }) {
  const [today] = useState(() => day0(new Date()));
  const [month, setMonth] = useState(() => new Date((range?.to ?? today).getFullYear(), (range?.to ?? today).getMonth(), 1));
  const [start, setStart] = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);

  const first = month.getDay();
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: first + count }, (_, i) => (i < first ? null : new Date(month.getFullYear(), month.getMonth(), i - first + 1)));
  const canNext = new Date(month.getFullYear(), month.getMonth() + 1, 1) <= today;

  // intervalo em destaque: o que está sendo escolhido, ou o salvo
  const a = start ?? range?.from ?? null;
  const b = start ? (hover ?? start) : (range?.to ?? null);
  const lo = a && b ? (a < b ? a : b) : null;
  const hi = a && b ? (a < b ? b : a) : null;
  const tooLong = (d: Date) => !!start && Math.abs(rangeDays({ from: start, to: d })) > maxDays;

  const choose = (d: Date) => {
    if (!start) return setStart(d);
    const r = d < start ? { from: d, to: start } : { from: start, to: d };
    onPick("custom", r);
  };

  return (
    <div className="flex flex-col sm:flex-row">
      <ul className="flex gap-1 border-b border-line p-2 sm:w-40 sm:flex-col sm:border-r sm:border-b-0" aria-label="Atalhos">
        {SHORTCUTS.map((s) => (
          <li key={s.value} className="flex-1 sm:flex-none">
            <button
              type="button"
              onClick={() => onPick(s.value)}
              className={`h-9 w-full rounded-control px-2.5 text-left text-[13.5px] whitespace-nowrap outline-none hover:bg-accent-soft focus-visible:bg-accent-soft ${period === s.value ? "font-semibold text-accent" : ""}`}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="inline-flex size-8 items-center justify-center rounded-control text-fg-2 outline-none hover:bg-accent-soft hover:text-fg focus-visible:bg-accent-soft">
            <ChevronLeft size={16} aria-hidden />
          </button>
          <p className="text-[13.5px] font-semibold" aria-live="polite">
            {MONTHS[month.getMonth()]} de {month.getFullYear()}
          </p>
          <button type="button" aria-label="Próximo mês" disabled={!canNext} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="inline-flex size-8 items-center justify-center rounded-control text-fg-2 outline-none hover:bg-accent-soft hover:text-fg focus-visible:bg-accent-soft disabled:opacity-30">
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11.5px] text-fg-2" aria-hidden>
          {WEEK.map((w, i) => (
            <span key={i} className="py-1">
              {w}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7" role="grid" aria-label="Calendário" onMouseLeave={() => setHover(null)}>
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const future = d > today;
            const off = future || tooLong(d);
            const inRange = lo && hi && d >= lo && d <= hi;
            const edge = (lo && same(d, lo)) || (hi && same(d, hi));
            return (
              <button
                key={d.getDate()}
                type="button"
                disabled={off}
                aria-label={`${d.getDate()} de ${MONTHS[d.getMonth()]}`}
                aria-pressed={!!edge}
                onClick={() => choose(d)}
                onMouseEnter={() => setHover(d)}
                onFocus={() => setHover(d)}
                className={`h-9 w-9 text-[13px] tnum outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-25 ${edge ? "rounded-control bg-accent font-semibold text-on-accent" : inRange ? "bg-accent-soft" : "rounded-control hover:bg-accent-soft"} ${same(d, today) && !edge ? "font-semibold text-accent" : ""}`}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] text-fg-2">{start ? "Agora escolha o último dia." : `Escolha o primeiro dia (até ${maxDays} dias).`}</p>
      </div>
    </div>
  );
}
