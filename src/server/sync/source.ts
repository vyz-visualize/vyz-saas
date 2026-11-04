import "server-only";

// De onde vêm os dados de uma conta. Conexão simulada → gerador determinístico
// (src/features/sync/mock-generator.ts). Conexão real → APIs do Meta (Insights)
// e do Google Ads (GAQL); ainda não implementadas: a fonte real avisa que não
// está configurada e a sincronização falha com essa mensagem.

import { PLATFORMS } from "@/features/accounts/platforms";
import type { AccountDataset, SyncPlatform } from "@/features/sync/dataset";
import { addDays, localDate, type SyncRange } from "@/features/sync/dates";
import { generateAccountData } from "@/features/sync/mock-generator";
import { appError } from "@/server/supabase/errors";

export type SyncAccount = {
  id: string;
  workspaceId: string;
  connectionId: string;
  platform: SyncPlatform;
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
  fetch(account: SyncAccount, range: SyncRange): Promise<AccountDataset>;
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
};

// Pendente: Meta → GET /act_<id>/insights (level=ad, time_increment=1, breakdowns
// por público/posicionamento/dispositivo/região; eventos por readMetaActions, em
// features/sync/meta-actions.ts: um campo por evento, sem contar em dobro) e
// level=account só para o alcance da conta (accountDaily.reach: pessoas únicas,
// não a soma das campanhas; a sincronização grava esse número depois do rollup); Google →
// searchStream com GAQL (campaign, ad_group_ad, search_term_view,
// shopping_performance_view, segments.device/hour). Os tokens saem de
// readConnectionTokens (área integrations) e o resultado vira um AccountDataset.
export const liveSource: SyncSource = {
  kind: "live",
  async fetch(account) {
    throw appError("sync:not_configured", `A importação de dados reais do ${PLATFORMS[account.platform].name} ainda não está configurada.`);
  },
};

export const sourceFor = (account: SyncAccount): SyncSource => (account.isMock ? mockSource : liveSource);
