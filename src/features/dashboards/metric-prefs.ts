// Métricas que cada dashboard mostra: catálogo por plataforma, padrão do template e
// o que o usuário ocultou ou ligou. Funções puras (painel, link público e testes).
// O banco guarda só a diferença para o padrão (dashboards.metric_prefs).

import { isAdPlatform, type PlatformId } from "@/features/accounts/platforms";
import { ADD_TO_CART_METRIC, GOOGLE_EXTRA_METRICS, META_EXTRA_METRICS, RESULT_METRICS } from "@/features/analytics/live-metrics";
import { metric as baseMetric, type MetricId, type Profile } from "@/features/metrics/definitions";

export type MetricGroup = "gerais" | "conversoes" | "custos" | "taxas" | "video" | "engajamento";
export type MetricSection = "kpis" | "columns";
export type MetricScope = "meta" | "google" | "import" | "sample";

export const METRIC_GROUP_LABEL: Record<MetricGroup, string> = { gerais: "Gerais", conversoes: "Conversões", custos: "Custos", taxas: "Taxas", video: "Vídeo", engajamento: "Engajamento" };
export const METRIC_GROUPS: MetricGroup[] = ["gerais", "conversoes", "custos", "taxas", "video", "engajamento"];
export const METRIC_SECTION_LABEL: Record<MetricSection, string> = { kpis: "Cards de KPI", columns: "Tabelas" };

/** Quantos cards cabem sem quebrar a grade (2 linhas na largura maior). */
export const KPI_MAX = 10;

export type CatalogMetric = {
  id: string;
  label: string;
  group: MetricGroup;
  /** O que é e como é calculada. */
  help: string;
  /** O investimento dá para recalcular a partir dela: some no link com investimento oculto. */
  spendDerived?: boolean;
  /** Como card: "default" já vem marcado; "optional" dá para ligar; sem valor, não vira card. */
  kpi?: "default" | "optional";
  /** Como coluna nas tabelas: true já vem marcada; "optional" dá para ligar; sem valor, não vira coluna. */
  column?: boolean | "optional";
};

export type SectionPrefs = { hidden: string[]; shown: string[] };
export type ScopePrefs = Partial<Record<MetricSection, SectionPrefs>>;
export type MetricPrefs = Partial<Record<MetricScope, ScopePrefs>>;

const EMPTY: SectionPrefs = { hidden: [], shown: [] };

/** Métrica nova: entra desligada nos cards e nas tabelas, sem mudar o padrão de ninguém. */
function extraCatalog(m: { id: string; label: string; group: MetricGroup; help: string; spendDerived?: boolean }): CatalogMetric {
  return { id: m.id, label: m.label, group: m.group, help: m.help, spendDerived: m.spendDerived, kpi: "optional", column: "optional" };
}

export const META_CATALOG: CatalogMetric[] = [
  { id: "spend", label: "Investimento", group: "gerais", help: "Quanto foi gasto em anúncios no período.", spendDerived: true, kpi: "default", column: true },
  { id: "revenue", label: "Receita", group: "conversoes", help: "Valor das compras atribuídas às campanhas no período.", kpi: "default", column: true },
  { id: "purchases", label: "Compras", group: "conversoes", help: "Resultados de compra atribuídos às campanhas.", kpi: "default", column: true },
  { id: "impressions", label: "Impressões", group: "gerais", help: "Quantas vezes os anúncios apareceram.", kpi: "optional" },
  {
    id: "reach",
    label: "Alcance médio por dia",
    group: "gerais",
    help: "Média do alcance diário das contas. Não é o total de pessoas únicas do período: a mesma pessoa pode ser contada em dias diferentes.",
    kpi: "optional",
  },
  { id: "clicks", label: "Cliques", group: "gerais", help: "Todos os cliques nos anúncios.", kpi: "optional" },
  { id: "linkClicks", label: "Cliques no link", group: "gerais", help: "Cliques que levam para fora do anúncio.", kpi: "optional", column: true },
  { id: "addToCart", label: "Adicionar ao carrinho", group: "conversoes", help: "Quantas vezes adicionaram produto ao carrinho. Um só evento da Meta, sem contar em dobro.", kpi: "optional", column: true },
  { id: "ticket", label: "Ticket médio", group: "conversoes", help: "Receita ÷ compras.", kpi: "default" },
  { id: "cpa", label: "Custo por compra", group: "custos", help: "Custo por resultado = investimento ÷ compras.", spendDerived: true, kpi: "default", column: true },
  { id: "cpm", label: "CPM", group: "custos", help: "Custo por mil impressões = investimento ÷ impressões × 1000.", spendDerived: true, kpi: "default", column: true },
  { id: "cpc", label: "CPC", group: "custos", help: "Custo por clique = investimento ÷ cliques.", spendDerived: true, kpi: "optional" },
  { id: "roas", label: "ROAS", group: "taxas", help: "Retorno sobre o investimento = receita ÷ investimento.", spendDerived: true, kpi: "default", column: true },
  { id: "linkCtr", label: "CTR do link", group: "taxas", help: "Cliques no link ÷ impressões do período inteiro.", kpi: "default", column: true },
  { id: "ctr", label: "CTR", group: "taxas", help: "Todos os cliques ÷ impressões do período inteiro.", kpi: "optional" },
  {
    id: "frequency",
    label: "Frequência média por dia",
    group: "taxas",
    help: "Impressões ÷ alcance, dia a dia. Quantas vezes, em média, cada pessoa viu o anúncio num dia; não é a frequência do período inteiro.",
    kpi: "default",
    column: true,
  },
  { id: "convRate", label: "Conversão do clique", group: "taxas", help: "Compras ÷ cliques no link.", column: true },
  ...META_EXTRA_METRICS.map(extraCatalog),
  ...RESULT_METRICS.map(extraCatalog),
];

export const GOOGLE_CATALOG: CatalogMetric[] = [
  { id: "spend", label: "Custo", group: "gerais", help: "Quanto foi gasto em anúncios no período.", spendDerived: true, kpi: "default", column: true },
  { id: "value", label: "Valor de conversão", group: "conversoes", help: "Valor das conversões atribuídas às campanhas.", kpi: "default", column: true },
  { id: "conversions", label: "Conversões", group: "conversoes", help: "O Google divide conversões entre cliques, por isso pode ter decimais.", kpi: "default", column: true },
  { id: "impressions", label: "Impressões", group: "gerais", help: "Quantas vezes os anúncios apareceram.", kpi: "optional", column: true },
  { id: "clicks", label: "Cliques", group: "gerais", help: "Cliques nos anúncios.", kpi: "optional", column: true },
  { id: "cpa", label: "CPA", group: "custos", help: "Custo por conversão = custo ÷ conversões.", spendDerived: true, kpi: "default", column: true },
  { id: "cpc", label: "CPC médio", group: "custos", help: "Custo por clique = custo ÷ cliques.", spendDerived: true, kpi: "default", column: true },
  { id: "cpm", label: "CPM", group: "custos", help: "Custo por mil impressões = custo ÷ impressões × 1000.", spendDerived: true, kpi: "optional" },
  { id: "roas", label: "ROAS", group: "taxas", help: "Retorno sobre o investimento = valor de conversão ÷ custo.", spendDerived: true, kpi: "default", column: true },
  { id: "ctr", label: "CTR", group: "taxas", help: "Cliques ÷ impressões do período inteiro.", kpi: "default", column: true },
  {
    id: "impressionShare",
    label: "Parcela de impressões",
    group: "taxas",
    help: "Só nas campanhas de pesquisa: impressões ÷ impressões possíveis, ponderado pelas impressões elegíveis.",
    kpi: "default",
    column: true,
  },
  ...GOOGLE_EXTRA_METRICS.map(extraCatalog),
];

/** Dashboard de planilha: só o que a planilha traz (investimento, impressões, cliques, conversões, receita) e as contas com isso. */
export const IMPORT_CATALOG: CatalogMetric[] = [
  { id: "spend", label: "Investimento", group: "gerais", help: "Quanto foi investido em anúncios no período, pela planilha.", spendDerived: true, kpi: "default", column: true },
  { id: "value", label: "Receita", group: "conversoes", help: "Receita das conversões informada na planilha.", kpi: "default", column: true },
  { id: "conversions", label: "Conversões", group: "conversoes", help: "Conversões informadas na planilha.", kpi: "default", column: true },
  { id: "impressions", label: "Impressões", group: "gerais", help: "Quantas vezes os anúncios apareceram.", kpi: "optional", column: true },
  { id: "clicks", label: "Cliques", group: "gerais", help: "Cliques nos anúncios.", kpi: "optional", column: true },
  { id: "cpa", label: "Custo por conversão", group: "custos", help: "Investimento ÷ conversões.", spendDerived: true, kpi: "default", column: true },
  { id: "cpc", label: "CPC médio", group: "custos", help: "Custo por clique = investimento ÷ cliques.", spendDerived: true, kpi: "default", column: true },
  { id: "cpm", label: "CPM", group: "custos", help: "Custo por mil impressões = investimento ÷ impressões × 1000.", spendDerived: true, kpi: "default" },
  { id: "roas", label: "ROAS", group: "taxas", help: "Retorno sobre o investimento = receita ÷ investimento.", spendDerived: true, kpi: "default", column: true },
  { id: "ctr", label: "CTR", group: "taxas", help: "Cliques ÷ impressões do período inteiro.", kpi: "default", column: true },
];

/** Grupo, explicação e relação com o investimento de cada métrica dos dashboards de exemplo. */
const SAMPLE_INFO: Record<MetricId, { group: MetricGroup; help: string; spendDerived?: boolean }> = {
  spend: { group: "gerais", help: "Quanto foi gasto em anúncios no período.", spendDerived: true },
  impressions: { group: "gerais", help: "Quantas vezes os anúncios apareceram." },
  clicks: { group: "gerais", help: "Cliques nos anúncios." },
  conversions: { group: "conversoes", help: "Resultados confirmados no período." },
  revenue: { group: "conversoes", help: "Valor gerado pelas conversões." },
  ticket: { group: "conversoes", help: "Receita ÷ conversões." },
  leads: { group: "conversoes", help: "Contatos recebidos." },
  qualified: { group: "conversoes", help: "Leads que passaram pela qualificação." },
  visits: { group: "conversoes", help: "Visitas agendadas." },
  calls: { group: "conversoes", help: "Ligações recebidas." },
  sessions: { group: "gerais", help: "Visitas ao site." },
  views: { group: "video", help: "Visualizações dos vídeos." },
  cpa: { group: "custos", help: "Custo por resultado = investimento ÷ conversões.", spendDerived: true },
  cpc: { group: "custos", help: "Custo por clique = investimento ÷ cliques.", spendDerived: true },
  cpm: { group: "custos", help: "Custo por mil impressões = investimento ÷ impressões × 1000.", spendDerived: true },
  cpl: { group: "custos", help: "Custo por lead = investimento ÷ leads.", spendDerived: true },
  cplq: { group: "custos", help: "Custo por lead qualificado = investimento ÷ leads qualificados.", spendDerived: true },
  cpv: { group: "custos", help: "Custo por visualização = investimento ÷ visualizações.", spendDerived: true },
  ctr: { group: "taxas", help: "Cliques ÷ impressões do período inteiro." },
  roas: { group: "taxas", help: "Retorno sobre o investimento = receita ÷ investimento.", spendDerived: true },
  convRate: { group: "taxas", help: "Conversões ÷ sessões." },
  viewRate: { group: "video", help: "Visualizações ÷ impressões." },
  frequency: { group: "taxas", help: "Quantas vezes, em média, cada pessoa viu o anúncio." },
};

export const isSampleMetric = (id: string): id is MetricId => id in SAMPLE_INFO;

/**
 * Métricas novas nas amostras: as da Meta nos modelos com Meta, e as do Google nos
 * que só têm Google. Só como card: as tabelas das amostras vêm do simulador do modelo.
 * Com outras plataformas de anúncios, a métrica vale só para a Meta e diz isso no nome.
 */
export function sampleExtraCatalog(sources: readonly PlatformId[]): CatalogMetric[] {
  const ads = sources.filter(isAdPlatform);
  const card = (m: { id: string; label: string; group: MetricGroup; help: string; spendDerived?: boolean }, onlyMeta: boolean): CatalogMetric => ({
    id: m.id,
    label: onlyMeta ? `${m.label} · Meta` : m.label,
    group: m.group,
    help: onlyMeta ? `${m.help} Só a parte da Meta neste dashboard.` : m.help,
    spendDerived: m.spendDerived,
    kpi: "optional",
  });
  if (ads.includes("meta")) {
    const onlyMeta = ads.length > 1;
    return [...META_EXTRA_METRICS, ADD_TO_CART_METRIC].filter((m) => !isSampleMetric(m.id)).map((m) => card(m, onlyMeta));
  }
  return ads.length === 1 && ads[0] === "google" ? GOOGLE_EXTRA_METRICS.filter((m) => !isSampleMetric(m.id)).map((m) => card(m, false)) : [];
}

/** Colunas das tabelas dos dashboards de exemplo. */
const SAMPLE_COLUMNS: MetricId[] = ["spend", "ctr", "conversions", "cpa", "roas", "revenue"];

/** Catálogo de um dashboard de exemplo: os cards padrão são os das páginas dele. */
export function sampleCatalog(profile: Profile, defaultKpis: readonly MetricId[], sources: readonly PlatformId[] = []): CatalogMetric[] {
  const base: CatalogMetric[] = (Object.keys(SAMPLE_INFO) as MetricId[]).map((id) => ({
    id,
    label: baseMetric(id, profile).label,
    ...SAMPLE_INFO[id],
    kpi: defaultKpis.includes(id) ? ("default" as const) : ("optional" as const),
    column: SAMPLE_COLUMNS.includes(id),
  }));
  return [...base, ...sampleExtraCatalog(sources)];
}

export const isSampleSpendDerived = (id: MetricId) => !!SAMPLE_INFO[id].spendDerived;

// ---- leitura ----------------------------------------------------------------------------------

const ids = (raw: unknown): string[] => (Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string" && v.length <= 40).slice(0, 60) : []);

/** O que vem do banco nunca derruba a página: formato estranho vira padrão. */
export function parseMetricPrefs(raw: unknown): MetricPrefs {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: MetricPrefs = {};
  for (const scope of ["meta", "google", "import", "sample"] as const) {
    const s = (raw as Record<string, unknown>)[scope];
    if (!s || typeof s !== "object") continue;
    const scoped: ScopePrefs = {};
    for (const section of ["kpis", "columns"] as const) {
      const v = (s as Record<string, unknown>)[section] as { hidden?: unknown; shown?: unknown } | undefined;
      if (v && typeof v === "object") scoped[section] = { hidden: ids(v.hidden), shown: ids(v.shown) };
    }
    out[scope] = scoped;
  }
  return out;
}

const inSection = (catalog: readonly CatalogMetric[], section: MetricSection) => catalog.filter((m) => (section === "kpis" ? !!m.kpi : !!m.column));
const isDefault = (m: CatalogMetric, section: MetricSection) => (section === "kpis" ? m.kpi === "default" : m.column === true);

/** Máximo da seção (cards padrão de um dashboard grande não ficam presos ao limite). */
export function sectionMax(catalog: readonly CatalogMetric[], section: MetricSection): number | null {
  if (section === "columns") return null;
  return Math.max(KPI_MAX, inSection(catalog, section).filter((m) => isDefault(m, section)).length);
}

/**
 * Ids visíveis numa seção, na ordem do catálogo. Com investimento oculto, as
 * derivadas nunca entram. Sempre sobra pelo menos um (mínimo por seção).
 */
export function visibleIds(catalog: readonly CatalogMetric[], section: MetricSection, prefs: SectionPrefs | undefined, opts: { hideSpend?: boolean } = {}): string[] {
  const p = prefs ?? EMPTY;
  const list = inSection(catalog, section).filter((m) => !(opts.hideSpend && m.spendDerived));
  const visible = list.filter((m) => (isDefault(m, section) ? !p.hidden.includes(m.id) : p.shown.includes(m.id))).map((m) => m.id);
  const max = sectionMax(catalog, section);
  if (visible.length) return max === null ? visible : visible.slice(0, max);
  const fallback = list.find((m) => isDefault(m, section)) ?? list[0];
  return fallback ? [fallback.id] : [];
}

/**
 * Nos dashboards de exemplo, cada aba tem os próprios cards. O padrão vale por
 * aba: o que é da aba vem ligado, o resto é opcional. Oculto some de todas as
 * abas; adicionado aparece em todas as que têm fileira de cards.
 */
export function pageCatalog(catalog: readonly CatalogMetric[], pageKpis: readonly string[]): CatalogMetric[] {
  return catalog.map((m) => (m.kpi ? { ...m, kpi: pageKpis.includes(m.id) ? ("default" as const) : ("optional" as const) } : m));
}

/**
 * Cards de uma aba: é daqui que saem a tela, o PDF, o link e o contador do
 * painel. Aba sem fileira de cards continua sem, e a reserva do mínimo nunca
 * traz para a aba um card que não é dela.
 */
export function pageKpiIds(catalog: readonly CatalogMetric[], pageKpis: readonly string[], prefs: SectionPrefs | undefined, opts: { hideSpend?: boolean } = {}): string[] {
  if (!pageKpis.length) return [];
  return visibleIds(pageCatalog(catalog, pageKpis), "kpis", prefs, opts).filter((id) => pageKpis.includes(id) || prefs?.shown.includes(id));
}

export type ToggleBlock = "min" | "max" | null;

/** Pode mudar? "min": é a última visível. "max": a seção chegou ao limite. */
export function toggleBlock(catalog: readonly CatalogMetric[], section: MetricSection, prefs: SectionPrefs | undefined, id: string): ToggleBlock {
  const visible = visibleIds(catalog, section, prefs);
  if (visible.includes(id)) return visible.length <= 1 ? "min" : null;
  const max = sectionMax(catalog, section);
  return max !== null && visible.length >= max ? "max" : null;
}

/** Liga ou desliga uma métrica. Mudança proibida (mínimo, máximo, métrica fora da seção) não altera nada. */
export function toggleMetric(catalog: readonly CatalogMetric[], section: MetricSection, prefs: SectionPrefs | undefined, id: string): SectionPrefs {
  const p = prefs ?? EMPTY;
  const m = inSection(catalog, section).find((x) => x.id === id);
  if (!m || toggleBlock(catalog, section, p, id)) return p;
  const on = visibleIds(catalog, section, p).includes(id);
  const without = (l: string[]) => l.filter((v) => v !== id);
  if (isDefault(m, section)) return { hidden: on ? [...without(p.hidden), id] : without(p.hidden), shown: without(p.shown) };
  return { hidden: without(p.hidden), shown: on ? without(p.shown) : [...without(p.shown), id] };
}

/** Só o que difere do padrão e existe no catálogo, respeitando mínimo e máximo. É o que vai para o banco. */
export function normalizeSection(catalog: readonly CatalogMetric[], section: MetricSection, prefs: SectionPrefs | undefined): SectionPrefs {
  const p = prefs ?? EMPTY;
  const list = inSection(catalog, section);
  let out: SectionPrefs = {
    hidden: list.filter((m) => isDefault(m, section) && p.hidden.includes(m.id)).map((m) => m.id),
    shown: list.filter((m) => !isDefault(m, section) && p.shown.includes(m.id)).map((m) => m.id),
  };
  if (out.hidden.length === list.filter((m) => isDefault(m, section)).length && out.shown.length === 0) out = { hidden: out.hidden.slice(1), shown: [] };
  const max = sectionMax(catalog, section);
  while (max !== null && visibleIds(catalog, section, out).length > max && out.shown.length) out = { ...out, shown: out.shown.slice(0, -1) };
  return out;
}

/** Exemplo: o oculto precisa ser de alguma aba; o adicionado, faltar em alguma aba com cards. */
function normalizePageKpis(catalog: readonly CatalogMetric[], pageKpis: readonly (readonly string[])[], prefs: SectionPrefs | undefined): SectionPrefs {
  const p = prefs ?? EMPTY;
  const rows = pageKpis.filter((r) => r.length);
  const list = inSection(catalog, "kpis");
  return {
    hidden: list.filter((m) => p.hidden.includes(m.id) && rows.some((r) => r.includes(m.id))).map((m) => m.id),
    shown: list
      .filter((m) => p.shown.includes(m.id) && !p.hidden.includes(m.id) && rows.some((r) => !r.includes(m.id)))
      .map((m) => m.id)
      .slice(0, KPI_MAX),
  };
}

/** `pageKpis`: os cards de cada aba, nos dashboards de exemplo. */
export function normalizeScope(catalog: readonly CatalogMetric[], prefs: ScopePrefs | undefined, pageKpis?: readonly (readonly string[])[]): ScopePrefs {
  const out: ScopePrefs = {};
  for (const section of ["kpis", "columns"] as const) {
    const n = section === "kpis" && pageKpis ? normalizePageKpis(catalog, pageKpis, prefs?.kpis) : normalizeSection(catalog, section, prefs?.[section]);
    if (n.hidden.length || n.shown.length) out[section] = n;
  }
  return out;
}

/** Troca as escolhas de uma plataforma sem mexer nas outras abas. Vazio = volta ao padrão. */
export function withScope(all: MetricPrefs, scope: MetricScope, value: ScopePrefs): MetricPrefs {
  const next: MetricPrefs = { ...all };
  if (value.kpis || value.columns) next[scope] = value;
  else delete next[scope];
  return next;
}

/** Oculta um card pelo atalho. Devolve as escolhas novas, ou null se ele é o último visível. */
export function hideKpi(catalog: readonly CatalogMetric[], scope: MetricScope, prefs: MetricPrefs, id: string, pageKpis?: readonly (readonly string[])[]): MetricPrefs | null {
  const current = prefs[scope];
  if (!visibleIds(catalog, "kpis", current?.kpis).includes(id) || toggleBlock(catalog, "kpis", current?.kpis, id)) return null;
  return withScope(prefs, scope, normalizeScope(catalog, { ...current, kpis: toggleMetric(catalog, "kpis", current?.kpis, id) }, pageKpis));
}

// ---- tabelas ------------------------------------------------------------------------------------

/**
 * Colunas que ficam numa tabela. As sem métrica (nome, status) não mudam. Se a
 * tabela ficaria sem nenhuma métrica, mantém a primeira que pode aparecer.
 */
export function pickColumns<T extends { metric?: string }>(columns: readonly T[], visible: ReadonlySet<string>, blocked: (id: string) => boolean): T[] {
  const kept = columns.filter((c) => !c.metric || visible.has(c.metric));
  if (kept.some((c) => c.metric)) return kept;
  const first = columns.find((c) => c.metric && !blocked(c.metric));
  return first ? columns.filter((c) => !c.metric || c === first) : kept;
}
