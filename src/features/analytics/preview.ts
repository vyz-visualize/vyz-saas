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
export const TEMPLATE_PLATFORM: Record<string, LivePlatform> = { "meta-ecommerce": "meta", "google-ecommerce": "google" };

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
};

export type SampleOptions = { period?: PeriodId; customDays?: number; breakEvenRoas?: number | null; today?: string };

/** As linhas do gerador para um período, antes de agregar. */
export function sampleRows(platform: LivePlatform, opts: Pick<SampleOptions, "period" | "customDays" | "today"> = {}): WarehouseRows {
  const today = opts.today ?? localDate(new Date(), DEFAULT_TIME_ZONE);
  const { current, previous } = dashboardRanges(opts.period ?? "30d", opts.customDays ?? 30, today);
  const account = SAMPLE_ACCOUNT[platform];
  const ds = generateAccountData({ platform, accountExternalId: account.id, accountName: account.name, endDate: current.to, days: current.days + previous.days });
  return datasetToRows(ds, current, previous);
}

/** Dados de amostra de um template live, no mesmo formato do servidor. */
export function sampleDashboardData(templateId: string, opts: SampleOptions = {}): LiveDashboardData | null {
  const platform = TEMPLATE_PLATFORM[templateId];
  if (!platform) return null;
  // fuso fixo: servidor e navegador chegam no mesmo dia (sem erro de hidratação)
  const today = opts.today ?? localDate(new Date(), DEFAULT_TIME_ZONE);
  const { current, previous } = dashboardRanges(opts.period ?? "30d", opts.customDays ?? 30, today);
  const account = SAMPLE_ACCOUNT[platform];
  const ds = generateAccountData({ platform, accountExternalId: account.id, accountName: account.name, endDate: current.to, days: current.days + previous.days });
  const view = aggregateDashboard(datasetToRows(ds, current, previous), { breakEvenRoas: opts.breakEvenRoas === undefined ? 2.5 : opts.breakEvenRoas });
  return {
    dashboard: { id: `amostra-${templateId}`, name: platform === "meta" ? "Meta Ads · E-commerce" : "Google Ads · E-commerce", clientName: "Loja Exemplo", templateId },
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
