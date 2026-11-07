"use client";

// A demonstração do site: o produto de verdade, com dados de amostra, em quatro abas.
// Carrega só quando a dobra chega perto (o código e os dados não pesam no começo).

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { aggregateDashboard, CHANNEL_LABEL, FUNNEL_STAGE_LABEL } from "@/features/analytics/aggregate";
import { cutCreatives } from "@/features/analytics/creatives/access";
import { defaultAds } from "@/features/analytics/creatives/compare";
import { MIN_COMPARE } from "@/features/analytics/creatives/limits";
import { CompareView } from "@/features/analytics/creatives/CompareView";
import { UrlWritesProvider } from "@/features/analytics/creatives/url-state";
import { FilterBar, FilterProvider } from "@/features/analytics/filter-context";
import { kpiMetric } from "@/features/analytics/metrics";
import { HeroChart, maturingPoints, TopCampaigns } from "@/features/analytics/shared";
import type { MetaView } from "@/features/analytics/types";
import { KpiCard, Panel, SliceBars } from "@/features/analytics/ui";
import { track } from "@/features/marketing/track";
import { sampleData, sampleLabels, sampleRowsFor } from "./engine";
import { useLocalFilters } from "./local-filters";
import { PersonalizeDemo } from "./PersonalizeDemo";
import { VyzDemo } from "./VyzDemo";
import { useSmUp } from "@/lib/hooks";

export type DemoTab = "filtro" | "vyz" | "comparativo" | "personalizar";

export const DEMO_TABS: { id: DemoTab; label: string; hint: string }[] = [
  { id: "filtro", label: "Filtrar por campanha", hint: "Clique numa campanha ou arraste no gráfico: o painel inteiro filtra. O cliente também consegue, no link." },
  { id: "vyz", label: "Perguntar ao VYZ", hint: "Pergunte sobre os números e ele responde na hora, com os dados do dashboard." },
  { id: "comparativo", label: "Comparar criativos", hint: "Os anúncios lado a lado, com o melhor de cada métrica e uma leitura do resultado. No plano Avançado." },
  { id: "personalizar", label: "Personalizar métricas", hint: "Cada cliente vê os cards que importam para ele." },
];

function FilterDemo() {
  const labels = useMemo(() => sampleLabels("meta"), []);
  const base = useMemo(() => sampleData("meta"), []);
  const filters = useLocalFilters(labels, base.current.days, () => track("demo_interacao", { local: "demonstracao", acao: "filtro" }));
  const data = useMemo(() => sampleData("meta", filters.filters), [filters.filters]);
  const view = data.view as MetaView;
  const maturing = maturingPoints(data, filters.filters.days);
  const smUp = useSmUp();
  return (
    <FilterProvider value={filters}>
      <div className="@container space-y-3">
        <div className="grid grid-cols-2 gap-2.5 @[640px]:grid-cols-4">
          {/* no celular, os 4 primeiros; os outros 4 a partir de 640 px de largura */}
          {view.kpis.slice(0, 8).map((k, i) => (
            <div key={k.id} className={i >= 4 ? "hidden @[640px]:block" : undefined}>
              <KpiCard kpi={k} currency={data.currency} maturing={maturing} featured={k.id === "roas"} metric={kpiMetric("meta", k.id)} />
            </div>
          ))}
        </div>
        <FilterBar />
        <HeroChart data={data} spendLabel="Investimento" valueLabel="Receita" />
        <div className="grid gap-3 @[900px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <TopCampaigns data={data} limit={smUp ? 6 : 3} kindLabel={(k) => (k ? (FUNNEL_STAGE_LABEL[k] ?? CHANNEL_LABEL[k] ?? "Outras") : "Outras")} />
          <div className="hidden @[640px]:block">
            <Panel section="breakdown" title="Dispositivos" subtitle="Participação na receita e ROAS.">
              <SliceBars items={view.devices} breakEven={view.breakEvenRoas} label="Dispositivos" />
            </Panel>
          </div>
        </div>
      </div>
    </FilterProvider>
  );
}

function CompareDemo() {
  const creatives = useMemo(() => {
    const view = aggregateDashboard(sampleRowsFor("meta"), { breakEvenRoas: 2.5 }) as MetaView;
    const data = cutCreatives(view, { tier: "avancado", tab: "comparativo", ads: [] }, { hideSpend: false, currency: "BRL" }).creatives!;
    // já abre com dois escolhidos, como no produto, sem mexer no endereço do site
    return { ...data, initialAds: defaultAds(data.compare, MIN_COMPARE) };
  }, []);
  const [open, setOpen] = useState(false);
  // o comparativo inteiro é longo: abre com o começo e um clique mostra o resto
  return (
    <div className="relative">
      <div className={`@container ${open ? "" : "max-h-[1180px] overflow-hidden"}`}>
        {/* no site, a escolha dos anúncios fica só na memória: o endereço não muda */}
        <UrlWritesProvider value={false}>
          <CompareView data={creatives} />
        </UrlWritesProvider>
      </div>
      {!open && (
        <div className="absolute inset-x-0 bottom-0 flex h-48 items-end justify-center bg-linear-to-t from-card to-transparent pb-2">
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              track("demo_interacao", { local: "demonstracao", acao: "comparativo_inteiro" });
            }}
            className="inline-flex h-11 items-center gap-2 rounded-control border border-line bg-card px-4 text-[14px] font-medium text-fg outline-none hover:border-accent focus-visible:ring-2 focus-visible:ring-accent"
          >
            Ver o comparativo inteiro <ChevronDown size={16} aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}

export default function DemoTabs() {
  const [tab, setTab] = useState<DemoTab>("filtro");
  const current = DEMO_TABS.find((t) => t.id === tab)!;
  return (
    <div>
      <div role="tablist" aria-label="O que ver na demonstração" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
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
            className={`min-h-11 rounded-control border px-3.5 py-2 text-left text-[14px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent sm:rounded-chip ${tab === t.id ? "border-accent bg-accent text-on-accent" : "border-line text-fg-2 hover:border-accent hover:text-fg"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-4 min-h-[2.6em] max-w-3xl text-[15px] leading-snug text-fg-2">{current.hint}</p>
      {/* uma aba por vez; as outras não montam (no celular, sem rolagem lateral) */}
      <div id={`demo-painel-${tab}`} role="tabpanel" aria-labelledby={`demo-aba-${tab}`} className="mt-4">
        {tab === "filtro" && <FilterDemo />}
        {tab === "vyz" && <VyzDemo active />}
        {tab === "comparativo" && <CompareDemo />}
        {tab === "personalizar" && <PersonalizeDemo />}
      </div>
    </div>
  );
}
