"use client";

// O dashboard do hero: o mesmo painel que o cliente recebe, com dados de amostra.
// Meta e Google em abas, cada plataforma com a sua venda, sem somar uma na outra.
// Clicar numa campanha filtra o painel inteiro, como no produto.

import { useMemo, useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { CHANNEL_LABEL, FUNNEL_STAGE_LABEL } from "@/features/analytics/aggregate";
import { FilterBar, FilterProvider } from "@/features/analytics/filter-context";
import { kpiMetric } from "@/features/analytics/metrics";
import { HeroChart, maturingPoints, TopCampaigns } from "@/features/analytics/shared";
import type { LivePlatform } from "@/features/analytics/types";
import { KpiCard } from "@/features/analytics/ui";
import { track } from "@/features/marketing/track";
import { sampleData, sampleLabels, SAMPLE_CLIENTS } from "./engine";
import { useLocalFilters } from "./local-filters";

const kindLabel = (platform: LivePlatform) => (k: string | null) => (k ? ((platform === "meta" ? FUNNEL_STAGE_LABEL[k] : CHANNEL_LABEL[k]) ?? "Outras") : "Outras");

function Board({ platform, compact }: { platform: LivePlatform; compact?: boolean }) {
  const labels = useMemo(() => sampleLabels(platform), [platform]);
  const base = useMemo(() => sampleData(platform), [platform]);
  const filters = useLocalFilters(labels, base.current.days, () => track("demo_interacao", { local: "hero", acao: "filtro" }));
  const data = useMemo(() => sampleData(platform, filters.filters), [platform, filters.filters]);
  const kpis = data.view.kpis.slice(0, 4);
  const maturing = maturingPoints(data, filters.filters.days);
  return (
    <FilterProvider value={filters}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2.5 @[560px]:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard key={k.id} kpi={k} currency={data.currency} maturing={maturing} featured={k.id === "roas"} metric={kpiMetric(platform, k.id)} />
          ))}
        </div>
        <FilterBar />
        {/* no celular o hero fica com os números; o gráfico está na demonstração, logo abaixo */}
        <div className="hidden sm:block">
          <HeroChart data={data} spendLabel={platform === "meta" ? "Investimento" : "Custo"} valueLabel={platform === "meta" ? "Receita" : "Valor de conversão"} />
        </div>
        {/* no celular a tabela fica para a demonstração, logo abaixo */}
        {!compact && (
          <div className="hidden sm:block">
            <TopCampaigns data={data} limit={2} kindLabel={kindLabel(platform)} />
          </div>
        )}
      </div>
    </FilterProvider>
  );
}

export default function HeroDashboard({ compact = false }: { compact?: boolean }) {
  const [platform, setPlatform] = useState<LivePlatform>("meta");
  return (
    <div className="@container flex h-full flex-col gap-3 p-3 sm:p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-fg">{SAMPLE_CLIENTS[platform].client}</p>
          <p className="text-[12px] text-fg-2">Cada plataforma com a sua venda, sem somar uma na outra</p>
        </div>
        <Segmented<LivePlatform>
          label="Plataforma"
          size="sm"
          value={platform}
          onChange={(p) => {
            setPlatform(p);
            track("demo_interacao", { local: "hero", acao: "plataforma", plataforma: p });
          }}
          options={[
            { value: "meta", label: "Meta Ads" },
            { value: "google", label: "Google Ads" },
          ]}
        />
      </header>
      {/* trocar de plataforma começa sem filtro: as campanhas são outras */}
      <div className="min-h-0 flex-1">
        <Board key={platform} platform={platform} compact={compact} />
      </div>
    </div>
  );
}
