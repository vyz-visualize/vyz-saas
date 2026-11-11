"use client";

// Páginas do dashboard de planilha (plataformas sem API: Shopee, Spotify...): visão
// geral e campanhas, só com o que a planilha traz (investimento, impressões, cliques,
// conversões e receita). Mesmas peças dos dashboards do Meta e do Google.

import { decimal } from "@/lib/format";
import { useDashFilters } from "../filter-context";
import { formatValue, money, moneyCompact } from "../format";
import { CAMPAIGN_ROW_FILTER, hiddenOr, HeroChart, maturingPoints, StatusCell, TopCampaigns, type PageProps } from "../shared";
import type { CampaignRowVM } from "../types";
import { DataTable, InlineBar, KpiGrid, Panel, Roas } from "../ui";

const noKind = () => "";

export function ImportOverview({ data }: PageProps) {
  const { view } = data;
  const filters = useDashFilters();
  return (
    <div className="space-y-3">
      <KpiGrid platform={view.platform} kpis={view.kpis} extra={view.extraKpis} currency={data.currency} maturing={maturingPoints(data, filters?.filters.days)} hideSpend={data.hideSpend} />
      <HeroChart data={data} spendLabel="Investimento" valueLabel="Receita" />
      <TopCampaigns data={data} kindLabel={noKind} limit={6} />
    </div>
  );
}

export function ImportCampaigns({ data }: PageProps) {
  const { view, currency, hideSpend } = data;
  return (
    <div className="space-y-3">
      <Panel title="Todas as campanhas" subtitle="Como vieram na planilha, somadas no período.">
        <DataTable<CampaignRowVM>
          rows={view.campaigns}
          rowKey={(c) => c.id}
          rowFilter={CAMPAIGN_ROW_FILTER}
          caption="Campanhas da planilha no período"
          initialSort={{ key: "spend", dir: "desc" }}
          minWidth={860}
          rowClassName={(c) => (c.belowBreakEven ? "[&>*]:bg-error-soft/30" : "")}
          columns={[
            { key: "name", label: "Campanha", sticky: true, className: "w-[15rem] max-w-[15rem]", sort: (c) => c.name, render: (c) => <StatusCell name={c.name} status={c.status} sub="" /> },
            {
              key: "spend",
              metric: "spend",
              label: "Investimento",
              sort: (c) => c.spendShare,
              className: "w-[10rem]",
              render: (c) => (
                <span className="block">
                  <span className="block text-right">{hiddenOr(hideSpend, money(c.spend, currency, { decimals: false }))}</span>
                  <InlineBar share={c.spendShare} />
                </span>
              ),
            },
            { key: "value", metric: "value", label: "Receita", align: "right", sort: (c) => c.value, render: (c) => moneyCompact(c.value, currency) },
            { key: "roas", metric: "roas", label: "ROAS", align: "right", sort: (c) => c.roas, render: (c) => <Roas value={c.roas} breakEven={view.breakEvenRoas} /> },
            { key: "conv", metric: "conversions", label: "Conversões", align: "right", sort: (c) => c.conversions, render: (c) => decimal(c.conversions, 1) },
            { key: "cpa", metric: "cpa", label: "Custo por conversão", align: "right", sort: (c) => c.cpa, render: (c) => money(c.cpa, currency) },
            { key: "ctr", metric: "ctr", label: "CTR", align: "right", sort: (c) => c.ctr, render: (c) => formatValue(c.ctr, "pct") },
            { key: "cpc", metric: "cpc", label: "CPC médio", align: "right", sort: (c) => c.cpc, render: (c) => money(c.cpc, currency) },
          ]}
        />
      </Panel>
    </div>
  );
}
