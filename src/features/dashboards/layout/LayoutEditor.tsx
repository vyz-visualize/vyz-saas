"use client";

// "Cards por plataforma" no Adicionar gráfico do Personalizar: cada plataforma com as
// métricas que a API dela entrega, numa lista para somar à grade (+) ou arrastar (Avançado).

import { Check, Plus } from "lucide-react";
import { useState, type DragEvent } from "react";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { delta } from "@/features/metrics/compute";
import {
  formatValue,
  isGood,
  metric as metricDef,
  type MetricId,
  type Profile,
} from "@/features/metrics/definitions";
import type { Dataset } from "@/features/metrics/source";
import { pct } from "@/lib/format";
import { DRAG_MIME } from "./GridCanvas";
import {
  kindOf,
  metricCardId,
  METRIC_CARDS_MAX,
  parseMetricCardId,
  type PageGrid,
} from "./model";
import {
  metricAllowed,
  metricPlatforms,
  PLATFORM_API,
  platformValue,
} from "./platform-metrics";

/** O que a lista precisa da aba aberta. */
export type PanelState = {
  items: PageGrid;
  hide: (id: string) => void;
  add: (id: string) => void;
};

type PanelProps = {
  state: PanelState;
  sources: readonly PlatformId[];
  ds: Dataset;
  profile: Profile;
  hideSpend?: boolean;
  /** Pode arrastar para a grade (Avançado). */
  arrange?: boolean;
};

const dragStart = (id: string) => (e: DragEvent) => {
  e.dataTransfer.setData(DRAG_MIME, id);
  e.dataTransfer.effectAllowed = "copy";
};

/** Quantos cards de plataforma a aba tem (o limite é METRIC_CARDS_MAX). */
export const platformCardCount = (items: PageGrid) => items.filter((i) => kindOf(i.id) === "metric").length;

/**
 * Os cards de cada plataforma: o número de cada métrica nesta conta (ou no exemplo), com
 * + para somar à aba e ✓ para tirar. No Avançado, também dá para arrastar até a grade.
 */
export function PlatformTray({ state, sources, ds, profile, hideSpend, arrange = true }: PanelProps) {
  const platforms = metricPlatforms(sources);
  const [plat, setPlat] = useState<PlatformId | null>(platforms[0] ?? null);
  const onGrid = new Set(state.items.map((i) => i.id));
  const full = platformCardCount(state.items) >= METRIC_CARDS_MAX;
  const api = plat ? PLATFORM_API[plat] : null;
  if (!platforms.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label="Plataformas" className="flex flex-wrap gap-1">
        {platforms.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={p === plat}
            onClick={() => setPlat(p)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent ${p === plat ? "bg-fg text-bg" : "text-fg-2 hover:bg-surface-2 hover:text-fg"}`}
          >
            <span className={`size-1.5 rounded-full ${PLATFORM_API[p].status === "sync" ? "bg-[#3fb27f]" : "bg-[#d9a23b]"}`} aria-hidden />
            {PLATFORMS[p].name}
          </button>
        ))}
      </div>
      {api?.status === "soon" && <p className="text-[11.5px] text-fg-2">Conexão em breve: por enquanto, os números desta plataforma são de exemplo.</p>}
      <ul className="flex flex-col gap-1">
        {plat &&
          api?.metrics.map((pm) => {
            const id = metricCardId(plat, pm.metric);
            const allowed = metricAllowed(sources, plat, pm.metric, hideSpend);
            const added = onGrid.has(id);
            const def = metricDef(pm.metric, profile);
            const v = allowed ? platformValue(ds, plat, pm.metric) : null;
            const addable = allowed && !added && !full;
            const note = added ? "na aba" : !allowed ? "investimento oculto" : full ? "limite atingido" : null;
            return (
              <li
                key={pm.metric}
                draggable={addable && arrange}
                onDragStart={dragStart(id)}
                title={`Campo na API: ${pm.field}`}
                className={`flex h-11 items-center gap-2 rounded-[10px] border border-line/70 bg-bg/60 px-2.5 ${addable ? (arrange ? "md:cursor-grab" : "") : added ? "" : "opacity-55"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] leading-tight font-medium">{def.label}</p>
                  <p className="truncate text-[11px] text-fg-2">
                    <span className="font-semibold text-fg tnum">{v ? formatValue(v.cur, def.format) : "—"}</span>
                    {note && <span> · {note}</span>}
                  </p>
                </div>
                {added ? (
                  <button
                    type="button"
                    aria-label={`Tirar ${def.label} de ${PLATFORMS[plat].name}`}
                    title="Na aba: clique para tirar"
                    onClick={() => state.hide(id)}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-fg outline-none hover:bg-error-soft hover:text-error-fg focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Check size={14} aria-hidden />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!addable}
                    aria-label={`Adicionar ${def.label} de ${PLATFORMS[plat].name}`}
                    onClick={() => state.add(id)}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:bg-line disabled:text-fg-2"
                  >
                    <Plus size={15} aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
      </ul>
    </div>
  );
}

// ---- card de métrica por plataforma ------------------------------------------------------

export function PlatformMetricCard({
  id,
  ds,
  profile,
  compare = true,
}: {
  id: string;
  ds: Dataset;
  profile: Profile;
  compare?: boolean;
}) {
  const parsed = parseMetricCardId(id);
  if (!parsed) return null;
  const platform = parsed.platform as PlatformId;
  const mid = parsed.metric as MetricId;
  const def = metricDef(mid, profile);
  const { cur, prev } = platformValue(ds, platform, mid);
  const d = delta(cur, prev);
  const good = isGood(d, def.better);
  const api = PLATFORM_API[platform];
  return (
    <section className="flex h-full min-w-0 flex-col justify-between rounded-[10px] border border-line bg-card p-3">
      <header className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-semibold tracking-wide text-fg-2 uppercase">
          {def.label}
        </span>
        <span className="flex shrink-0 items-center gap-1 rounded-full border border-line px-1.5 py-0.5 text-[10px] text-fg-2">
          <span
            className={`size-1.5 rounded-full ${api?.status === "sync" ? "bg-[#3fb27f]" : "bg-[#d9a23b]"}`}
          />
          {PLATFORMS[platform]?.short}
        </span>
      </header>
      <p className="mt-1 text-[22px] leading-tight font-bold tracking-tight tnum">
        {formatValue(cur, def.format)}
      </p>
      {compare && Number.isFinite(d) && prev !== 0 && (
        <p className="text-[11px] text-fg-2">
          <span
            className={`font-semibold ${good === null ? "" : good ? "text-accent" : "text-error-fg"}`}
          >
            {d >= 0 ? "▲" : "▼"} {pct(Math.abs(d))}
          </span>{" "}
          vs anterior
        </p>
      )}
    </section>
  );
}
