"use client";

// Linhas fictícias no formato do armazém (WarehouseRows da Meta), só para a bancada: o
// dashboard desenha pelo mesmo caminho dos dados reais (datasetFromWarehouse).

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { AccountDayRow, WarehouseRows } from "@/features/analytics/types";
import { DEFAULT_SETTINGS } from "@/features/dashboards/data";
import { SampleDashboard } from "@/features/dashboards/SampleDashboard";
import { SyncStamp } from "@/features/dashboards/SyncStamp";
import { datasetFromWarehouse } from "@/features/metrics/warehouse-dataset";
import { anyDashboardTemplate } from "@/features/templates/live";

const TODAY = "2026-11-13";
const iso = (ago: number) => new Date(Date.parse(`${TODAY}T00:00:00Z`) - ago * 86_400_000).toISOString().slice(0, 10);

function rows(): AccountDayRow[] {
  const out: AccountDayRow[] = [];
  for (let ago = 60; ago >= 1; ago--) {
    const k = 1 + ((ago * 37) % 11) / 20;
    const link = Math.round(420 * k);
    out.push({
      date: iso(ago),
      spend: Math.round(880 * k),
      impressions: Math.round(61_000 * k),
      reach: Math.round(38_000 * k),
      clicks: Math.round(610 * k),
      linkClicks: link,
      landingPageViews: Math.round(link * 0.71),
      addToCart: Math.round(link * 0.083),
      initiateCheckout: Math.round(link * 0.034),
      conversions: Math.max(1, Math.round(link * 0.0135)),
      conversionValue: Math.round(link * 0.0135 * 189),
      videoViews: null,
      videoThruplays: null,
      searchImpressionShare: null,
      searchLostIsBudget: null,
      searchLostIsRank: null,
    });
  }
  return out;
}

export function DataHarness() {
  const params = useSearchParams();
  const visual = params.get("visual") ?? "vyz";
  const templateId = `${visual}-ecommerce`;
  const template = anyDashboardTemplate(templateId);
  const dataset = useMemo(() => {
    const current = { from: iso(30), to: iso(1), days: 30 };
    const previous = { from: iso(60), to: iso(31), days: 30 };
    const meta: WarehouseRows = { platform: "meta", current, previous, accountDaily: rows(), campaigns: [], campaignDaily: [], ads: [], adDaily: [], breakdownDaily: [], searchTermDaily: [], products: [], productDaily: [] };
    return template ? datasetFromWarehouse([meta], { profile: template.profile, today: TODAY, current, previous }) : undefined;
  }, [template]);
  if (!template || !dataset) return <p className="p-6">Modelo {templateId} não encontrado.</p>;
  // sincronizado há 8 h: o selo pede a atualização ao abrir (o Playwright segura a resposta)
  const last = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
  return (
    <div className="min-h-dvh bg-bg p-4 lg:p-8">
      <SampleDashboard
        dashboard={{ id: "00000000-0000-4000-8000-000000000001", templateId, name: "Vendas da loja", client: "Loja Verde", pages: template.pages, settings: { ...DEFAULT_SETTINGS, period: "30d" } }}
        realData={dataset}
        linkedPlatforms={["meta"]}
        syncStamp={<SyncStamp dashboardId="00000000-0000-4000-8000-000000000001" lastSyncedAt={last} timeZone="America/Sao_Paulo" autoRefresh />}
      />
    </div>
  );
}
