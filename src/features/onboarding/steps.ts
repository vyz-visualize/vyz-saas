// Regras do onboarding (/comecar): nicho → layout → conectar. Ordem dos
// passos, layouts de cada nicho (com o que o plano libera), plataformas que o
// layout usa e as páginas liberadas. Puro: o servidor (actions) e a tela usam
// as mesmas funções.

import { templateBusinessTypes } from "@/features/catalog/business-types";
import { CORE_PROVIDER_IDS, type ProviderId } from "@/features/integrations/providers";
import { availableIn, canUse, type Tier } from "@/features/pricing/entitlements";
import { ALL_DASHBOARD_TEMPLATES } from "@/features/templates/live";
import { PAGES } from "@/features/templates/pages";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import type { OnboardingStep } from "@/features/workspace/session";

/**
 * Passos em ordem ("done" fica de fora: é o fim). No banco o passo do layout
 * se chama "platforms" (enum antigo); "dashboard" antigo vale como "connect".
 */
export const ONBOARDING_STEPS = ["business", "platforms", "connect"] as const satisfies readonly OnboardingStep[];
export type ActiveStep = (typeof ONBOARDING_STEPS)[number];

export const STEP_LABEL: Record<ActiveStep, string> = {
  business: "Nicho",
  platforms: "Layout",
  connect: "Conectar",
};

/** Passo do banco → passo da tela. */
export const activeStepOf = (raw: OnboardingStep): ActiveStep => (raw === "dashboard" ? "connect" : isActiveStep(raw) ? raw : "business");

export const isActiveStep = (v: unknown): v is ActiveStep => typeof v === "string" && (ONBOARDING_STEPS as readonly string[]).includes(v);

/** Posição do passo (done = depois do último). */
export function stepIndex(step: OnboardingStep): number {
  return step === "done" ? ONBOARDING_STEPS.length : ONBOARDING_STEPS.indexOf(activeStepOf(step));
}

/** Só dá para voltar a um passo anterior ao atual. */
export function canGoBackTo(current: OnboardingStep, target: OnboardingStep): boolean {
  return isActiveStep(target) && current !== "done" && stepIndex(target) < stepIndex(current);
}

/** Plataformas que conectam por login agora (as outras aparecem como "em breve"). */
export const CONNECTABLE: readonly ProviderId[] = CORE_PROVIDER_IDS;
export const isConnectable = (id: string): id is ProviderId => (CONNECTABLE as readonly string[]).includes(id);

/** Plataformas que o layout usa e que conectam por login agora (Meta, Google). */
export function layoutProviders(t: DashboardTemplate): ProviderId[] {
  return CONNECTABLE.filter((p) => (t.sources as readonly string[]).includes(p));
}

/** Plataforma do template live (Meta Ads · E-commerce → meta). */
export function templateProvider(t: DashboardTemplate): ProviderId | null {
  const source = t.sources[0];
  return source && isConnectable(source) ? source : null;
}

export type LayoutOption = {
  template: DashboardTemplate;
  /** Serve ao nicho escolhido. */
  fits: boolean;
  /** O plano libera. */
  allowed: boolean;
  /** "Disponível no Padrão" quando não libera. */
  lockLabel: string | null;
  live: boolean;
};

/**
 * Layouts do passo 2: todos os templates. Primeiro os que o plano libera
 * (os do nicho na frente), depois os travados (vitrine do upgrade), do plano
 * mais simples ao mais completo.
 */
export function layoutOptions(businessTypeId: string | null, tier: Tier | null): LayoutOption[] {
  const rank = (t: Tier) => ({ base: 0, pro: 1, avancado: 2, personalizado: 3 })[t];
  return ALL_DASHBOARD_TEMPLATES.map((template) => {
    const allowed = !!tier && canUse(tier, template.tier);
    return {
      template,
      fits: !!businessTypeId && (templateBusinessTypes(template.profile) as string[]).includes(businessTypeId),
      allowed,
      lockLabel: allowed ? null : availableIn(template.tier),
      live: template.dataMode === "live",
    };
  }).sort((a, b) => Number(b.allowed) - Number(a.allowed) || Number(b.fits) - Number(a.fits) || rank(a.template.tier) - rank(b.template.tier));
}

export type TemplatePage = { id: PageId; name: string; allowed: boolean; lockLabel: string | null };

/** Páginas do template com o que o plano libera (a ordem é a do template). */
export function templatePages(t: DashboardTemplate, pagesTier: Tier | null): TemplatePage[] {
  return t.pages.map((id) => {
    const page = PAGES[id];
    const allowed = !!pagesTier && canUse(pagesTier, page.tier);
    return { id, name: page.name, allowed, lockLabel: allowed ? null : availableIn(page.tier) };
  });
}

/** Só as páginas que o plano libera (o que vai para create_dashboard). */
export function allowedPages(t: DashboardTemplate, pagesTier: Tier | null): PageId[] {
  return templatePages(t, pagesTier)
    .filter((p) => p.allowed)
    .map((p) => p.id);
}

/** "12,5" ou "12.5" → 12.5; "1.500" → 1500; vazio → null; inválido → NaN. */
export function parseDecimal(raw: string): number | null {
  const v = raw.trim().replace(/\s/g, "");
  if (!v) return null;
  const thousands = /^\d{1,3}(\.\d{3})+$/.test(v);
  const normalized = v.includes(",") || thousands ? v.replace(/\./g, "").replace(",", ".") : v;
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

/** Margem em % (1 a 100) → fração para o banco; null quando vazia. */
export function marginFromPercent(raw: string): number | null | "invalid" {
  const v = parseDecimal(raw);
  if (v === null) return null;
  if (!Number.isFinite(v) || v <= 0 || v > 100) return "invalid";
  return Math.round(v * 100) / 10000;
}

/** Valor em reais → centavos; null quando vazio. */
export function centsFromReais(raw: string): number | null | "invalid" {
  const v = parseDecimal(raw.replace(/^R\$/i, ""));
  if (v === null) return null;
  if (!Number.isFinite(v) || v <= 0 || v > 10_000_000) return "invalid";
  return Math.round(v * 100);
}
