"use client";

// Ranking de campanhas numa tabela enxuta: a campanha, a plataforma dela e a métrica que
// decide (ROAS nas vendas, custo por resultado no resto), com uma barra curta ao lado do
// número e a cor dizendo se passa da referência (equilíbrio do ROAS ou alvo do custo).
// Clicar numa campanha filtra o dashboard, como na tabela de campanhas.

import { PLATFORMS } from "@/features/accounts/platforms";
import { filterAria, filterTone, useDashFilters } from "@/features/analytics/filter-context";
import { metric } from "@/features/metrics/definitions";
import { breakEvenOf, hasGoal } from "@/features/metrics/targets";
import { brl, decimal } from "@/lib/format";
import { platformColor, type WidgetContext } from "./Widgets";

export function RankingWidget({ ctx, by }: { ctx: WidgetContext; by: "roas" | "cpa" }) {
  const { ds, profile } = ctx;
  const filters = useDashFilters();
  const roas = by === "roas";
  const ref = roas ? breakEvenOf(ds) : hasGoal(ds) ? ds.goal : null;
  const rows = ds.campaigns
    .map((c) => ({ c, v: roas ? (c.spend ? c.revenue / c.spend : 0) : c.conversions ? c.spend / c.conversions : Infinity }))
    .sort((a, b) => (roas ? b.v - a.v : a.v - b.v));
  const finite = rows.map((r) => r.v).filter(Number.isFinite);
  const max = Math.max(...finite, ref ?? 0) || 1;
  const label = roas ? "ROAS" : metric("cpa", profile).label;
  const fmt = (v: number) => (!Number.isFinite(v) ? "—" : roas ? decimal(v) : brl(v, { decimals: v < 100 }));
  const good = (v: number) => (ref == null ? null : roas ? v >= ref : v <= ref);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-line pb-1.5 text-[10.5px] font-medium tracking-[0.04em] text-fg-2 uppercase">
        <span>Campanha</span>
        <span className="text-right">{label}</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
        {rows.map(({ c, v }, i) => {
          const tone = filterTone(filters, "campaigns", c.id);
          const ok = good(v);
          return (
            <li key={c.id} className={`border-b border-line/50 last:border-0 ${tone === "dimmed" ? "opacity-45" : ""}`}>
              <button
                type="button"
                disabled={!filters?.interactive}
                data-filter-item={c.id}
                aria-pressed={tone === "selected"}
                aria-label={filterAria("campaigns", c.name)}
                onClick={(e) => filters?.toggle("campaigns", c.id, c.name, e)}
                className={`grid w-full grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-[8px] px-1 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent enabled:cursor-pointer enabled:hover:bg-surface-2 ${tone === "selected" ? "bg-accent-soft/70" : ""}`}
              >
                <span className="text-[11px] font-semibold text-fg-2 tnum">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium text-fg">{c.name}</span>
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] text-fg-2">
                    <span className="size-1.5 rounded-full" style={{ background: platformColor(c.platform) }} aria-hidden />
                    {PLATFORMS[c.platform]?.name ?? c.platform}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className={`text-[12.5px] font-semibold tnum ${ok === null ? "text-fg" : ok ? "text-accent" : "text-error-fg"}`}>{fmt(v)}</span>
                  <span className="relative h-1 w-14 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_9%,transparent)]" aria-hidden>
                    <span className={`absolute inset-y-0 left-0 rounded-full ${ok === false ? "bg-error-fg" : "bg-accent"}`} style={{ width: `${Number.isFinite(v) ? Math.min(100, (v / max) * 100) : 100}%` }} />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {ref != null && (
        <p className="mt-1.5 text-[10.5px] text-fg-2">
          {roas ? `Verde: acima do equilíbrio (${decimal(ref)}).` : `Verde: dentro do alvo (${brl(ref, { decimals: false })}).`}
        </p>
      )}
    </div>
  );
}
