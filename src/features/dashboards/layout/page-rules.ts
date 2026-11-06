// Regras da disposição de uma aba: que blocos ela aceita e como vem do template.
// A primeira aba de um template com visual próprio usa os blocos do visual; as
// outras, os do template. Painel e servidor usam a mesma regra.

import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { pageLayout } from "../data";
import { isSkinBlock, SKIN_BLOCKS, skinGrid } from "../skins/blocks";
import { allowedIds } from "./allowed";
import { defaultGrid, kindOf, parseMetricCardId, type PageGrid } from "./model";
import { metricAllowed } from "./platform-metrics";

export const skinnedPage = (t: DashboardTemplate, page: PageId) => !!t.skin && page === t.pages[0];

export function pageRules(t: DashboardTemplate, page: PageId, hideSpend?: boolean): { accept: (id: string) => boolean; base: () => PageGrid; labels: { id: string; label: string }[] | null } {
  if (t.skin && skinnedPage(t, page)) {
    const skin = t.skin;
    return {
      accept: (id) => {
        if (kindOf(id) === "skin") return isSkinBlock(skin, id);
        const m = parseMetricCardId(id);
        return !!m && metricAllowed(t.sources, m.platform, m.metric, hideSpend);
      },
      base: () => skinGrid(skin),
      labels: SKIN_BLOCKS[skin].map(({ id, label }) => ({ id, label })),
    };
  }
  const layout = pageLayout(t, page);
  return { accept: allowedIds(layout, t.sources, hideSpend), base: () => defaultGrid(layout), labels: null };
}
