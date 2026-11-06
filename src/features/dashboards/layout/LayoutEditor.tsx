"use client";

// Aba "Por plataforma" da bandeja do Personalizar com os blocos do modelo, as métricas de cada plataforma (com o
// campo da API e se a VYZ já sincroniza) e a disposição em forma de dados.

import { Check, EyeOff, Plus } from "lucide-react";
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
  API_STATUS_LABEL,
  metricAllowed,
  metricPlatforms,
  PLATFORM_API,
  platformValue,
} from "./platform-metrics";

/** O que o painel precisa da aba aberta. */
export type PanelState = {
  items: PageGrid;
  hide: (id: string) => void;
  add: (id: string) => void;
  dirty: boolean;
};

// ---- painel lateral ---------------------------------------------------------------------

type PanelProps = {
  state: PanelState;
  blocks: { id: string; label: string }[];
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

/**
 * Aba "Por plataforma" da bandeja do Personalizar: cada plataforma com o que a API
 * dela entrega (campo e estado da conexão), em cards para arrastar até a grade, e
 * os blocos do modelo que estão escondidos, para trazer de volta.
 */
export function PlatformTray({
  state,
  blocks,
  sources,
  ds,
  profile,
  hideSpend,
  arrange = true,
}: PanelProps) {
  const platforms = metricPlatforms(sources);
  const [plat, setPlat] = useState<PlatformId | null>(platforms[0] ?? null);
  const onGrid = new Set(state.items.map((i) => i.id));
  const metricCount = state.items.filter(
    (i) => kindOf(i.id) === "metric",
  ).length;
  const full = metricCount >= METRIC_CARDS_MAX;
  const api = plat ? PLATFORM_API[plat] : null;
  const hidden = blocks.filter((b) => !onGrid.has(b.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Plataformas"
          className="flex flex-wrap gap-1"
        >
          {platforms.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === plat}
              onClick={() => setPlat(p)}
              className={`flex items-center gap-1.5 rounded-chip px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent ${p === plat ? "bg-accent-soft text-fg" : "text-fg-2 hover:text-fg"}`}
            >
              <span
                className={`size-1.5 rounded-full ${PLATFORM_API[p].status === "sync" ? "bg-[#3fb27f]" : "bg-[#d9a23b]"}`}
                aria-hidden
              />
              {PLATFORMS[p].name}
            </button>
          ))}
        </div>
        {api && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${api.status === "sync" ? "bg-[#3fb27f]/15 text-[#2f9a6a]" : "bg-[#d9a23b]/15 text-[#b07f1c]"}`}
          >
            {api.api} · {API_STATUS_LABEL[api.status]}
          </span>
        )}
        <span className="ml-auto text-[12px] text-fg-2 tnum">
          {metricCount}/{METRIC_CARDS_MAX} cards de plataforma
        </span>
      </div>
      <p className="truncate text-[12px] text-fg-2">
        {api?.status === "sync"
          ? `${arrange ? "Arraste para qualquer lugar da grade." : "Toque em + e o card entra no próximo espaço livre."} Com a conta conectada, o número vem das suas campanhas; no modelo, é a parte desta plataforma nos dados de exemplo.`
          : "A API desta plataforma entrega estes campos. No modelo, já aparecem com dados de exemplo; com a conexão, passam a vir da sua conta."}
      </p>
      <ul className="flex min-h-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {hidden.map((b) => (
          <li
            key={b.id}
            draggable={arrange}
            onDragStart={dragStart(b.id)}
            className="flex w-44 shrink-0 cursor-grab flex-col rounded-[10px] border border-dashed border-accent/60 bg-accent-soft/25 p-2.5 active:cursor-grabbing"
          >
            <p className="flex items-center gap-1 text-[10.5px] font-semibold tracking-wide text-fg-2 uppercase">
              <EyeOff size={11} aria-hidden /> Bloco escondido
            </p>
            <p className="mt-1 line-clamp-2 text-[12.5px] leading-tight font-medium">
              {b.label}
            </p>
            <div className="mt-auto flex items-center justify-between pt-1">
              <span className="text-[10.5px] text-fg-2">do modelo</span>
              <button
                type="button"
                aria-label={`Trazer ${b.label} de volta`}
                onClick={() => state.add(b.id)}
                className="inline-flex size-6 items-center justify-center rounded-full bg-accent text-on-accent"
              >
                <Plus size={14} aria-hidden />
              </button>
            </div>
          </li>
        ))}
        {plat &&
          api?.metrics.map((pm) => {
            const id = metricCardId(plat, pm.metric);
            const allowed = metricAllowed(sources, plat, pm.metric, hideSpend);
            const added = onGrid.has(id);
            const def = metricDef(pm.metric, profile);
            const v = allowed ? platformValue(ds, plat, pm.metric) : null;
            const addable = allowed && !added && !full;
            return (
              <li
                key={pm.metric}
                draggable={addable && arrange}
                onDragStart={dragStart(id)}
                className={`flex w-44 shrink-0 flex-col rounded-[10px] border border-line bg-bg p-2.5 ${addable ? "cursor-grab active:cursor-grabbing" : "opacity-55"}`}
              >
                <p className="line-clamp-2 text-[11.5px] leading-tight font-medium">
                  {def.label}
                </p>
                <p className="mt-1 truncate text-[15px] leading-none font-bold tnum">
                  {v ? formatValue(v.cur, def.format) : "—"}
                </p>
                <code
                  className="mt-1.5 truncate rounded-[4px] bg-card px-1.5 py-0.5 font-mono text-[10px] text-fg-2"
                  title={`Campo na API: ${pm.field}`}
                >
                  {pm.field}
                </code>
                <div className="mt-auto flex items-center justify-between gap-1 pt-1">
                  <span className="text-[10.5px] text-fg-2">
                    {added
                      ? "na grade"
                      : !allowed
                        ? "investimento oculto"
                        : full
                          ? "limite atingido"
                          : PLATFORMS[plat].short}
                  </span>
                  {added ? (
                    <button
                      type="button"
                      aria-label={`Tirar ${def.label}`}
                      onClick={() => state.hide(id)}
                      className="inline-flex size-6 items-center justify-center rounded-full bg-accent-soft text-fg hover:bg-error-soft hover:text-error-fg"
                    >
                      <Check size={13} aria-hidden />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!addable}
                      aria-label={`Adicionar ${def.label} de ${PLATFORMS[plat].name}`}
                      onClick={() => state.add(id)}
                      className="inline-flex size-6 items-center justify-center rounded-full bg-accent text-on-accent disabled:bg-line disabled:text-fg-2"
                    >
                      <Plus size={14} aria-hidden />
                    </button>
                  )}
                </div>
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
