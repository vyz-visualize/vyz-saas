// O corte por plano da página de Criativos. Roda no servidor, depois do cache e do
// "ocultar investimento": o que o plano não cobre não chega ao navegador.

import { creativesLevel, type Tier } from "@/features/pricing/entitlements";
import type { CreativesData, CreativesTab, DashboardView, MetaView } from "../types";

export type CreativesAccess = {
  /** Plano do workspace dono do dashboard. Sem plano: só a lista. */
  tier?: Tier | null;
  tab?: CreativesTab;
  /** Anúncios já escolhidos na URL. */
  ads?: readonly string[];
  /** Mostra a amostra do plano seguinte (nunca no link compartilhado). */
  upsell?: boolean;
};

/** Devolve a view sem os dados de criativos e o pedaço que este plano pode ver. */
export function cutCreatives<V extends DashboardView>(view: V, access: CreativesAccess, ctx: { hideSpend: boolean; currency: string }): { view: V; creatives?: CreativesData } {
  if (view.platform !== "meta") return { view };
  const meta = view as MetaView;
  const level = creativesLevel(access.tier);
  const tab: CreativesTab = level === "compare" && access.tab === "comparativo" ? "comparativo" : "galeria";
  const creatives: CreativesData = {
    level,
    tab,
    list: meta.creativeList ?? [],
    gallery: level === "list" ? [] : meta.creatives,
    compare: tab === "comparativo" ? (meta.creativeDays ?? []) : [],
    initialAds: tab === "comparativo" ? [...(access.ads ?? [])].slice(0, 3) : [],
    hideSpend: ctx.hideSpend,
    currency: ctx.currency,
    breakEvenRoas: meta.breakEvenRoas,
    upsellTier: access.upsell && access.tier ? access.tier : null,
  };
  return { view: { ...view, creatives: [], creativeList: [], creativeDays: [] }, creatives };
}
