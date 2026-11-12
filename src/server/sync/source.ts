import "server-only";

// De onde vêm os dados de uma conta. Conexão simulada → gerador determinístico
// (src/features/sync/mock-generator.ts). Conexão real → APIs do Meta (Insights)
// e do Google Ads (GAQL), em server/sync/live.

import { PLATFORMS } from "@/features/accounts/platforms";
import type { AccountDataset, SyncPlatform } from "@/features/sync/dataset";
import { generateOrganicData } from "@/features/sync/mock/organic";
import type { OrganicDataset, OrganicPlatform } from "@/features/sync/organic";
import type { AnalyticsDataset, AnalyticsPlatform } from "@/features/sync/analytics";
import { generateAnalyticsData } from "@/features/sync/mock/analytics";
import type { CrmDataset, CrmPlatform } from "@/features/sync/crm";
import { generateCrmData } from "@/features/sync/mock/crm";
import { addDays, localDate, type SyncRange } from "@/features/sync/dates";
import { generateAccountData } from "@/features/sync/mock-generator";
import { appError } from "@/server/supabase/errors";
import { fetchCrmDataset } from "./live/crm";
import { fetchGa4Dataset } from "./live/ga4";
import { fetchGoogleDataset } from "./live/google";
import { fetchMetaDataset } from "./live/meta";
import { fetchOrganicDataset } from "./live/organic";

export type SyncAccount = {
  id: string;
  workspaceId: string;
  connectionId: string;
  platform: SyncPlatform | OrganicPlatform | AnalyticsPlatform | CrmPlatform;
  externalId: string;
  name: string;
  currency: string;
  timezone: string;
  /** Quando o VYZ viu a conta pela primeira vez. */
  createdAt: string;
  isMock: boolean;
};

export interface SyncSource {
  readonly kind: "mock" | "live";
  /** Entidades e fatos diários da conta no intervalo (inclusive). */
  fetch(account: SyncAccount & { platform: SyncPlatform }, range: SyncRange): Promise<AccountDataset>;
  /** Orgânico (Instagram e Página do Facebook). */
  fetchOrganic(account: SyncAccount & { platform: OrganicPlatform }, range: SyncRange): Promise<OrganicDataset>;
  /** Site (GA4): sessões, eventos-chave e receita por dia e canal. */
  fetchAnalytics(account: SyncAccount & { platform: AnalyticsPlatform }, range: SyncRange): Promise<AnalyticsDataset>;
  /** CRM (RD Station, HubSpot, Pipedrive, Kommo): leads, negócios por etapa e ganhos por dia. */
  fetchCrm(account: SyncAccount & { platform: CrmPlatform }, range: SyncRange): Promise<CrmDataset>;
}

/**
 * As histórias do gerador ficam presas ao dia anterior à descoberta da conta
 * (o fim da sincronização inicial): sincronizar de novo, em qualquer dia,
 * regrava os mesmos números para as mesmas datas.
 */
export const storyAnchor = (account: Pick<SyncAccount, "createdAt" | "timezone">) => addDays(localDate(new Date(account.createdAt), account.timezone), -1);

export const mockSource: SyncSource = {
  kind: "mock",
  async fetch(account, range) {
    return generateAccountData({
      platform: account.platform,
      accountExternalId: account.externalId,
      accountName: account.name,
      currency: account.currency,
      endDate: range.to,
      days: range.days,
      anchorDate: storyAnchor(account),
    });
  },
  async fetchOrganic(account, range) {
    return generateOrganicData({ platform: account.platform, accountExternalId: account.externalId, accountName: account.name, endDate: range.to, days: range.days, anchorDate: storyAnchor(account) });
  },
  async fetchAnalytics(account, range) {
    return generateAnalyticsData({ accountExternalId: account.externalId, endDate: range.to, days: range.days });
  },
  async fetchCrm(account, range) {
    return generateCrmData({ platform: account.platform, accountExternalId: account.externalId, endDate: range.to, days: range.days });
  },
};

// Fonte real: Meta (Insights por campanha, anúncio e conta) e Google Ads (GAQL
// por campanha e anúncio), em server/sync/live. Ainda sem: quebras por
// público/posicionamento/dispositivo, termos de pesquisa e produtos (Shopping).
// Os tokens saem de getValidAccessToken, que renova quando precisa.
export const liveSource: SyncSource = {
  kind: "live",
  async fetch(account, range) {
    if (account.platform === "meta") return fetchMetaDataset(account, range);
    if (account.platform === "google") return fetchGoogleDataset(account, range);
    throw appError("sync:not_configured", `A importação de dados reais do ${PLATFORMS[account.platform as keyof typeof PLATFORMS]?.name ?? account.platform} ainda não está configurada.`);
  },
  async fetchOrganic(account, range) {
    return fetchOrganicDataset(account, range);
  },
  async fetchAnalytics(account, range) {
    return fetchGa4Dataset(account, range);
  },
  async fetchCrm(account, range) {
    return fetchCrmDataset(account, range);
  },
};

export const sourceFor = (account: SyncAccount): SyncSource => (account.isMock ? mockSource : liveSource);
