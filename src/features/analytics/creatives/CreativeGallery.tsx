"use client";

// Galeria de criativos (Padrão em diante): preview, ordenar por e alerta de
// fadiga. No Avançado, cada card ganha "Comparar".

import { Check, GitCompareArrows } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { TrendSpark } from "@/components/charts/TrendSpark";
import { Segmented } from "@/components/ui/Segmented";
import { btn } from "@/components/ui/styles";
import { decimal, int, pct } from "@/lib/format";
import { filterAria, filterTone, useDashFilters } from "../filter-context";
import { hasFilters } from "../filters";
import { formatValue, money, moneyCompact } from "../format";
import type { CreativeVM, CreativesData } from "../types";
import { Chip, NoData, Roas, Thumb } from "../ui";
import { MAX_COMPARE, MIN_COMPARE } from "./limits";
import { RETENTION_HELP } from "./metrics";
import { resultTitle } from "./objectives";

type CreativeSort = "spend" | "roas" | "ctr";

type Props = {
  data: Pick<CreativesData, "gallery" | "hideSpend" | "currency" | "breakEvenRoas">;
  /** Link para o comparativo com os escolhidos. Sem isso, a galeria não oferece "Comparar". */
  compareHref?: (ads: readonly string[]) => string;
};

export function CreativeGallery({ data, compareHref }: Props) {
  const { gallery, hideSpend } = data;
  const dashFilters = useDashFilters();
  const filtered = !!dashFilters && hasFilters(dashFilters.filters);
  const [chosenSort, setSort] = useState<CreativeSort>(hideSpend ? "ctr" : "spend");
  // sem receita em nenhuma campanha, não há ROAS para ordenar
  const anyRevenue = gallery.some((c) => c.hasRevenue);
  const sort: CreativeSort = chosenSort === "roas" && !anyRevenue ? "spend" : chosenSort;
  const [picked, setPicked] = useState<string[]>([]);
  const list = useMemo(() => {
    const key = (c: CreativeVM) => (sort === "roas" ? (c.roas ?? -1) : sort === "ctr" ? (c.linkCtr ?? -1) : (c.spend ?? 0));
    return [...gallery].sort((a, b) => key(b) - key(a));
  }, [gallery, sort]);
  const tired = gallery.filter((c) => c.fatigue);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX_COMPARE ? [...p, id] : p));
  if (!gallery.length) return <NoData text={filtered ? "Nenhum anúncio com esses filtros." : "Nenhum anúncio veiculou no período."} />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-fg-2">
          {gallery.length} anúncios com entrega no período
          {tired.length > 0 && (
            <>
              {" · "}
              <span className="font-semibold text-error-fg">
                {tired.length === 1 ? "1 mostra" : `${tired.length} mostram`} sinal de cansaço
              </span>
            </>
          )}
        </p>
        <Segmented
          label="Ordenar criativos"
          size="sm"
          value={sort}
          onChange={setSort}
          options={[...(hideSpend ? [] : [{ value: "spend" as const, label: "Investimento" }, ...(anyRevenue ? [{ value: "roas" as const, label: "ROAS" }] : [])]), { value: "ctr", label: "CTR" }]}
        />
      </div>
      <ul className="grid grid-cols-1 gap-3 @[560px]:grid-cols-2 @[900px]:grid-cols-3 @[1240px]:grid-cols-4">
        {list.map((c) => (
          <li key={c.id}>
            <CreativeCard c={c} data={data} compare={compareHref ? { on: picked.includes(c.id), full: picked.length >= MAX_COMPARE, toggle: () => toggle(c.id) } : undefined} />
          </li>
        ))}
      </ul>
      {compareHref && picked.length >= MIN_COMPARE && (
        <div className="sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-card border border-line bg-card px-3 py-2 md:bottom-4 print:hidden">
          <p className="min-w-0 truncate text-[13px] text-fg-2 tnum">{picked.length} anúncios marcados</p>
          <Link href={compareHref(picked)} className={`${btn.small} shrink-0 whitespace-nowrap`}>
            Comparar selecionados
          </Link>
        </div>
      )}
    </div>
  );
}

function CreativeCard({ c, data, compare }: { c: CreativeVM; data: Props["data"]; compare?: { on: boolean; full: boolean; toggle: () => void } }) {
  const { currency, hideSpend, breakEvenRoas } = data;
  const filters = useDashFilters();
  const clickable = !!filters?.interactive;
  const tone = filterTone(filters, "ads", c.id);
  return (
    <article
      data-filter-tone={tone ?? undefined}
      onClick={
        clickable
          ? (e) => {
              if ((e.target as Element).closest("a, button")) return;
              filters.toggle("ads", c.id, c.name, e);
            }
          : undefined
      }
      className={`flex h-full flex-col overflow-hidden rounded-card border bg-card ${clickable ? "cursor-pointer" : ""} ${tone === "selected" ? "border-accent ring-2 ring-accent" : c.fatigue ? "border-error/40" : "border-line"} ${tone === "dimmed" ? "opacity-45" : ""}`}
      aria-label={c.name}
    >
      <Thumb seed={c.id} url={c.thumbnailUrl} label={c.headline ?? c.name} badge={c.format} className="aspect-[16/10]" />
      <div className="flex flex-1 flex-col p-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="line-clamp-2 text-[13px] leading-snug font-semibold text-fg" title={c.name}>
            {clickable ? (
              <button type="button" data-filter-item={c.id} aria-pressed={tone === "selected"} aria-label={filterAria("ads", c.name)} onClick={(e) => filters.toggle("ads", c.id, c.name, e)} className="cursor-pointer rounded-[4px] text-left outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {c.name}
              </button>
            ) : (
              c.name
            )}
          </h4>
          {c.status !== "active" && <Chip>{c.status === "paused" ? "Pausado" : c.status}</Chip>}
        </div>
        <p className="mt-0.5 truncate text-[11.5px] text-fg-2">{c.campaignName}</p>
        <dl className="mt-3 grid grid-cols-3 gap-x-2 gap-y-2 text-[11px] tnum">
          {!hideSpend && <Metric label="Investimento" value={moneyCompact(c.spend, currency)} />}
          {!hideSpend && (c.hasRevenue ? <Metric label="ROAS" value={<Roas value={c.roas} breakEven={breakEvenRoas} />} /> : <Metric label="Custo por resultado" value={money(c.costPerResult, currency)} />)}
          <Metric label={resultTitle(c.result.label)} value={int(c.result.value)} />
          <Metric label="CTR do link" value={formatValue(c.linkCtr, "pct")} />
          <Metric label="Freq. média" value={c.frequency == null ? "—" : decimal(c.frequency, 2)} />
          <Metric label="Retenção 3 s" help={RETENTION_HELP} value={c.hookRate == null ? "—" : pct(c.hookRate, 0)} />
        </dl>
        <div className="mt-auto pt-3">
          <p className="mb-1 text-[10.5px] text-fg-2">CTR do link por dia</p>
          <TrendSpark values={c.ctrSpark} maturing={0} tone={c.fatigue ? "bad" : "good"} className="h-7" />
          {c.fatigue && (
            <p className="mt-2 rounded-control bg-error-soft px-2 py-1.5 text-[11.5px] leading-snug text-error-fg">
              Cansando: frequência {pct(c.fatigue.frequencyChange, 0)} maior e CTR {pct(Math.abs(c.fatigue.ctrChange), 0)} menor na 2ª metade do período. Renove o criativo.
            </p>
          )}
          {compare && (
            <button
              type="button"
              aria-pressed={compare.on}
              disabled={!compare.on && compare.full}
              onClick={compare.toggle}
              className={`mt-2.5 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-control border text-[12.5px] font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 ${compare.on ? "border-accent bg-accent-soft text-fg" : "border-line text-fg-2 hover:border-accent hover:text-fg"}`}
            >
              {compare.on ? <Check size={14} aria-hidden /> : <GitCompareArrows size={14} aria-hidden />}
              Comparar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value, help }: { label: string; value: ReactNode; help?: string }) {
  return (
    <div className="flex min-w-0 flex-col justify-between" title={help}>
      <dt className="leading-tight text-fg-2">{label}</dt>
      <dd className="font-semibold text-fg">{value}</dd>
    </div>
  );
}
