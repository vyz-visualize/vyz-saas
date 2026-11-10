"use client";

// O dashboard do hero: a visão geral que o cliente recebe, com dados de amostra, sem
// alternar plataforma. Em cima, as contas conectadas; embaixo, o
// gráfico ocupa a altura que sobra (o painel acompanha a altura do texto do hero).
// Arrastar no gráfico filtra o painel inteiro, como no produto.

import { BriefcaseBusiness, ChartColumn, Check, Infinity as InfinityIcon, Music2, Play, Search, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { FilterBar, FilterProvider } from "@/features/analytics/filter-context";
import { kpiMetric } from "@/features/analytics/metrics";
import { HeroChart, maturingPoints } from "@/features/analytics/shared";
import { KpiCard } from "@/features/analytics/ui";
import { track } from "@/features/marketing/track";
import { sampleData, sampleLabels, SAMPLE_CLIENTS } from "./engine";
import { useLocalFilters } from "./local-filters";

/** Contas do cliente de amostra. Ícones genéricos (não os logotipos das marcas). */
export const HERO_ACCOUNTS: { name: string; icon: LucideIcon }[] = [
  { name: "Meta Ads", icon: InfinityIcon },
  { name: "Google Ads", icon: Search },
  { name: "GA4", icon: ChartColumn },
  { name: "TikTok Ads", icon: Music2 },
  { name: "LinkedIn Ads", icon: BriefcaseBusiness },
  { name: "YouTube", icon: Play },
];

function ConnectedAccounts() {
  return (
    <div>
      <p className="label-caps text-[10.5px] text-fg-2">Contas conectadas</p>
      <ul className="mt-1.5 grid grid-cols-3 gap-1 @[560px]:grid-cols-6">
        {HERO_ACCOUNTS.map(({ name, icon: Icon }) => (
          <li key={name} className="flex min-w-0 items-center gap-1.5 rounded-control border border-accent/40 bg-accent-soft/40 px-1.5 py-1.5">
            <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-accent text-on-accent" aria-hidden>
              <Icon size={12} strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[11px] leading-tight font-medium text-fg">{name}</span>
              <span className="flex items-center gap-0.5 text-[10px] leading-tight text-fg-2">
                <Check size={10} aria-hidden className="text-accent" /> conectada
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Board() {
  const labels = useMemo(() => sampleLabels("meta"), []);
  const base = useMemo(() => sampleData("meta"), []);
  const filters = useLocalFilters(labels, base.current.days, () => track("demo_interacao", { local: "hero", acao: "filtro" }));
  const data = useMemo(() => sampleData("meta", filters.filters), [filters.filters]);
  const kpis = data.view.kpis.slice(0, 4);
  const maturing = maturingPoints(data, filters.filters.days);
  return (
    <FilterProvider value={filters}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        {/* estreito e com gráfico (tablet, desktop pequeno): 2 números, para o gráfico caber */}
        <div className="grid grid-cols-2 gap-2.5 @[560px]:grid-cols-4 sm:@max-[559px]:[&>*:nth-child(n+3)]:hidden">
          {kpis.map((k) => (
            <KpiCard key={k.id} kpi={k} currency={data.currency} maturing={maturing} featured={k.id === "roas"} metric={kpiMetric("meta", k.id)} />
          ))}
        </div>
        <FilterBar />
        {/* no celular o hero fica com os números; o gráfico aparece do tablet para cima e
            ocupa o que sobra. data-no-swipe: arrastar no gráfico filtra os dias, não troca de slide */}
        <div className="hidden min-h-0 flex-1 sm:block" data-no-swipe>
          <HeroChart data={data} spendLabel="Investimento" valueLabel="Receita" fill />
        </div>
      </div>
    </FilterProvider>
  );
}

export default function HeroDashboard() {
  return (
    <div className="@container flex h-full flex-col gap-3 p-3 sm:p-4">
      {/* a amostra é a própria VYZ: a marca no topo, como o cliente vê no link */}
      {/* o canto direito é do palco do hero: a frase do slide e o selo de amostra */}
      <header className="flex min-h-[22px] items-center gap-2">
        <Wordmark className="w-[58px] shrink-0 text-accent" title={SAMPLE_CLIENTS.meta.client} />
        <h3 className="sr-only">Visão geral · 30 dias</h3>
      </header>
      <ConnectedAccounts />
      <div className="min-h-0 flex-1">
        <Board />
      </div>
    </div>
  );
}
