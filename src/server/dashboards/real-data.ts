import "server-only";

// Os números reais de um dashboard de modelo (não "live"): contas da Meta e do
// Google ligadas, e nos modelos novos também planilhas, CRMs, GA4 e orgânico.
// Sem conta ligada, realData fica vazio e a tela usa a amostra (com o aviso).
// Usado no painel (sessão da pessoa) e no link público (chave de serviço, só leitura).

import type { PlatformId } from "@/features/accounts/platforms";
import type { DashboardDetail } from "@/features/dashboards/model";
import type { SourceExtras } from "@/features/dashboards/SourcePages";
import type { Dataset } from "@/features/metrics/source";
import { datasetFromWarehouse } from "@/features/metrics/warehouse-dataset";
import { isCrmSyncPlatform } from "@/features/sync/crm";
import { LINKABLE_SOURCES } from "@/features/templates/dashboards/composed";
import type { DashboardTemplate } from "@/features/templates/types";
import type { PeriodId } from "@/features/workspace/types";
import { loadTemplateWarehouse } from "@/server/analytics/queries";
import type { DB } from "@/server/supabase/server";

export type DashboardData = { realData?: Dataset; linkedPlatforms?: PlatformId[]; sourceExtras?: SourceExtras };

export async function loadDashboardData(d: DashboardDetail, template: DashboardTemplate | undefined, opts: { period: PeriodId; customDays: number; db?: DB }): Promise<DashboardData> {
  if (!template) return {};
  const warehouse = await loadTemplateWarehouse(d.id, { platforms: template.composed ? LINKABLE_SOURCES : template.sources, period: opts.period, customDays: opts.customDays, db: opts.db });
  if (!warehouse) return {};
  const realData = datasetFromWarehouse(
    warehouse.sets,
    { profile: template.profile, today: warehouse.today, current: warehouse.current, previous: warehouse.previous, goal: d.settings.goal || undefined, margin: d.settings.margin || undefined, budget: d.settings.budget || undefined },
    warehouse.analytics,
    warehouse.crm,
  );
  const extras =
    template.composed && (warehouse.analytics.length || warehouse.crm.length || warehouse.accounts.some((a) => isCrmSyncPlatform(a.platform)) || warehouse.organic.all)
      ? { current: warehouse.current, previous: warehouse.previous, currency: "BRL", analytics: warehouse.analytics, crm: warehouse.crm, organic: warehouse.organic }
      : undefined;
  return { realData, linkedPlatforms: [...new Set(warehouse.accounts.map((a) => a.platform))] as PlatformId[], sourceExtras: extras };
}
