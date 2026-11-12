// Regras puras do editor de dashboard: páginas que as contas e os recursos pedem.

import type { Tier } from "@/features/pricing/entitlements";
import { composePages, FEATURES, type FeatureId } from "@/features/templates/dashboards/composed";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { allowedPages } from "../model";

/** Recursos ligados = as páginas de recurso que o dashboard tem. */
export const featuresOf = (pages: readonly PageId[]): FeatureId[] => FEATURES.filter((f) => pages.includes(f.id)).map((f) => f.id);

/**
 * Páginas depois de trocar contas ou recursos (modelos novos): as que composePages pede,
 * dentro do plano. A ordem que a pessoa arrumou fica; as novas entram na posição do modelo.
 */
export function recompose(t: DashboardTemplate, pagesTier: Tier, current: readonly PageId[], platforms: readonly string[], features: readonly FeatureId[]): PageId[] {
  const next = allowedPages(t, pagesTier, composePages(platforms, features));
  const kept = current.filter((p) => next.includes(p));
  const out = [...kept];
  for (const p of next) {
    if (out.includes(p)) continue;
    // entra antes da primeira página que vem depois dela no modelo
    const after = next.slice(next.indexOf(p) + 1).find((q) => out.includes(q));
    out.splice(after ? out.indexOf(after) : out.length, 0, p);
  }
  return out;
}

