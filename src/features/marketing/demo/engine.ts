// Motor da demonstração do site: os mesmos dados de amostra e a mesma agregação dos
// dashboards de verdade, rodando no navegador. Nada vem do servidor e nada é salvo.
// Gerar a amostra custa caro (centenas de ms num celular): fica em cache por plataforma
// e período, e só roda quando a dobra pede.

import { aggregateFiltered } from "@/features/analytics/filtered";
import { NO_FILTERS, type DashFilters, type FilterLabels } from "@/features/analytics/filters";
import { sampleRows } from "@/features/analytics/preview";
import { maturingStart } from "@/features/analytics/ranges";
import type { LiveDashboardData, LivePlatform, WarehouseRows } from "@/features/analytics/types";
import { DEFAULT_TIME_ZONE } from "@/features/sync/dates";
import type { PeriodId } from "@/features/workspace/types";

/** Clientes fictícios das amostras. */
export const SAMPLE_CLIENTS: Record<LivePlatform, { client: string; account: string; dashboard: string }> = {
  meta: { client: "Loja Verde", account: "Loja Verde · Vendas", dashboard: "Meta Ads · E-commerce" },
  google: { client: "Loja Verde", account: "Loja Verde · Brasil", dashboard: "Google Ads · E-commerce" },
};

const BREAK_EVEN = 2.5;
const cache = new Map<string, WarehouseRows>();

export function sampleRowsFor(platform: LivePlatform, period: PeriodId = "30d"): WarehouseRows {
  const key = `${platform}:${period}`;
  let rows = cache.get(key);
  if (!rows) {
    rows = sampleRows(platform, { period });
    cache.set(key, rows);
  }
  return rows;
}

/** O dashboard de amostra no formato do servidor, com os filtros aplicados pela mesma regra. */
export function sampleData(platform: LivePlatform, filters: DashFilters = NO_FILTERS, period: PeriodId = "30d"): LiveDashboardData {
  const rows = sampleRowsFor(platform, period);
  const view = aggregateFiltered(rows, filters, { breakEvenRoas: BREAK_EVEN });
  const names = SAMPLE_CLIENTS[platform];
  return {
    dashboard: { id: `site-${platform}`, name: names.dashboard, clientName: names.client, templateId: platform === "meta" ? "meta-ecommerce" : "google-ecommerce" },
    platform,
    status: view.hasData ? "ok" : "no_data",
    accounts: [{ id: `site-${platform}`, name: names.account, currency: "BRL", timeZone: DEFAULT_TIME_ZONE, lastSyncedAt: null }],
    currency: "BRL",
    timeZone: DEFAULT_TIME_ZONE,
    current: rows.current,
    previous: rows.previous,
    maturingFrom: maturingStart(rows.current),
    hideSpend: false,
    sample: true,
    view,
  };
}

/** Nomes das campanhas e anúncios, para os chips de filtro. */
export function sampleLabels(platform: LivePlatform): FilterLabels {
  const rows = sampleRowsFor(platform);
  return { campaigns: Object.fromEntries(rows.campaigns.map((c) => [c.id, c.name])), ads: Object.fromEntries(rows.ads.map((a) => [a.id, a.name])) };
}
