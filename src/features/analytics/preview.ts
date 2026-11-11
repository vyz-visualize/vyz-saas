// Prévia dos dashboards com dados reais: o gerador simulado (o mesmo que a
// sincronização grava no modo de teste) vira as linhas do armazém e passa pela
// mesma agregação. Os ids externos servem de ids. Roda no navegador.

import { generateAccountData } from "@/features/sync/mock-generator";
import type { AccountDataset } from "@/features/sync/dataset";
import { DEFAULT_TIME_ZONE, localDate } from "@/features/sync/dates";
import type { PeriodId } from "@/features/workspace/types";
import { aggregateDashboard } from "./aggregate";
import { dashboardRanges, maturingStart } from "./ranges";
import type { DateRange, LiveDashboardData, LivePlatform, WarehouseRows } from "./types";

/** Template live → plataforma. */
export const TEMPLATE_PLATFORM: Record<string, LivePlatform> = { "meta-ecommerce": "meta", "google-ecommerce": "google", "planilha-midia": "import" };

/** Do conjunto do gerador (ou de qualquer fonte) para as linhas do armazém. */
export function datasetToRows(ds: AccountDataset, current: DateRange, previous: DateRange): WarehouseRows {
  return {
    platform: ds.platform,
    current,
    previous,
    accountDaily: ds.accountDaily,
    campaigns: ds.campaigns.map((c) => ({ id: c.externalId, name: c.name, objective: c.objective, status: c.status, channel: c.channel, funnelStage: c.funnelStage, dailyBudget: c.dailyBudget })),
    campaignDaily: ds.campaignDaily.map(({ campaignExternalId, ...r }) => ({ ...r, campaignId: campaignExternalId })),
    ads: ds.ads.map((a) => ({ id: a.externalId, campaignId: a.campaignExternalId, postUrl: a.postUrl ?? null, name: a.name, format: a.format, status: a.status, headline: a.headline, thumbnailUrl: a.thumbnailUrl })),
    adDaily: ds.adDaily.map(({ adExternalId, ...r }) => ({ ...r, adId: adExternalId })),
    breakdownDaily: ds.breakdownDaily,
    searchTermDaily: ds.searchTermDaily.map(({ campaignExternalId, ...r }) => ({ ...r, campaignId: campaignExternalId })),
    products: ds.products.map((p) => ({ id: p.externalId, title: p.title, category: p.category, imageUrl: p.imageUrl, price: p.price })),
    productDaily: ds.productDaily.map(({ productExternalId, ...r }) => ({ ...r, productId: productExternalId })),
  };
}

const SAMPLE_ACCOUNT: Record<LivePlatform, { id: string; name: string }> = {
  meta: { id: "act_amostra_vyz", name: "Loja Exemplo · Vendas" },
  google: { id: "000-000-0000", name: "Loja Exemplo · Brasil" },
  import: { id: "planilha-amostra", name: "Loja Exemplo · Planilha" },
};

const SAMPLE_NAME: Record<LivePlatform, string> = { meta: "Meta Ads · E-commerce", google: "Google Ads · E-commerce", import: "Planilha · Mídia paga" };

/**
 * Linhas de amostra de uma plataforma. A planilha usa os números do gerador do
 * Google só com o que uma planilha traz: campanhas e totais por dia.
 */
function sampleWarehouse(platform: LivePlatform, current: DateRange, previous: DateRange): WarehouseRows {
  const account = SAMPLE_ACCOUNT[platform];
  const ds = generateAccountData({ platform: platform === "import" ? "google" : platform, accountExternalId: account.id, accountName: account.name, endDate: current.to, days: current.days + previous.days });
  const rows = datasetToRows(ds, current, previous);
  if (platform !== "import") return rows;
  return { ...rows, platform: "import", campaigns: rows.campaigns.map((c) => ({ ...c, channel: null, funnelStage: null })), ads: [], adDaily: [], breakdownDaily: [], searchTermDaily: [], products: [], productDaily: [] };
}

export type SampleOptions = { period?: PeriodId; customDays?: number; breakEvenRoas?: number | null; today?: string };

/** As linhas do gerador para um período, antes de agregar. */
export function sampleRows(platform: LivePlatform, opts: Pick<SampleOptions, "period" | "customDays" | "today"> = {}): WarehouseRows {
  const today = opts.today ?? localDate(new Date(), DEFAULT_TIME_ZONE);
  const { current, previous } = dashboardRanges(opts.period ?? "30d", opts.customDays ?? 30, today);
  return sampleWarehouse(platform, current, previous);
}

/** Dados de amostra de um template live, no mesmo formato do servidor. */
export function sampleDashboardData(templateId: string, opts: SampleOptions = {}): LiveDashboardData | null {
  const platform = TEMPLATE_PLATFORM[templateId];
  if (!platform) return null;
  // fuso fixo: servidor e navegador chegam no mesmo dia (sem erro de hidratação)
  const today = opts.today ?? localDate(new Date(), DEFAULT_TIME_ZONE);
  const { current, previous } = dashboardRanges(opts.period ?? "30d", opts.customDays ?? 30, today);
  const account = SAMPLE_ACCOUNT[platform];
  const view = aggregateDashboard(sampleWarehouse(platform, current, previous), { breakEvenRoas: opts.breakEvenRoas === undefined ? 2.5 : opts.breakEvenRoas });
  return {
    dashboard: { id: `amostra-${templateId}`, name: SAMPLE_NAME[platform], clientName: "Loja Exemplo", templateId },
    platform,
    status: "ok",
    accounts: [{ id: account.id, name: account.name, currency: "BRL", timeZone: DEFAULT_TIME_ZONE, lastSyncedAt: null }],
    currency: "BRL",
    timeZone: DEFAULT_TIME_ZONE,
    current,
    previous,
    maturingFrom: maturingStart(current),
    hideSpend: false,
    sample: true,
    view,
  };
}
