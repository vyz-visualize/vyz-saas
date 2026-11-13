// Regras do primeiro acesso (/comecar): boas-vindas → projeto → conectar →
// contas → modelo → "Montando seu dashboard…" → o dashboard abre com o tour.
// Um passo por vez, em modal, e "Pular por agora" em todos (nada bloqueia).
// Puro: o servidor (actions) e a tela usam as mesmas funções.

import { composedId, FEATURES, featureFits, objectiveForBusiness, VISUALS, type Feature, type FeatureId, type ObjectiveId } from "@/features/templates/dashboards/composed";
import { CORE_PROVIDER_IDS, type ProviderId } from "@/features/integrations/providers";
import { availableIn, canUse, type Tier } from "@/features/pricing/entitlements";
import { ALL_DASHBOARD_TEMPLATES } from "@/features/templates/live";
import { PAGES } from "@/features/templates/pages";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import type { OnboardingStep } from "@/features/workspace/session";

/**
 * Passos em ordem ("done" fica de fora: é o fim). "setup" é o de Contas; "model", o de Modelo.
 * Depois deles, "montando" é só a transição para o dashboard.
 */
export const ONBOARDING_STEPS = ["welcome", "project", "connect", "setup", "model"] as const;
export type ActiveStep = (typeof ONBOARDING_STEPS)[number];
/** Passos que o banco grava (o enum antigo, sem migration). */
export type SavedStep = Exclude<OnboardingStep, "done">;

/**
 * Passo da tela → valor gravado em workspaces.onboarding_step. Contas e Modelo dividem o
 * "dashboard" do enum (sem migration): o Modelo é só da tela; recarregar volta para Contas,
 * com as contas já salvas.
 */
export const STEP_TO_DB: Record<ActiveStep, SavedStep> = { welcome: "business", project: "platforms", connect: "connect", setup: "dashboard", model: "dashboard" };
const DB_TO_STEP: Record<SavedStep, ActiveStep> = { business: "welcome", platforms: "project", connect: "connect", dashboard: "setup" };

export const STEP_LABEL: Record<ActiveStep, string> = {
  welcome: "Boas-vindas",
  project: "Workspace",
  connect: "Conectar",
  setup: "Contas",
  model: "Modelo",
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

/**
 * Os passos de ação, os que a barra conta ("Passo 1 de 4"): as boas-vindas só
 * apresentam e prometem "quatro passos", então ficam fora da contagem.
 */
export const ACTION_STEPS = ["project", "connect", "setup", "model"] as const satisfies readonly ActiveStep[];

/** Número do passo de ação (1 a 4); as boas-vindas não têm número. */
export function actionNumber(step: ActiveStep): number | null {
  const i = (ACTION_STEPS as readonly string[]).indexOf(step);
  return i < 0 ? null : i + 1;
}

/** Barra de progresso (0 a 1): vazia nas boas-vindas, um quarto por passo de ação e cheia ao montar o dashboard. */
export function progressOf(step: ActiveStep | "building"): number {
  if (step === "building") return 1;
  return (actionNumber(step) ?? 0) / (ACTION_STEPS.length + 1);
}

/** Do conectar só segue com alguma plataforma conectada; sem nenhuma, a saída é "Pular por agora". */
export const canContinueFromConnect = (connected: readonly ProviderId[]) => connected.length > 0;

/** O dashboard só é montado com conta ativa: sem nenhuma, nada é criado (o passo fica pendente na Início). */
export const canBuildDashboard = (enabledAccounts: number) => enabledAccounts > 0;

/**
 * "Mais plataformas" no passo de conectar, na ordem de docs/PLATAFORMAS.md. Com login: conecta
 * se a credencial está no servidor; sem ela, "Em breve". A planilha entra pela tela de Contas.
 */
export const EXTRA_PLATFORMS: readonly { id: string; name: string; provider?: ProviderId; later?: string; soon?: boolean }[] = [
  { id: "tiktok", name: "TikTok Ads", provider: "tiktok" },
  { id: "linkedin", name: "LinkedIn Ads", provider: "linkedin" },
  { id: "ga4", name: "GA4", provider: "ga4" },
  { id: "rdstation", name: "RD Station CRM", provider: "rdstation" },
  { id: "hubspot", name: "HubSpot", provider: "hubspot" },
  { id: "pipedrive", name: "Pipedrive", provider: "pipedrive" },
  { id: "kommo", name: "Kommo", provider: "kommo" },
  { id: "planilha", name: "Planilha (Google Sheets ou CSV)", later: "Depois, em Contas" },
  // decisão de 10/11/2026: "Em breve" mesmo com o login pronto no código (app ainda não criado)
  { id: "mercado", name: "Mercado Ads", provider: "mercado", soon: true },
];

/**
 * O rodapé do passo de contas: o total que entra no dashboard, dividido como a pessoa vê na
 * tela ("3 contas no dashboard: 2 de anúncio do Meta Ads e 1 do Instagram").
 */
export function accountsSummary(parts: readonly { platformId: string; n: number }[]): string {
  const total = parts.reduce((a, p) => a + p.n, 0);
  const head = `${total} ${total === 1 ? "conta" : "contas"} no dashboard`;
  const shown = parts.filter((p) => p.n > 0);
  if (shown.length < 2) return `${head}.`;
  const name = (id: string) => (id === "meta" ? "de anúncio do Meta Ads" : id === "google" ? "de anúncio do Google Ads" : id === "instagram" ? "do Instagram" : id === "facebook" ? "de Página do Facebook" : `de ${id}`);
  const list = shown.map((p) => `${p.n} ${name(p.platformId)}`);
  return `${head}: ${list.slice(0, -1).join(", ")} e ${list[list.length - 1]}.`;
}

/** O nome do projeto foi dado por alguém? O padrão do banco é o nome do workspace (às vezes o da pessoa). */
export function isNamedProject(name: string, defaults: readonly (string | null | undefined)[]): boolean {
  const norm = (v: string) => v.trim().toLocaleLowerCase("pt-BR");
  const n = norm(name);
  return n.length > 0 && !defaults.some((d) => d && norm(d) === n);
}

/** O endereço da volta do login sem ?conectado=, ?erro=, ?provedor= nem o "#_=_" que a Meta acrescenta. */
export function cleanReturnUrl(href: string): string {
  const url = new URL(href);
  for (const k of ["conectado", "erro", "provedor"]) url.searchParams.delete(k);
  if (url.hash === "#_=_" || url.hash === "#") url.hash = "";
  return url.toString().replace(/#$/, "");
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
  // os 5 visuais no objetivo do nicho: o primeiro acesso escolhe só a cara do dashboard
  return layoutOptionsFor(objectiveForBusiness(businessTypeId), tier);
}

/** Os 5 visuais num objetivo (o sugerido pelas campanhas ou o do segmento). */
export function layoutOptionsFor(objective: ObjectiveId, tier: Tier | null): LayoutOption[] {
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
