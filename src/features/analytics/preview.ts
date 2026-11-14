// Prévia dos dashboards com dados reais: o gerador simulado (o mesmo que a
// sincronização grava no modo de teste) vira as linhas do armazém e passa pela
// mesma agregação. Os ids externos servem de ids. Roda no navegador.

import { aggregateOrganic, type OrganicDayRow, type OrganicPostRow, type OrganicProfile, type OrganicView } from "./organic";
import { generateOrganicData } from "@/features/sync/mock/organic";
import { organicDayRow, organicPostRow } from "@/features/sync/organic";
import { generateAccountData } from "@/features/sync/mock-generator";
import type { AccountDataset } from "@/features/sync/dataset";
import { DEFAULT_TIME_ZONE, diffDays, localDate } from "@/features/sync/dates";
import type { PeriodId } from "@/features/workspace/types";
import { aggregateDashboard } from "./aggregate";
import { dashboardRanges, maturingStart } from "./ranges";
import type { DateRange, LiveDashboardData, LivePlatform, WarehouseRows } from "./types";

/** Template live → plataforma. */
// Orgânico (Instagram e Página) usa a estrutura do Meta: os números dele vêm em data.organic.
export const TEMPLATE_PLATFORM: Record<string, LivePlatform> = { "meta-ecommerce": "meta", "meta-organico": "meta", "meta-organico-pago": "meta", "google-ecommerce": "google", "planilha-midia": "import" };

/** Do conjunto do gerador (ou de qualquer fonte) para as linhas do armazém. */
export function datasetToRows(ds: AccountDataset, current: DateRange, previous: DateRange): WarehouseRows {
  return {
    platform: ds.platform === "meta" || ds.platform === "google" ? ds.platform : "import",
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
    dashboard: { id: `amostra-${templateId}`, name: ORGANIC_NAMES[templateId] ?? SAMPLE_NAME[platform], clientName: "Loja Exemplo", templateId },
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
    ...(ORGANIC_TEMPLATES.has(templateId) ? { organic: sampleOrganic(current, previous) } : {}),
  };
}

const ORGANIC_NAMES: Record<string, string> = { "meta-organico": "Instagram e Página · Orgânico", "meta-organico-pago": "Meta · Orgânico + Anúncios" };

/** Modelos que mostram o orgânico (Instagram e Página). */
const ORGANIC_TEMPLATES = new Set(["meta-ecommerce", "meta-organico", "meta-organico-pago"]);

const SAMPLE_PROFILES: OrganicProfile[] = [
  { id: "amostra-instagram", name: "@lojaexemplo", platform: "instagram" },
  { id: "amostra-pagina", name: "Loja Exemplo", platform: "facebook" },
];

/** Orgânico do gerador para a prévia (galeria, onboarding): os dois perfis, no período e no anterior. */
export function sampleOrganic(current: DateRange, previous: DateRange): OrganicView {
  const from = previous.from < current.from ? previous.from : current.from;
  const days = diffDays(from, current.to) + 1;
  const dayRows: OrganicDayRow[] = [];
  const postRows: OrganicPostRow[] = [];
  for (const p of SAMPLE_PROFILES) {
    const d = generateOrganicData({ platform: p.platform, accountExternalId: p.id, accountName: p.name, endDate: current.to, days, anchorDate: current.to });
    for (const x of d.daily) dayRows.push({ ad_account_id: p.id, ...organicDayRow(x) });
    for (const x of d.posts) postRows.push({ ad_account_id: p.id, ...organicPostRow(x) });
  }
  return aggregateOrganic(SAMPLE_PROFILES, dayRows, postRows, current, previous);
}
