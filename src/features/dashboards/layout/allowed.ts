// Ids que uma aba aceita na disposição. O mesmo filtro vale no painel e no servidor.

import type { PlatformId } from "@/features/accounts/platforms";
import type { PageLayout } from "@/features/templates/types";
import { kindOf, parseMetricCardId } from "./model";
import { metricAllowed } from "./platform-metrics";

export function allowedIds(layout: PageLayout, sources: readonly PlatformId[], hideSpend?: boolean) {
  return (id: string) => {
    const kind = kindOf(id);
    if (kind === "kpis") return layout.kpis.length > 0;
    if (kind === "widget") return /^w\d+$/.test(id) && Number(id.slice(1)) < layout.widgets.length;
    const m = parseMetricCardId(id);
    return !!m && metricAllowed(sources, m.platform, m.metric, hideSpend);
  };
}
