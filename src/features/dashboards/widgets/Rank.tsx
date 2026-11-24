"use client";

// Ranking de qualquer coisa por uma métrica (bloco "rank", pedido no editor): a posição, o
// nome, a plataforma (ou o formato, a campanha do termo), o valor com uma barra curta e, nas
// métricas que somam, a parte de cada um no total. ROAS e custo ganham cor contra a
// referência do dashboard (equilíbrio e alvo). Campanhas filtram o dashboard ao clicar.

import { PLATFORMS } from "@/features/accounts/platforms";
import { filterAria, filterTone, useDashFilters } from "@/features/analytics/filter-context";
import { defaultDir, formatRank, needsMargin, RANK_NOUN, rankMetric, rankRows } from "@/features/metrics/rank";
import { breakEvenOf, hasGoal } from "@/features/metrics/targets";
import type { WidgetSpec } from "@/features/templates/types";
import { decimal, pct } from "@/lib/format";
import { Empty } from "./Detail";
import { platformColor, type WidgetContext } from "./Widgets";

/** Métricas que somam: dá para mostrar a parte de cada um. */
const ADDITIVE = new Set(["revenue", "sold", "spend", "conversions", "clicks", "impressions"]);

export function RankWidget({ ctx, spec }: { ctx: WidgetContext; spec: Extract<WidgetSpec, { type: "rank" }> }) {
  const { ds, profile } = ctx;
  const filters = useDashFilters();
  const def = rankMetric(spec.metric, profile);
  const dir = spec.dir ?? defaultDir(spec.metric, profile);
  const rows = rankRows(ds, spec.entity, spec.metric, { dir, platform: spec.platform, profile });
  const noun = RANK_NOUN[spec.entity];

  if (needsMargin(spec.metric, ds)) return <Empty>O lucro usa a margem do dashboard. Defina a margem em Nome, contas e metas.</Empty>;
  if (rows === null) return <Empty>{spec.entity === "terms" ? "Sem termos de pesquisa no período: a importação do Google Ads ainda não traz os termos." : "Sem dados desta quebra no período: a plataforma não informou."}</Empty>;
  if (!rows.length)
    return <Empty>{spec.entity === "products" ? "Os produtos aparecem quando a loja estiver ligada ao dashboard." : `Nenhum ${noun.one} com ${def.label.toLowerCase()} no período.`}</Empty>;

  // referência: equilíbrio do ROAS, alvo do custo por resultado
  const ref = spec.metric === "roas" ? breakEvenOf(ds) : spec.metric === "cpa" && hasGoal(ds) ? ds.goal : null;
  const good = (v: number) => (ref == null ? null : spec.metric === "roas" ? v >= ref : v <= ref);
  const max = Math.max(...rows.map((r) => Math.abs(r.value))) || 1;
  const total = ADDITIVE.has(spec.metric) ? rows.reduce((a, r) => a + r.value, 0) : 0;
  const clickable = spec.entity === "campaigns" && !!filters?.interactive;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-line pb-1.5 text-[10.5px] font-medium tracking-[0.04em] text-fg-2 uppercase">
        <span>{noun.many}</span>
        <span className="text-right">{def.label}</span>
      </div>
      <ol className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
        {rows.map((r, i) => {
          const tone = spec.entity === "campaigns" ? filterTone(filters, "campaigns", r.key) : null;
          const ok = good(r.value);
          const share = total > 0 ? r.value / total : null;
          const inner = (
            <>
              <span className="text-[11px] font-semibold text-fg-2 tnum">{i + 1}</span>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-medium text-fg" title={r.label}>
                  {r.label}
                </span>
                {(r.platform || r.sub) && (
                  <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10.5px] text-fg-2">
                    {r.platform && <span className="size-1.5 shrink-0 rounded-full" style={{ background: platformColor(r.platform) }} aria-hidden />}
                    <span className="truncate">{r.sub ?? PLATFORMS[r.platform!]?.name ?? r.platform}</span>
                  </span>
                )}
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="flex items-baseline gap-1.5">
                  {share != null && <span className="text-[10.5px] text-fg-2 tnum">{pct(share, share < 0.1 ? 1 : 0)}</span>}
                  <span className={`text-[12.5px] font-semibold tnum ${ok === null ? "text-fg" : ok ? "text-accent" : "text-error-fg"}`}>{formatRank(r.value, spec.metric, profile)}</span>
                </span>
                <span className="relative h-1 w-16 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_9%,transparent)]" aria-hidden>
                  <span className={`absolute inset-y-0 left-0 rounded-full ${ok === false ? "bg-error-fg" : "bg-accent"}`} style={{ width: `${Math.max(3, (Math.abs(r.value) / max) * 100)}%` }} />
                </span>
              </span>
            </>
          );
          const row = "grid w-full grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-[8px] px-1 py-2 text-left";
          return (
            <li key={r.key} className={`border-b border-line/50 last:border-0 ${tone === "dimmed" ? "opacity-45" : ""}`}>
              {clickable ? (
                <button
                  type="button"
                  data-filter-item={r.key}
                  aria-pressed={tone === "selected"}
                  aria-label={filterAria("campaigns", r.label)}
                  onClick={(e) => filters?.toggle("campaigns", r.key, r.label, e)}
                  className={`${row} cursor-pointer outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent ${tone === "selected" ? "bg-accent-soft/70" : ""}`}
                >
                  {inner}
                </button>
              ) : (
                <div className={row}>{inner}</div>
              )}
            </li>
          );
        })}
      </ol>
      {ref != null && <p className="mt-1.5 text-[10.5px] text-fg-2">{spec.metric === "roas" ? `Verde: acima do equilíbrio (${decimal(ref)}).` : `Verde: dentro do alvo (${formatRank(ref, "cpa", profile)}).`}</p>}
    </div>
  );
}
