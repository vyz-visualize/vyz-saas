"use client";

// A demonstração do site: o suficiente para dar vontade, sem expor o produto inteiro.
// Três abas, com dados de amostra: filtrar por campanha (4 números e 3 campanhas), perguntar
// ao VYZ (só os atalhos) e uma prévia do comparativo de criativos. Carrega só quando a dobra
// chega perto da tela.

import { useMemo, useState } from "react";
import { CHANNEL_LABEL, FUNNEL_STAGE_LABEL } from "@/features/analytics/aggregate";
import { FilterBar, FilterProvider } from "@/features/analytics/filter-context";
import { kpiMetric } from "@/features/analytics/metrics";
import { maturingPoints } from "@/features/analytics/shared";
import { KpiCard } from "@/features/analytics/ui";
import { track } from "@/features/marketing/track";
import { CampaignCards } from "./CampaignCards";
import { CompareTeaser } from "./CompareTeaser";
import { sampleData, sampleLabels } from "./engine";
import { useLocalFilters } from "./local-filters";
import { VyzDemo } from "./VyzDemo";

export type DemoTab = "filtro" | "vyz" | "comparativo";

export const DEMO_TABS: { id: DemoTab; label: string; short: string; hint: string }[] = [
  { id: "filtro", label: "Filtrar por campanha", short: "Filtrar", hint: "Clique numa campanha: os números de cima filtram. O cliente também consegue, no link." },
  { id: "vyz", label: "Perguntar ao VYZ", short: "Perguntar", hint: "Pergunte sobre os números e ele responde na hora, com os dados do dashboard." },
  { id: "comparativo", label: "Comparar criativos", short: "Comparar", hint: "Os anúncios lado a lado, com o melhor de cada métrica. No plano Avançado." },
];

const campaignKind = (k: string | null) => (k ? (FUNNEL_STAGE_LABEL[k] ?? CHANNEL_LABEL[k] ?? "Outras") : "Outras");

function FilterDemo() {
  const labels = useMemo(() => sampleLabels("meta"), []);
  const base = useMemo(() => sampleData("meta"), []);
  const filters = useLocalFilters(labels, base.current.days, () => track("demo_interacao", { local: "demonstracao", acao: "filtro" }));
  const data = useMemo(() => sampleData("meta", filters.filters), [filters.filters]);
  const maturing = maturingPoints(data, filters.filters.days);
  return (
    <FilterProvider value={filters}>
      <div className="@container space-y-3">
        <div className="grid grid-cols-2 gap-2.5 @[640px]:grid-cols-4">
          {data.view.kpis.slice(0, 4).map((k) => (
            <KpiCard key={k.id} kpi={k} currency={data.currency} maturing={maturing} featured={k.id === "roas"} metric={kpiMetric("meta", k.id)} />
          ))}
        </div>
        <FilterBar />
        <CampaignCards data={data} limit={3} kindLabel={campaignKind} />
      </div>
    </FilterProvider>
  );
}

export default function DemoTabs() {
  const [tab, setTab] = useState<DemoTab>("filtro");
  const current = DEMO_TABS.find((t) => t.id === tab)!;
  return (
    <div>
      <div role="tablist" aria-label="O que ver na demonstração" className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {DEMO_TABS.map((t) => (
          <button
            key={t.id}
            id={`demo-aba-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`demo-painel-${t.id}`}
            onClick={() => {
              setTab(t.id);
              track("demo_interacao", { local: "demonstracao", acao: "aba", aba: t.id });
            }}
            className={`min-h-11 rounded-control border px-3 py-2 text-[14px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent sm:rounded-chip sm:px-3.5 ${tab === t.id ? "border-accent bg-accent text-on-accent" : "border-line text-fg-2 hover:border-accent hover:text-fg"}`}
          >
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>
      <p className="mt-3 min-h-[2.6em] max-w-3xl text-[14.5px] leading-snug text-fg-2">{current.hint}</p>
      {/* uma aba por vez; as outras não montam */}
      <div id={`demo-painel-${tab}`} role="tabpanel" aria-labelledby={`demo-aba-${tab}`} className="mt-2">
        {tab === "filtro" && <FilterDemo />}
        {tab === "vyz" && <VyzDemo active />}
        {tab === "comparativo" && <CompareTeaser />}
      </div>
    </div>
  );
}
