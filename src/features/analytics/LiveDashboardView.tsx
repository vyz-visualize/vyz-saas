"use client";

// Miolo dos dashboards com dados reais: cabeçalho, abas e a página ativa. Os
// dados já chegam prontos (servidor ou prévia); trocar de aba não consulta nada.

import Link from "next/link";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/kit";
import { OverflowTabs } from "@/components/ui/OverflowTabs";
import { btn } from "@/components/ui/styles";
import { PLATFORMS } from "@/features/accounts/platforms";
import { GOOGLE_CATALOG, IMPORT_CATALOG, META_CATALOG, type CatalogMetric } from "@/features/dashboards/metric-prefs";
import { MetricVisibilityProvider, useMetricPrefsState, type SaveMetricPrefs } from "@/features/dashboards/metric-prefs-context";
import { MetricEditProvider } from "@/features/dashboards/metric-edit-context";
import { MetricNoticeBar } from "@/features/dashboards/MetricActions";
import { CustomizeButton, MetricEditBar, MetricTray, useMetricEditorState } from "@/features/dashboards/MetricEditor";
import { PAGES } from "@/features/templates/pages";
import type { PageId } from "@/features/templates/types";
import { GoogleCampaigns, GoogleOverview, GoogleProducts, GoogleTerms } from "./google/GooglePages";
import { MetaCreatives } from "./creatives/CreativesPage";
import { FilterBar, FilterProvider, useFilterState } from "./filter-context";
import { hasFilters, NO_FILTERS, rangeLabel } from "./filters";
import { setQueryParam } from "./creatives/query";
import { MetaAudience, MetaCampaigns, MetaFunnel, MetaOverview } from "./meta/MetaPages";
import { formatValue } from "./format";
import { ddmm, ddmmyyyyIso } from "./ranges";
import type { PageProps } from "./shared";
import { RESULT_METRICS, RESULTS_MIXED_REASON } from "./live-metrics";
import { ImportCampaigns, ImportOverview } from "./import/ImportPages";
import type { DashboardView, LiveDashboardData, LivePlatform } from "./types";

/** Páginas que cada dashboard live sabe desenhar, na ordem padrão. */
export const LIVE_PAGES: Record<LivePlatform, Partial<Record<PageId, ComponentType<PageProps>>>> = {
  meta: { "visao-geral": MetaOverview, campanhas: MetaCampaigns, funil: MetaFunnel, criativos: MetaCreatives, publico: MetaAudience },
  google: { "visao-geral": GoogleOverview, campanhas: GoogleCampaigns, termos: GoogleTerms, produtos: GoogleProducts },
  import: { "visao-geral": ImportOverview, campanhas: ImportCampaigns },
};

/** Nome que a tela mostra para a origem dos dados do dashboard. */
export const livePlatformName = (platform: LivePlatform) => (platform === "import" ? "Planilha" : PLATFORMS[platform].name);

/** As páginas pedidas que existem na plataforma (na ordem pedida); vazio = todas. */
export function livePages(platform: LivePlatform, pageIds?: readonly PageId[]): PageId[] {
  const known = Object.keys(LIVE_PAGES[platform]) as PageId[];
  const asked = (pageIds ?? []).filter((p, i, all) => known.includes(p) && all.indexOf(p) === i);
  return asked.length ? asked : known;
}

export type LiveDashboardViewProps = {
  data: LiveDashboardData;
  pageIds?: readonly PageId[];
  initialPage?: PageId;
  /** Botões no topo (editar, compartilhar, exportar). */
  actions?: ReactNode;
  /** Controles abaixo das abas (seletor de período). */
  toolbar?: ReactNode;
  /** Logo à esquerda do título (no link compartilhado, a marca já está no topo da página). */
  logo?: ReactNode;
  /** Métricas escolhidas neste dashboard (dashboards.metric_prefs). */
  metricPrefs?: unknown;
  /** Mostra o botão "Personalizar" (member+ no painel; nunca no link). */
  canCustomize?: boolean;
  saveMetrics?: SaveMetricPrefs;
  /** Dashboard interativo: troca os filtros na URL. Sem isso (prévias), nada é clicável. */
  filterNavigate?: (search: string) => void;
};

const CATALOG: Record<LivePlatform, readonly CatalogMetric[]> = { meta: META_CATALOG, google: GOOGLE_CATALOG, import: IMPORT_CATALOG };

/** A conta tem esse número no período? Sem dado, o painel desabilita a métrica. */
function liveHasData(view: DashboardView, id: string): boolean {
  const kpi = [...view.kpis, ...(view.extraKpis ?? [])].find((k) => k.id === id);
  if (kpi) return kpi.value != null && kpi.value !== 0;
  if (id === "addToCart" && view.platform === "meta") return view.funnelByStage.some((s) => s.addToCart > 0);
  if (id === "convRate" && view.platform === "meta") return view.funnelByStage.some((s) => s.convRate != null);
  return true;
}

/** "2026-10-30T13:05:00Z" → "30/10 às 10:05" no fuso dado (mesmo texto no servidor e no navegador). */
function syncedAt(iso: string, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("day")}/${get("month")} às ${get("hour")}:${get("minute")}`;
  } catch {
    return "";
  }
}

const RESULT_IDS = new Set(RESULT_METRICS.map((m) => m.id));
const RESULT_METRIC_ROWS = META_CATALOG.filter((m) => RESULT_IDS.has(m.id));

/** A única aba com fileira de cards nos dashboards com dados reais. */
const KPI_PAGE: PageId = "visao-geral";

export function LiveDashboardView({ data, pageIds, initialPage, actions, toolbar, logo, metricPrefs, canCustomize = false, saveMetrics, filterNavigate }: LiveDashboardViewProps) {
  // tipos de resultado diferentes no período: o card sai da conta (e do contador), mas a escolha salva fica
  const resultsMixed = data.view.platform === "meta" && !!data.view.resultsMixed;
  const liveCatalog = useMemo(() => (resultsMixed ? CATALOG[data.platform].map((m) => (RESULT_IDS.has(m.id) ? { ...m, kpi: undefined } : m)) : CATALOG[data.platform]), [data.platform, resultsMixed]);
  const metrics = useMetricPrefsState({ dashboardId: data.dashboard.id, scope: data.platform, catalog: liveCatalog, normalizeCatalog: CATALOG[data.platform], initial: metricPrefs, hideSpend: data.hideSpend, saveAction: saveMetrics });
  const pages = livePages(data.platform, pageIds);
  const [page, setPage] = useState<PageId>(initialPage && pages.includes(initialPage) ? initialPage : pages[0]);
  const active = pages.includes(page) ? page : pages[0];
  const Page = LIVE_PAGES[data.platform][active]!;
  const last = data.accounts
    .map((a) => a.lastSyncedAt)
    .filter((v): v is string => !!v)
    .sort()
    .at(0);
  const panelId = `painel-${data.dashboard.id}`;
  const allKpis = useMemo(() => new Map([...data.view.kpis, ...(data.view.extraKpis ?? [])].map((k) => [k.id, k])), [data.view]);
  const edit = useMetricEditorState({
    metrics,
    visibleKpis: [...metrics.visibility.kpis],
    hasData: (id) => liveHasData(data.view, id),
    valueOf: (id) => {
      const k = allKpis.get(id);
      return k ? { text: formatValue(k.value, k.format, data.currency), spark: k.spark } : null;
    },
    unavailable: resultsMixed ? RESULT_METRIC_ROWS.map((m) => ({ metric: m, reason: RESULTS_MIXED_REASON })) : undefined,
    kpiPlace: active === KPI_PAGE ? undefined : `na ${PAGES[KPI_PAGE]?.name ?? "Visão geral"}`,
    noKpis: !pages.includes(KPI_PAGE) || active !== KPI_PAGE,
    goToCards: pages.includes(KPI_PAGE) && active !== KPI_PAGE ? () => setPage(KPI_PAGE) : undefined,
  });
  const editing = metrics.open;
  const info = data.view.filterInfo;
  const filterState = useFilterState({ initial: info?.filters ?? NO_FILTERS, labels: info?.labels, periodDays: data.current.days, navigate: filterNavigate, suspended: editing });
  const filters = filterNavigate ? filterState : null;
  const shownDays = info?.filters.days;

  return (
    <MetricEditProvider value={edit.editor}>
    <FilterProvider value={filters}>
    <div data-metric-editing={editing ? edit.section : undefined} className={`@container space-y-4 ${editing ? "pb-[62dvh] md:pb-[320px]" : ""}`}>
      {canCustomize && <MetricEditBar state={edit} />}
      <header className="flex items-start justify-between gap-4 overflow-x-clip [overflow-clip-margin:4px]">
        {logo && <div className="hidden shrink-0 pt-1.5 @[500px]:block @[900px]:pt-0.5">{logo}</div>}
        {/* no largo, título, cliente e etiquetas dividem uma linha: sobra altura para os números */}
        <div className="min-w-0 flex-1 @[900px]:flex @[900px]:flex-wrap @[900px]:items-center @[900px]:gap-x-3 @[900px]:gap-y-1">
          <h1 className="title truncate text-[1.55rem] @[900px]:text-[1.3rem]">{data.dashboard.name}</h1>
          {data.dashboard.clientName && <p className="text-[14px] text-fg-2">{data.dashboard.clientName}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] @[900px]:mt-0">
            <span className="rounded-chip border border-line px-2 py-0.5 text-fg-2">{livePlatformName(data.platform)}</span>
            {data.accounts.map((a) => (
              <span key={a.id} className="max-w-[16rem] truncate rounded-chip border border-line px-2 py-0.5 text-fg-2" title={a.name}>
                {a.name}
              </span>
            ))}
            {data.sample && <span className="rounded-chip bg-accent-soft px-2 py-0.5 font-medium text-fg">Amostra · dados simulados</span>}
            {data.hideSpend && <span className="rounded-chip border border-dashed border-line px-2 py-0.5 text-fg-2">Investimento oculto</span>}
          </div>
        </div>
        {actions}
      </header>

      {/* abas e período na mesma linha quando cabe */}
      <div className="flex flex-col gap-4 @[1000px]:flex-row @[1000px]:items-end @[1000px]:gap-3">
      <div className="min-w-0 @[1000px]:flex-1">
      <OverflowTabs
        label="Páginas do dashboard"
        value={active}
        onChange={(p) => {
          setPage(p);
          setQueryParam("pagina", p);
        }}
        items={pages.map((p) => ({ value: p, label: PAGES[p]?.name ?? p }))}
      />
      </div>

      {(toolbar || canCustomize) && (
        <div className="flex flex-wrap items-end gap-2 @[1000px]:shrink-0">
          {/* trocar o período recarrega o dashboard: no modo personalizar perderia o rascunho */}
          <div inert={editing || undefined} className={`contents ${editing ? "[&>*]:opacity-50" : ""}`}>
            {toolbar}
          </div>
          {canCustomize && !editing && (
            <div className="ml-auto">
              <CustomizeButton onClick={() => metrics.openPanel()} />
            </div>
          )}
        </div>
      )}
      </div>

      <FilterBar />

      <p className="flex flex-wrap gap-x-2 text-[12.5px] text-fg-2">
        <span className="tnum">
          {shownDays && info?.compared
            ? `Trecho ${rangeLabel(shownDays)}, dentro de ${ddmm(data.current.from)} a ${ddmmyyyyIso(data.current.to)}, comparado com ${rangeLabel(info.compared)}`
            : `${ddmm(data.current.from)} a ${ddmmyyyyIso(data.current.to)} · ${data.current.days} ${data.current.days === 1 ? "dia" : "dias"}, comparado com ${ddmm(data.previous.from)} a ${ddmm(data.previous.to)}`}
        </span>
        {data.maturingFrom && <span>· a partir de {ddmm(data.maturingFrom)} as conversões ainda estão chegando (em maturação)</span>}
        {last && !data.sample && <span>· atualizado em {syncedAt(last, data.timeZone)}</span>}
      </p>

      <div role="tabpanel" id={panelId} data-dim-wrap aria-label={PAGES[active]?.name ?? active}>
        {data.status === "no_accounts" ? (
          <EmptyState
            title="Nenhuma conta ativa neste dashboard"
            text={data.platform === "import" ? "Importe uma planilha em Contas e ligue a conta ao dashboard para ver os números." : `Ative uma conta do ${PLATFORMS[data.platform].name} e ligue ao dashboard para ver os números.`}
            action={
              <Link href="/painel/contas" className={btn.small}>
                Ir para Contas
              </Link>
            }
          />
        ) : data.status === "no_data" && filters && hasFilters(filters.filters) ? (
          <EmptyState
            title="Nada com esses filtros"
            text="Esse recorte não teve veiculação no período. Tire um dos filtros para ver os números."
            action={
              <button type="button" onClick={filters.clear} className={btn.small}>
                Limpar filtros
              </button>
            }
          />
        ) : data.status === "no_data" ? (
          <EmptyState title="Os dados ainda estão chegando" text="A primeira importação leva alguns instantes. Se a conta não teve veiculação neste período, escolha um período maior." />
        ) : (
          <MetricVisibilityProvider value={metrics.visibility}>
            <Page data={data} />
          </MetricVisibilityProvider>
        )}
      </div>
      {canCustomize && <MetricTray state={edit} />}
      {canCustomize && <MetricNoticeBar notice={metrics.notice} onUndo={metrics.undo} onDismiss={metrics.dismiss} />}
    </div>
    </FilterProvider>
    </MetricEditProvider>
  );
}

/** Erro amigável (o detalhe fica no log do servidor). */
export function LiveDashboardError({ message }: { message: string }) {
  return <EmptyState title="Não foi possível abrir o dashboard" text={message} />;
}
