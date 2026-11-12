// Dashboard no formato da UI (tipo Dashboard de workspace/types) a partir das
// linhas do banco, e as regras que o painel e o servidor repetem: páginas que o
// plano libera, período vindo da URL e o nome da cópia. Funções puras, testadas.

import type { PlatformId } from "@/features/accounts/platforms";
import { canUse, type Tier } from "@/features/pricing/entitlements";
import { PAGE_LIBRARY, PAGES } from "@/features/templates/pages";
import type { DashboardTemplate, PageId } from "@/features/templates/types";
import { ATTRIBUTIONS, type Dashboard, type DashboardSettings, type PeriodId } from "@/features/workspace/types";
import { parseLayout, type DashboardLayout } from "./layout/model";
import { parseMetricPrefs, type MetricPrefs } from "./metric-prefs";

export const PERIOD_IDS: PeriodId[] = ["7d", "30d", "mes", "custom"];
export const isPeriodId = (v: unknown): v is PeriodId => typeof v === "string" && (PERIOD_IDS as string[]).includes(v);
export const ATTRIBUTION_IDS = ATTRIBUTIONS.map((a) => a.value);

export const CUSTOM_DAYS_MIN = 3;
export const CUSTOM_DAYS_MAX = 60;
export const NAME_MAX = 80;

const clampDays = (n: number) => Math.min(CUSTOM_DAYS_MAX, Math.max(CUSTOM_DAYS_MIN, Math.round(n)));

/** Colunas lidas de dashboards. */
export type DashboardRow = {
  id: string;
  template_id: string;
  name: string;
  client_name: string;
  goal_cents: number | null;
  margin: number | string | null;
  monthly_budget_cents: number | null;
  period: string;
  custom_days: number;
  attribution: string;
  brand_color: string | null;
  hide_vyz_brand: boolean;
  metric_prefs?: unknown;
  layout?: unknown;
  created_at: string;
  updated_at: string;
};

export type PageRow = { page_type_id: string; position: number };
export type SourceRow = { id: string; name: string; platform_id: string; is_enabled: boolean };

/** Conta ligada ao dashboard (só nome e estado: nada de token nem id externo). */
export type DashboardSource = { id: string; name: string; platformId: PlatformId; isEnabled: boolean };

/** Dashboard do banco, no tipo que a UI já usava, mais o que só existe no servidor. */
export type DashboardDetail = Dashboard & {
  /** Lê os dados sincronizados (Meta/Google · E-commerce). */
  live: boolean;
  sources: DashboardSource[];
  /** Margem gravada (null = sem margem: equilíbrio no ROAS 1). */
  margin: number | null;
  /** Métricas escolhidas (só a diferença para o padrão). */
  metricPrefs: MetricPrefs;
  /** Disposição por aba (Editar disposição). {} = a do template. */
  layout: DashboardLayout;
};

/** Conta que pode alimentar um dashboard com dados reais (escolha das fontes). */
export type SourceOption = { id: string; name: string; platformId: PlatformId; businessName: string | null; isEnabled: boolean; lastSyncedAt: string | null };

export type DashboardListItem = Pick<DashboardDetail, "id" | "templateId" | "name" | "client" | "pages" | "settings" | "live" | "sources" | "createdAt" | "updatedAt">;

export function toSettings(row: Pick<DashboardRow, "goal_cents" | "margin" | "monthly_budget_cents" | "period" | "custom_days" | "attribution">): DashboardSettings {
  const margin = row.margin == null ? 0 : Number(row.margin);
  return {
    goal: row.goal_cents ?? 0,
    margin: Number.isFinite(margin) ? margin : 0,
    budget: row.monthly_budget_cents ?? 0,
    period: isPeriodId(row.period) ? row.period : "30d",
    customDays: clampDays(row.custom_days || 14),
    attribution: ATTRIBUTION_IDS.includes(row.attribution) ? row.attribution : "7c1v",
    currency: "BRL",
  };
}

/** Linhas do banco → DTO. Páginas na ordem de position; contas por nome. */
export function toDashboard(row: DashboardRow, pages: PageRow[], sources: SourceRow[]): DashboardDetail {
  const ordered = [...pages].sort((a, b) => a.position - b.position).map((p) => p.page_type_id).filter((p): p is PageId => p in PAGES);
  const list: DashboardSource[] = sources
    .map((s) => ({ id: s.id, name: s.name, platformId: s.platform_id as PlatformId, isEnabled: s.is_enabled }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const accounts: Dashboard["accounts"] = {};
  for (const s of list) accounts[s.platformId] ??= s.id;
  const settings = toSettings(row);
  return {
    id: row.id,
    templateId: row.template_id,
    name: row.name,
    client: row.client_name,
    accounts,
    pages: ordered,
    settings,
    brand: row.brand_color || row.hide_vyz_brand ? { color: row.brand_color ?? "", hideVyz: row.hide_vyz_brand } : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    live: false,
    sources: list,
    margin: row.margin == null ? null : settings.margin,
    metricPrefs: parseMetricPrefs(row.metric_prefs),
    layout: parseLayout(row.layout),
  };
}

/** Ajustes da UI → p_settings do create_dashboard / colunas do update. Zero = automático (null). */
export function settingsToDb(s: Pick<DashboardSettings, "goal" | "budget" | "period" | "customDays" | "attribution">, margin: number | null) {
  return {
    goal_cents: s.goal > 0 ? Math.round(s.goal) : null,
    margin: margin != null && margin > 0 ? Math.min(1, Math.round(margin * 10_000) / 10_000) : null,
    monthly_budget_cents: s.budget > 0 ? Math.round(s.budget) : null,
    period: s.period,
    custom_days: clampDays(s.customDays || 14),
    attribution: s.attribution,
  };
}

// ---- páginas e plano ---------------------------------------------------------------------

export type PageOption = { id: PageId; locked: boolean; tier: Tier; soon: boolean };

/**
 * Páginas que um dashboard deste template pode ter, na ordem da galeria: as do
 * template primeiro. Templates com dados reais só desenham as páginas que trazem;
 * os de exemplo aceitam a biblioteca (menos as exclusivas de outros templates).
 * locked = acima do plano (o banco recusa do mesmo jeito: plan:page).
 */
export function pageOptions(t: DashboardTemplate, pagesTier: Tier): PageOption[] {
  const ids = [...t.pages, ...PAGE_LIBRARY.filter((p) => !t.pages.includes(p) && !PAGES[p].templateOnly)];
  return ids.map((id) => ({ id, tier: PAGES[id].tier, locked: !canUse(pagesTier, PAGES[id].tier), soon: !!PAGES[id].soon }));
}

/** Páginas pedidas que valem (existem no template e cabem no plano), sem repetir, na ordem pedida. */
export function allowedPages(t: DashboardTemplate, pagesTier: Tier, asked: readonly string[]): PageId[] {
  const open = new Set(pageOptions(t, pagesTier).filter((p) => !p.locked).map((p) => p.id));
  return asked.filter((p, i): p is PageId => open.has(p as PageId) && asked.indexOf(p) === i);
}

/** Páginas padrão para um dashboard novo: as do template que o plano libera. */
export function defaultPages(t: DashboardTemplate, pagesTier: Tier): PageId[] {
  return allowedPages(t, pagesTier, t.pages);
}

// ---- período na URL ----------------------------------------------------------------------

export type PeriodChoice = { period: PeriodId; customDays: number };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** ?periodo=7d|30d|mes|custom&dias=N → período; sem nada (ou inválido), o padrão do dashboard. */
export function periodFromQuery(query: Record<string, string | string[] | undefined>, fallback: PeriodChoice): PeriodChoice {
  const raw = first(query.periodo);
  const period = isPeriodId(raw) ? raw : fallback.period;
  const days = Number(first(query.dias));
  const customDays = period === "custom" ? clampDays(Number.isFinite(days) && days > 0 ? days : fallback.customDays || 14) : fallback.customDays;
  return { period, customDays };
}

/** Período → query string (sem "?"). */
export function periodQuery({ period, customDays }: PeriodChoice): string {
  return period === "custom" ? `periodo=custom&dias=${clampDays(customDays)}` : `periodo=${period}`;
}

// ---- cópia -------------------------------------------------------------------------------

/** "Loja Verde" → "Loja Verde (cópia)", sem passar de 80 caracteres. */
export function copyName(name: string): string {
  const suffix = " (cópia)";
  const base = name.trim().replace(/ \(cópia\)$/, "");
  return `${base.slice(0, NAME_MAX - suffix.length).trimEnd()}${suffix}`;
}
