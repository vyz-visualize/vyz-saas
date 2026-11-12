// Regras do primeiro acesso (/comecar): boas-vindas → projeto → conectar →
// contas e modelo → "Montando seu dashboard…" → o dashboard abre com o tour.
// Um passo por vez, em modal, e "Pular por agora" em todos (nada bloqueia).
// Puro: o servidor (actions) e a tela usam as mesmas funções.

import { composedId, FEATURES, featureFits, objectiveForBusiness, VISUALS, type Feature, type FeatureId } from "@/features/templates/dashboards/composed";
import { CORE_PROVIDER_IDS, type ProviderId } from "@/features/integrations/providers";
import { availableIn, canUse, type Tier } from "@/features/pricing/entitlements";
import { ALL_DASHBOARD_TEMPLATES } from "@/features/templates/live";
import { PAGES } from "@/features/templates/pages";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import type { OnboardingStep } from "@/features/workspace/session";

/** Passos em ordem ("done" fica de fora: é o fim). O 5º, "montando", é só a transição para o dashboard. */
export const ONBOARDING_STEPS = ["welcome", "project", "connect", "setup"] as const;
export type ActiveStep = (typeof ONBOARDING_STEPS)[number];
/** Passos que o banco grava (o enum antigo, sem migration). */
export type SavedStep = Exclude<OnboardingStep, "done">;

/** Passo da tela → valor gravado em workspaces.onboarding_step. */
export const STEP_TO_DB: Record<ActiveStep, SavedStep> = { welcome: "business", project: "platforms", connect: "connect", setup: "dashboard" };
const DB_TO_STEP: Record<SavedStep, ActiveStep> = { business: "welcome", platforms: "project", connect: "connect", dashboard: "setup" };

export const STEP_LABEL: Record<ActiveStep, string> = {
  welcome: "Boas-vindas",
  project: "Projeto",
  connect: "Conectar",
  setup: "Contas e modelo",
};

/** Passo do banco → passo da tela (valor desconhecido: o começo). */
export const activeStepOf = (raw: OnboardingStep): ActiveStep => (raw !== "done" && raw in DB_TO_STEP ? DB_TO_STEP[raw] : "welcome");

export const isActiveStep = (v: unknown): v is ActiveStep => typeof v === "string" && (ONBOARDING_STEPS as readonly string[]).includes(v);

/** Posição do passo (done = depois do último). */
export function stepIndex(step: ActiveStep | "done"): number {
  return step === "done" ? ONBOARDING_STEPS.length : ONBOARDING_STEPS.indexOf(step);
}

/** Só dá para voltar a um passo anterior ao atual. */
export function canGoBackTo(current: ActiveStep, target: unknown): target is ActiveStep {
  return isActiveStep(target) && stepIndex(target) < stepIndex(current);
}

/** Barra de progresso: quanto já foi (0 a 1). "building" (montando o dashboard) completa a barra. */
export function progressOf(step: ActiveStep | "building"): number {
  if (step === "building") return 1;
  return (stepIndex(step) + 1) / (ONBOARDING_STEPS.length + 1);
}

/** Do conectar só segue com alguma plataforma conectada; sem nenhuma, a saída é "Pular por agora". */
export const canContinueFromConnect = (connected: readonly ProviderId[]) => connected.length > 0;

/** O dashboard só é montado com conta ativa: sem nenhuma, nada é criado (o passo fica pendente na Início). */
export const canBuildDashboard = (enabledAccounts: number) => enabledAccounts > 0;

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
  // os 5 visuais no objetivo do nicho: o primeiro acesso escolhe só a cara do dashboard
  const objective = objectiveForBusiness(businessTypeId);
  return VISUALS.flatMap((v) => {
    const template = ALL_DASHBOARD_TEMPLATES.find((t) => t.id === composedId(v.id, objective));
    if (!template) return [];
    const allowed = !!tier && canUse(tier, template.tier);
    return [{ template, fits: true, allowed, lockLabel: allowed ? null : availableIn(template.tier), live: false }];
  });
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

export type FeatureOption = Feature & {
  /** Combina com as plataformas conectadas. */
  fits: boolean;
  /** O plano libera. */
  allowed: boolean;
  lockLabel: string | null;
};

/** Recursos do passo final: só os que combinam com as plataformas, com o que o plano libera. */
export function featureOptions(platforms: readonly string[], tier: Tier | null): FeatureOption[] {
  return FEATURES.filter((f) => featureFits(f, platforms)).map((f) => {
    const allowed = !!tier && canUse(tier, f.tier);
    return { ...f, fits: true, allowed, lockLabel: allowed ? null : availableIn(f.tier) };
  });
}

/** Recursos pedidos que o plano libera e combinam com as plataformas (o que o servidor aceita). */
export function allowedFeatures(requested: readonly string[], platforms: readonly string[], tier: Tier | null): FeatureId[] {
  return featureOptions(platforms, tier)
    .filter((f) => f.allowed && requested.includes(f.id))
    .map((f) => f.id);
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
