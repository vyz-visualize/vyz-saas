"use client";

// Peças dos dashboards com dados reais: painel, cartão de KPI, tabela
// ordenável com barras na linha, miniatura gerada, barras de fatia. Mesmos
// tokens do painel (claro/escuro), sem sombra.

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { TrendSpark } from "@/components/charts/TrendSpark";
import { decimal, pct } from "@/lib/format";
import { useColumnVisible, useMetricVisibility, useVisibleColumns } from "@/features/dashboards/metric-prefs-context";
import { deltaText, deltaTone, FORMAT_LABEL, formatValue, HIDDEN, STATUS_LABEL } from "./format";
import { kpiMetric } from "./metrics";
import type { Kpi, LivePlatform, SliceVM } from "./types";

export function Panel({
  title,
  subtitle,
  aside,
  children,
  className = "",
  bodyClassName = "",
}: {
  title: string;
  subtitle?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`min-w-0 rounded-card border border-line bg-card ${className}`} aria-label={title}>
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 pt-3.5 pb-2.5">
        <div className="min-w-0">
          <h3 className="text-[14px] leading-snug font-semibold text-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12px] leading-snug text-fg-2">{subtitle}</p>}
        </div>
        {aside && <div className="shrink-0 text-[12px] text-fg-2">{aside}</div>}
      </header>
      <div className={`px-4 pb-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function DeltaBadge({ delta, better, suffix }: { delta: number | null; better: Kpi["better"]; suffix?: string }) {
  if (delta == null) return <span className="text-[11.5px] text-fg-2">sem comparação</span>;
  const tone = deltaTone(delta, better);
  const cls = tone === "good" ? "bg-accent-soft text-accent dark:text-[#b9c48f]" : tone === "bad" ? "bg-error-soft text-error-fg" : "bg-line/60 text-fg-2";
  const Icon = delta >= 0 ? ArrowUp : ArrowDown;
  const word = tone === "good" ? "melhor" : tone === "bad" ? "pior" : "estável";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-0.5 rounded-chip px-1.5 py-px text-[11.5px] font-semibold tnum ${cls}`}>
        <Icon size={11} aria-hidden strokeWidth={2.5} />
        {deltaText(delta)}
        <span className="sr-only"> ({word})</span>
      </span>
      {suffix && <span className="text-[11px] text-fg-2">{suffix}</span>}
    </span>
  );
}

export function KpiCard({ kpi, currency, maturing, hideSpend, featured = false, metric }: { kpi: Kpi; currency: string; maturing: number; hideSpend?: boolean; featured?: boolean; /** Alvo do "Mostrar no painel" do assistente. */ metric?: string }) {
  const hidden = hideSpend && kpi.spendBased;
  const value = hidden ? HIDDEN : formatValue(kpi.value, kpi.format, currency);
  const tone = deltaTone(kpi.delta, kpi.better);
  return (
    <article
      className={`flex min-w-0 flex-col rounded-card border p-3.5 ${featured ? "border-accent/40 bg-accent-soft/50" : "border-line bg-card"}`}
      aria-label={`${kpi.label}: ${value}`}
      data-vyz-metric={metric}
      title={kpi.help}
    >
      <h3 className="label-caps truncate text-[10.5px] text-fg-2">{kpi.label}</h3>
      <p className={`mt-1.5 leading-none font-bold tracking-[-0.02em] tnum text-fg ${value.length > 11 ? "text-[19px]" : "text-[23px]"}`}>{value}</p>
      <div className="mt-2 flex min-h-[20px] flex-wrap items-center gap-x-2 gap-y-1">
        {!hidden && <DeltaBadge delta={kpi.delta} better={kpi.better} />}
        {kpi.note && <span className="text-[11px] text-fg-2">{kpi.note}</span>}
      </div>
      {!hidden && <TrendSpark values={kpi.spark} maturing={maturing} tone={tone === "bad" ? "bad" : "good"} className="mt-2.5 h-8" />}
    </article>
  );
}

export function KpiGrid({ platform, kpis, extra = [], currency, maturing, hideSpend }: { platform: LivePlatform; kpis: Kpi[]; extra?: Kpi[]; currency: string; maturing: number; hideSpend?: boolean }) {
  const visibility = useMetricVisibility();
  const shown = visibility ? [...kpis, ...extra].filter((k) => visibility.kpis.has(k.id)) : kpis;
  return (
    <div className="grid grid-cols-2 gap-2.5 @[640px]:grid-cols-3 @[1040px]:grid-cols-4 @[1280px]:grid-cols-5">
      {shown.map((k) => (
        <KpiCard key={k.id} kpi={k} currency={currency} maturing={maturing} hideSpend={hideSpend} featured={k.id === "roas"} metric={kpiMetric(platform, k.id)} />
      ))}
    </div>
  );
}

/** Barra fina dentro da célula (participação 0–1). */
export function InlineBar({ share, tone = "accent", label }: { share: number; tone?: "accent" | "muted" | "bad"; label?: string }) {
  const bg = tone === "bad" ? "bg-error" : tone === "muted" ? "bg-muted" : "bg-accent";
  return (
    <span className="flex items-center gap-2">
      <span className="relative h-1.5 min-w-10 flex-1 overflow-hidden rounded-full bg-line/70" aria-hidden>
        <span className={`absolute inset-y-0 left-0 rounded-full ${bg}`} style={{ width: `${Math.max(1.5, Math.min(100, share * 100))}%` }} />
      </span>
      {label && <span className="w-10 text-right text-[11px] text-fg-2 tnum">{label}</span>}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const color = status === "active" ? "bg-accent" : status === "paused" ? "bg-warning" : "bg-muted";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-fg-2">
      <span className={`size-1.5 shrink-0 rounded-full ${color}`} aria-hidden />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" | "bad" | "accent" }) {
  const cls =
    tone === "warn"
      ? "border-warning/50 text-fg"
      : tone === "bad"
        ? "border-transparent bg-error-soft text-error-fg"
        : tone === "accent"
          ? "border-transparent bg-accent-soft text-fg"
          : "border-line text-fg-2";
  return <span className={`inline-flex items-center gap-1 rounded-chip border px-2 py-px text-[11px] leading-snug whitespace-nowrap ${cls}`}>{children}</span>;
}

/** ROAS com a cor do equilíbrio (abaixo = vermelho terroso). */
export function Roas({ value, breakEven }: { value: number | null; breakEven: number | null }) {
  if (value == null) return <span className="text-fg-2">—</span>;
  const bad = value < (breakEven ?? 1);
  return (
    <span className={`font-semibold tnum ${bad ? "text-error-fg" : "text-fg"}`}>
      {decimal(value, 2)}
      {bad && <span className="sr-only"> (abaixo do equilíbrio)</span>}
    </span>
  );
}

// ---- miniatura gerada ------------------------------------------------------------------

const TONES = [
  ["#4B5320", "#8A9A5B"],
  ["#1F2612", "#6E7C3A"],
  ["#6E7C3A", "#D7DCC3"],
  ["#3E6F9E", "#A9C3DB"],
  ["#8C5A2B", "#D9A441"],
  ["#5B4B6B", "#B7A7C8"],
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Miniatura do criativo ou produto: a imagem quando existe; senão uma composição geométrica estável pelo id. */
export function Thumb({ seed, url, label, badge, className = "" }: { seed: string; url?: string | null; label: string; badge?: string; className?: string }) {
  const h = hash(seed);
  const [a, b] = TONES[h % TONES.length];
  const variant = (h >> 4) % 3;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem da plataforma (domínio variável)
        <img src={url} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
      ) : (
        <svg viewBox="0 0 100 75" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
          {variant === 0 && <circle cx={30 + (h % 40)} cy="34" r="22" fill="#fff" opacity="0.16" />}
          {variant === 1 && <polygon points="10,75 50,12 90,75" fill="#fff" opacity="0.14" />}
          {variant === 2 && <rect x="18" y="14" width="44" height="44" rx="6" fill="#fff" opacity="0.14" transform={`rotate(${h % 30} 40 36)`} />}
          <rect x="12" y="52" width="46" height="6" rx="3" fill="#fff" opacity="0.5" />
          <rect x="12" y="62" width="28" height="5" rx="2.5" fill="#fff" opacity="0.3" />
        </svg>
      )}
      {!url && (
        <span className="absolute top-2 left-2.5 max-w-[80%] truncate text-[10px] font-semibold tracking-wide text-white/85 uppercase" aria-hidden>
          {label}
        </span>
      )}
      {badge && <span className="absolute right-2 bottom-2 rounded-chip bg-black/45 px-1.5 py-px text-[10px] font-medium text-white backdrop-blur-sm">{FORMAT_LABEL[badge] ?? badge}</span>}
    </div>
  );
}

// ---- barras de fatias (dispositivo, posicionamento, região) -----------------------------------

export function SliceBars({
  items,
  breakEven,
  limit,
  basis = "value",
  label,
}: {
  items: SliceVM[];
  breakEven: number | null;
  limit?: number;
  /** Tamanho da barra: participação na receita ou no investimento. */
  basis?: "value" | "spend";
  label: string;
}) {
  const roasOn = useColumnVisible("roas");
  const list = limit ? items.slice(0, limit) : items;
  if (!list.length) return <NoData />;
  const showRoas = roasOn && list.some((i) => i.roas != null);
  const max = Math.max(...list.map((i) => (basis === "value" ? i.valueShare : i.spendShare))) || 1;
  return (
    <table className="w-full text-[12.5px] tnum">
      <caption className="sr-only">{label}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Item</th>
          <th scope="col">{basis === "value" ? "Participação na receita" : "Participação no investimento"}</th>
          {showRoas && <th scope="col">ROAS</th>}
        </tr>
      </thead>
      <tbody>
        {list.map((s) => {
          const share = basis === "value" ? s.valueShare : s.spendShare;
          return (
            <tr key={s.key}>
              <th scope="row" className="w-[38%] max-w-0 truncate py-1 pr-2 text-left font-normal text-fg">
                {s.label}
              </th>
              <td className="py-1">
                <span className="flex items-center gap-2">
                  <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-line/60" aria-hidden>
                    <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${Math.max(2, (share / max) * 100)}%` }} />
                  </span>
                  <span className="w-11 text-right text-fg-2">{pct(share, 0)}</span>
                </span>
              </td>
              {showRoas && (
                <td className="w-14 py-1 text-right">
                  <Roas value={s.roas} breakEven={breakEven} />
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function NoData({ text = "Sem dados no período." }: { text?: string }) {
  return <p className="rounded-control border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-fg-2">{text}</p>;
}

// ---- tabela ordenável -------------------------------------------------------------------------

export type Column<T> = {
  key: string;
  label: string;
  /** Valor para ordenar (sem ele, a coluna não ordena). */
  sort?: (row: T) => number | string | null;
  render: (row: T) => ReactNode;
  align?: "left" | "right";
  className?: string;
  /** Coluna fixa à esquerda no celular (a primeira, com o nome). */
  sticky?: boolean;
  /** Métrica do catálogo (metric-prefs): dá para ocultar em "Personalizar". */
  metric?: string;
};

export function DataTable<T>({
  rows,
  columns: allColumns,
  rowKey,
  caption,
  initialSort,
  limit,
  minWidth = 720,
  rowClassName,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  caption: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  /** Mostra só as primeiras N linhas, com "Ver todas". */
  limit?: number;
  minWidth?: number;
  rowClassName?: (row: T) => string;
}) {
  const columns = useVisibleColumns(allColumns);
  const [sort, setSort] = useState(initialSort);
  const [all, setAll] = useState(false);
  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort || !sort) return rows;
    const get = col.sort;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x == null) return 1;
      if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [rows, columns, sort]);
  const shown = limit && !all ? sorted.slice(0, limit) : sorted;
  if (!rows.length) return <NoData />;

  return (
    <div>
      {/* contain-paint: a tabela larga (e a coluna fixa) rola só aqui dentro; sem ela o
          navegador do celular alarga a página inteira para caber a tabela. */}
      <div className="-mx-4 overflow-x-auto px-4 contain-paint">
        <table className="w-full border-separate border-spacing-0 text-[12.5px] tnum" style={{ minWidth }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const ariaSort = active ? (sort!.dir === "asc" ? "ascending" : "descending") : c.sort ? "none" : undefined;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={`border-b border-line bg-card py-2 text-[11px] font-medium whitespace-nowrap text-fg-2 ${c.align === "right" ? "text-right" : "text-left"} ${c.sticky ? "sticky left-0 z-[1] pr-3" : "px-2"} ${c.className ?? ""}`}
                  >
                    {c.sort ? (
                      <button
                        type="button"
                        onClick={() => setSort({ key: c.key, dir: active && sort!.dir === "desc" ? "asc" : "desc" })}
                        className={`inline-flex items-center gap-0.5 rounded-[4px] hover:text-fg ${active ? "text-fg" : ""}`}
                      >
                        {c.label}
                        {active ? sort!.dir === "desc" ? <ArrowDown size={11} aria-hidden /> : <ArrowUp size={11} aria-hidden /> : <ChevronsUpDown size={11} aria-hidden className="opacity-50" />}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={rowKey(r)} className={`group ${rowClassName?.(r) ?? ""}`}>
                {columns.map((c) =>
                  c.sticky ? (
                    <th
                      key={c.key}
                      scope="row"
                      className={`sticky left-0 z-[1] border-b border-line/60 bg-card py-2 pr-3 text-left font-normal group-hover:bg-bg group-last:border-0 ${c.className ?? ""}`}
                    >
                      {c.render(r)}
                    </th>
                  ) : (
                    <td key={c.key} className={`border-b border-line/60 px-2 py-2 group-hover:bg-bg group-last:border-0 ${c.align === "right" ? "text-right" : ""} ${c.className ?? ""}`}>
                      {c.render(r)}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {limit && rows.length > limit && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-[12.5px] font-semibold text-accent hover:underline">
          {all ? "Mostrar menos" : `Ver todas (${rows.length})`}
        </button>
      )}
    </div>
  );
}

// ---- carregando -------------------------------------------------------------------------------

/** Esqueleto do dashboard (fallback do Suspense). */
export function LiveDashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Carregando o dashboard">
      <div className="h-8 w-64 rounded-control bg-line/60" />
      <div className="h-10 w-full max-w-md rounded-control bg-line/40" />
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-[124px] rounded-card bg-card" />
        ))}
      </div>
      <div className="h-[320px] rounded-card bg-card" />
    </div>
  );
}
