"use client";

// O dashboard do hero: a visão geral que o cliente recebe, com dados de amostra, sem
// alternar plataforma. Em cima, as contas conectadas (e as que vêm em breve).
// Clicar numa campanha filtra o painel inteiro, como no produto.

import { BriefcaseBusiness, ChartColumn, Check, Infinity as InfinityIcon, Music2, Play, Search, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { CHANNEL_LABEL, FUNNEL_STAGE_LABEL } from "@/features/analytics/aggregate";
import { FilterBar, FilterProvider } from "@/features/analytics/filter-context";
import { kpiMetric } from "@/features/analytics/metrics";
import { HeroChart, maturingPoints, TopCampaigns } from "@/features/analytics/shared";
import { KpiCard } from "@/features/analytics/ui";
import { track } from "@/features/marketing/track";
import { sampleData, sampleLabels, SAMPLE_CLIENTS } from "./engine";
import { useLocalFilters } from "./local-filters";

/** Contas do cliente de amostra. Ícones genéricos (não os logotipos das marcas). */
export const HERO_ACCOUNTS: { name: string; icon: LucideIcon; live: boolean }[] = [
  { name: "Meta Ads", icon: InfinityIcon, live: true },
  { name: "Google Ads", icon: Search, live: true },
  { name: "GA4", icon: ChartColumn, live: false },
  { name: "TikTok Ads", icon: Music2, live: false },
  { name: "LinkedIn Ads", icon: BriefcaseBusiness, live: false },
  { name: "YouTube", icon: Play, live: false },
];

function ConnectedAccounts() {
  return (
    <div>
      <p className="label-caps text-[10.5px] text-fg-2">Contas conectadas</p>
      <ul className="mt-1.5 grid grid-cols-2 gap-1.5 @[460px]:grid-cols-3 @[640px]:grid-cols-6">
        {HERO_ACCOUNTS.map(({ name, icon: Icon, live }) => (
          <li key={name} className={`flex min-w-0 items-center gap-1.5 rounded-control border px-2 py-1.5 ${live ? "border-accent/40 bg-accent-soft/40" : "border-line border-dashed"}`}>
            <span className={`inline-flex size-6 shrink-0 items-center justify-center rounded-[6px] ${live ? "bg-accent text-on-accent" : "bg-line/50 text-fg-2"}`} aria-hidden>
              <Icon size={13} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className={`block truncate text-[11.5px] leading-tight font-medium ${live ? "text-fg" : "text-fg-2"}`}>{name}</span>
              <span className="flex items-center gap-0.5 text-[10px] leading-tight text-fg-2">
                {live ? (
                  <>
                    <Check size={10} aria-hidden className="text-accent" /> conectada
                  </>
                ) : (
                  "em breve"
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const kindLabel = (k: string | null) => (k ? (FUNNEL_STAGE_LABEL[k] ?? CHANNEL_LABEL[k] ?? "Outras") : "Outras");

function Board({ compact }: { compact?: boolean }) {
  const labels = useMemo(() => sampleLabels("meta"), []);
  const base = useMemo(() => sampleData("meta"), []);
  const filters = useLocalFilters(labels, base.current.days, () => track("demo_interacao", { local: "hero", acao: "filtro" }));
  const data = useMemo(() => sampleData("meta", filters.filters), [filters.filters]);
  const kpis = data.view.kpis.slice(0, 4);
  const maturing = maturingPoints(data, filters.filters.days);
  return (
    <FilterProvider value={filters}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5 @[560px]:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard key={k.id} kpi={k} currency={data.currency} maturing={maturing} featured={k.id === "roas"} metric={kpiMetric("meta", k.id)} />
          ))}
        </div>
        <FilterBar />
        {/* no celular o hero fica com os números; o gráfico aparece do tablet para cima */}
        <div className="hidden sm:block">
          <HeroChart data={data} spendLabel="Investimento" valueLabel="Receita" />
        </div>
        {!compact && (
          <div className="hidden sm:block">
            <TopCampaigns data={data} limit={2} kindLabel={kindLabel} />
          </div>
        )}
      </div>
    </FilterProvider>
  );
}

export default function HeroDashboard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="@container flex h-full flex-col gap-3 p-3 sm:p-4">
      <header className="flex items-baseline justify-between gap-2">
        <p className="truncate text-[15px] font-semibold text-fg">{SAMPLE_CLIENTS.meta.client}</p>
        <p className="shrink-0 text-[12px] text-fg-2">Visão geral · 30 dias</p>
      </header>
      <ConnectedAccounts />
      <div className="min-h-0 flex-1">
        <Board compact={compact} />
      </div>
    </div>
  );
}
