"use client";

import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { PresenterBar, presentingClass, usePresentation } from "./present";
import { Wordmark } from "@/components/brand/Wordmark";
import { PendingChip } from "@/components/ui/kit";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { rangeDays, type Range } from "@/components/ui/PeriodPicker";
import { Notices, notify } from "@/components/ui/Toast";
import { Tooltip } from "@/components/ui/Tooltip";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { CreativeList } from "@/features/analytics/creatives/CreativeList";
import { CreativesPage } from "@/features/analytics/creatives/CreativesPage";
import { setQueryParam } from "@/features/analytics/creatives/query";
import { chipsOf, filterAria, filterTone, FilterBar, FilterProvider, useFilterState } from "@/features/analytics/filter-context";
import { filterSummary, NO_FILTERS, type DashFilters } from "@/features/analytics/filters";
import type { CreativesData, SampleExtraMetric } from "@/features/analytics/types";
import { formatValue as formatLive } from "@/features/analytics/format";
import { currentTotals, platformPart, series, totals } from "@/features/metrics/compute";
import { filterDataset } from "@/features/metrics/filter-dataset";
import type { Dataset } from "@/features/metrics/source";
import { DEFAULT_TIME_ZONE, localDate } from "@/features/sync/dates";
import { formatValue as formatMetricValue, metric as metricDefinition } from "@/features/metrics/definitions";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { PAGES } from "@/features/templates/pages";
import type { MetricId } from "@/features/metrics/definitions";
import type { PageId, PageLayout } from "@/features/templates/types";
import { DashboardNav } from "./DashboardNav";
import { PageIcon } from "./PageIcon";
import { ATTRIBUTIONS, periodDays, PERIODS, type DashboardSettings, type PeriodId } from "@/features/workspace/types";
import type { Brand } from "@/features/workspace/workspace";
import { ddmmyyyy } from "@/lib/format";
import { brandVars } from "./brand";
import { datasetFor, pageLayout, sampleDefaultKpis } from "./data";
import { ChannelsPage, CrmPage, FitFrame, OrganicSourcePage, SitePage, type SourceExtras } from "./SourcePages";
import { PAGE_PLATFORM } from "@/features/templates/dashboards/composed";
import { dashboardRanges } from "@/features/analytics/ranges";
import { sampleOrganic } from "@/features/analytics/preview";
import { generateAnalyticsData } from "@/features/sync/mock/analytics";
import { generateCrmData } from "@/features/sync/mock/crm";
import { diffDays } from "@/features/sync/dates";

import { isSampleMetric, pageCatalog, pageKpiIds, sampleCatalog, type MetricPrefs } from "./metric-prefs";
import { useMetricPrefsState, type SaveCreativeCards, type SaveMetricPrefs } from "./metric-prefs-context";
import { cardIds, fromDataset, fromGallery } from "@/features/analytics/creatives/card-metrics";
import { CardPrefsProvider, type CardPrefs } from "@/features/analytics/creatives/CardMetrics";
import { MetricNoticeBar } from "./MetricActions";
import { MetricEditProvider } from "./metric-edit-context";
import { CustomizeButton, EDITING_PAD, EDITING_PAD_COLLAPSED, MetricTray, useMetricEditorState, type EditorBlocks } from "./MetricEditor";
import { pageRules } from "./layout/page-rules";
import { CUSTOM_BLOCKS_MAX, customSize, isCustomId } from "./layout/custom-blocks";
import type { AskHost } from "./ask/AskBar";
import type { AskLayoutAction } from "./ask/ai-plan";
import { formatRank, rankRows } from "@/features/metrics/rank";
import { GridPage, gridBlockLabel, templateBlocksOf } from "./layout/GridPage";
import { platformCardCount, PlatformTray } from "./layout/LayoutEditor";
import { KPIS_ID, kindOf, METRIC_CARDS_MAX, readingOrder, type DashboardLayout } from "./layout/model";
import { useDashboardLayout, type SaveLayout } from "./layout/useDashboardLayout";
import { SkinView } from "./skins";
import { hasCoverSkin, isFramedSkin, isSkinPage, skinTabs } from "./skins/blocks";
import type { MonthReport } from "./skins/shared";
import type { MmmReadinessData } from "@/features/mmm/readiness";
import { resultNotice } from "@/features/metrics/result-notice";
import { closedMonth, coversRange, isClosedMonth, rowsIn } from "@/features/analytics/closed-month";
import { withLaunchSheet } from "@/features/metrics/launch-dataset";
import { useDashboardCover, type CoverHost } from "./useDashboardCover";
import { PageView } from "./widgets/PageView";
import { makeContext } from "./widgets/Widgets";
import type { MetricGoal } from "./goals";
import { useWatchPage } from "@/features/share/page-watch";

export type DashboardSpec = { templateId: string; name: string; client: string; pages: PageId[]; settings: DashboardSettings; brand?: Brand; metricPrefs?: MetricPrefs; layout?: DashboardLayout; metricGoals?: readonly MetricGoal[]; /** Capa salva (visuais com capa): imagem e endereço. */ cover?: unknown };

/** Variáveis de cor da marca própria (Personalizado), iguais nos dois modos. */
export function brandStyle(brand?: Brand): CSSProperties | undefined {
  return brandVars(brand?.color);
}

export function BrandMark({ brand }: { brand?: Brand }) {
  if (brand?.logo) {
    // eslint-disable-next-line @next/next/no-img-element -- logo do workspace (Storage público), tamanho livre
    return <img src={brand.logo} alt="Logo" className="h-8 w-auto max-w-[160px] object-contain" />;
  }
  if (brand?.hideVyz) return null;
  return <Wordmark className="w-14 text-accent" />;
}

type BodyProps = {
  spec: DashboardSpec;
  hideSpend?: boolean;
  /** Montagem com scanner (logo depois de gerar). */
  assemble?: boolean;
  /** Ações no topo (painel); vazio no link público. */
  actions?: ReactNode;
  /** Renderiza todas as páginas para impressão. */
  printing?: boolean;
  /** Dashboard salvo que pode ser personalizado (member+ no painel). */
  customizeId?: string;
  saveMetrics?: SaveMetricPrefs;
  /** Grava as métricas dos cards de criativo (visuais próprios). */
  saveCards?: SaveCreativeCards;
  /** Grava a disposição de uma aba (member+). */
  saveLayout?: (dashboardId: string, page: PageId, items: unknown) => ReturnType<SaveLayout>;
  /** "Pedir ao Vyz" com IA (askLayout). Sem isso, o editor lê o pedido sozinho. */
  askLayout?: AskLayoutAction;
  /** Mover e redimensionar blocos (Avançado). Nos outros planos, só métricas entram e saem. */
  canArrange?: boolean;
  /** Modelos que usam a Meta: a página de Criativos por plano, no lugar do widget. */
  creatives?: CreativesData;
  initialPage?: PageId;
  /** Métricas novas do Personalizar, na escala do modelo. */
  extraMetrics?: readonly SampleExtraMetric[];
  /** A página de Criativos vem do servidor: trocar o período precisa navegar. */
  onPeriodChange?: (period: PeriodId, customDays: number, days?: { from: string; to: string }) => void;
  /** Dados reais das contas ligadas (já no período da URL). Sem isso, a amostra do modelo. */
  dataset?: Dataset;
  /** GA4 e orgânico reais (modelos novos). Sem isso, a amostra. */
  sourceExtras?: SourceExtras;
  /** Plataformas com conta ligada (modelos novos): os selos do topo mostram só elas. */
  linkedPlatforms?: PlatformId[];
  /** Selo de sincronização ("atualizado em" / "Atualizando…"), ao lado de "Dados reais". */
  syncStamp?: ReactNode;
  /** Horas desde a última sincronização (dados reais): o Pulso avisa quando atrasa. */
  syncHours?: number;
  /** O que falta para o MMM de cada cliente (dados reais). Sem isso, com dados reais, a aba diz que não deu para ler. */
  mmmReadiness?: MmmReadinessData | null;
  /** Hora da última sincronização (ISO) e o fuso da conta: "atualizado às HH:MM" nos visuais. */
  syncedAt?: string;
  timeZone?: string;
  /** Filtros que vieram na URL. */
  initialFilters?: DashFilters;
  /** Galeria e métricas novas vêm do servidor: filtrar precisa navegar. Sem isso, só troca o endereço. */
  onFilterNavigate?: (search: string) => void;
  /** No painel: para onde o voltar leva. Com ele, o modelo com visual próprio toma a tela toda (de ponta a ponta) e traz o voltar no topo dele. */
  backHref?: string;
  /** Visuais com capa: como gravar a imagem, o endereço e a planilha do lançamento. Sem isso, as mudanças valem só nesta aba. */
  coverHost?: CoverHost;
};

/** O nome do resultado do objetivo ("Vendas confirmadas", "Leads"), para os cards de criativo da amostra. */
const formatResultLabel = (profile: Parameters<typeof metricDefinition>[1]) => metricDefinition("conversions", profile).label;

/** Abas que as fontes desenham (GA4, CRM, orgânico, recursos do Avançado): não usam a grade. */
const SOURCE_TABS: ReadonlySet<PageId> = new Set(["site", "canais-site", "crm", "instagram", "pagina-facebook", "conteudo", "criativos-ao-vivo", "previsao", "mmm"]);

/** Os cards de uma aba do exemplo: os dela que seguem visíveis e, depois, os adicionados. */
export function sampleLayout(layout: PageLayout, visible: readonly string[]): PageLayout {
  const kept = layout.kpis.filter((k) => visible.includes(k.metric));
  const extras = (visible as MetricId[]).filter((m) => !layout.kpis.some((k) => k.metric === m)).map((metric) => ({ metric, sub: "delta" as const }));
  return { ...layout, kpis: [...kept, ...extras] };
}

/** Cabeçalho, abas, período e a página ativa. Mesmo miolo no painel e no link público. */
export function DashboardBody({ dataset, sourceExtras: realExtras, linkedPlatforms, syncStamp, syncHours, syncedAt, timeZone, mmmReadiness, spec, hideSpend, assemble, actions, printing, customizeId, saveMetrics, saveCards, saveLayout, askLayout, canArrange: arrangePlan = false, creatives, extraMetrics = [], initialPage, onPeriodChange, initialFilters = NO_FILTERS, onFilterNavigate, backHref, coverHost }: BodyProps) {
  const t = dashboardTemplate(spec.templateId);
  // as abas na tela: as do dashboard e as que o visual desenha (Pulso: Ações de hoje)
  const [page, setPage] = useState<PageId>(() => {
    const possible = skinTabs(t?.skin, spec.pages);
    return initialPage && possible.includes(initialPage) ? initialPage : (possible[0] ?? "visao-geral");
  });
  useWatchPage(page);
  const [period, setPeriod] = useState<PeriodId>(spec.settings.period);
  const [customDays, setCustomDays] = useState(spec.settings.customDays || 14);
  const [range, setRange] = useState<Range | null>(null);
  const [compare, setCompare] = useState(true);

  const days = periodDays({ period, customDays });
  const today = useMemo(() => localDate(new Date(), DEFAULT_TIME_ZONE), []);
  // capa (imagem, endereço) e planilha do lançamento: só os visuais com capa usam
  const capa = useDashboardCover({ initial: spec.cover, editable: !!customizeId, host: coverHost, today });
  // com a planilha ligada, o funil de vendas dela entra por cima dos números das plataformas (nos
  // visuais com capa; nos outros, a planilha ligada pela tela do MMM só conta como resultado do modelo)
  const coverSkin = hasCoverSkin(t?.skin);
  const ds = useMemo(() => {
    const base = dataset ?? datasetFor({ ...spec, settings: spec.settings }, days);
    return capa.launch && coverSkin ? withLaunchSheet(base, capa.launch.rows, { today, missing: capa.launch.missing }) : base;
  }, [dataset, spec, days, capa.launch, today, coverSkin]);
  // as abas na tela: as do dashboard e as que o visual desenha (Pulso: Ações de hoje; Noturno: Produtos, com catálogo)
  const tabs = useMemo(() => skinTabs(t?.skin, spec.pages, ds), [t?.skin, spec.pages, ds]);
  const defaults = useMemo(() => (t ? sampleDefaultKpis(t, spec.pages) : []), [t, spec.pages]);
  const catalog = useMemo(() => sampleCatalog(t?.profile ?? "ecommerce", defaults, t?.sources), [t, defaults]);
  const extraById = useMemo(() => new Map(extraMetrics.map((m) => [m.id, m])), [extraMetrics]);
  const pageKpis = useMemo(() => (t ? spec.pages.map((p) => pageLayout(t, p).kpis.map((k) => k.metric as string)) : []), [t, spec.pages]);
  const active = tabs.includes(page) ? page : tabs[0];
  const activeKpis = pageKpis[spec.pages.indexOf(active)];
  // o painel conta os cards da aba aberta: os mesmos que a tela mostra
  const activeCatalog = useMemo(() => pageCatalog(catalog, activeKpis ?? []), [catalog, activeKpis]);
  // disposição das abas: vai junto com as métricas no Personalizar
  const templateOf = useCallback((p: PageId): PageLayout => (t ? pageLayout(t, p) : { kpis: [], widgets: [] }), [t]);
  // cada aba diz que blocos aceita: os do template ou, na aba com visual próprio, os do visual
  const rulesOf = useCallback((p: PageId) => (t ? pageRules(t, p, hideSpend) : null), [hideSpend, t]);
  const accept = useCallback((p: PageId) => rulesOf(p)?.accept ?? (() => false), [rulesOf]);
  const baseOf = useCallback((p: PageId) => rulesOf(p)?.base() ?? [], [rulesOf]);
  const grid = useDashboardLayout({
    initial: spec.layout,
    pages: spec.pages,
    templateOf,
    accept,
    baseOf,
    save: customizeId && saveLayout ? (p, items) => saveLayout(customizeId, p, items) : undefined,
    arrange: arrangePlan,
  });
  const canArrange = !!customizeId && !!saveLayout;
  const metrics = useMetricPrefsState({ dashboardId: customizeId ?? null, scope: "sample", catalog: activeCatalog, pageKpis, initial: spec.metricPrefs, hideSpend, saveAction: saveMetrics, saveCards, companion: canArrange ? grid.companion : undefined });
  const pagesWithCards = spec.pages.filter((p, i) => (pageKpis[i] ?? []).length > 0);
  const known = (id: string) => isSampleMetric(id) || extraById.has(id);
  const activeIds = pageKpiIds(catalog, activeKpis ?? [], metrics.prefs?.kpis, { hideSpend }).filter(known);
  // aba Criativos com outras plataformas: os cards mostram a parte da Meta, a mesma dos anúncios
  const metaPart = !!creatives && active === "criativos" && ds.adPlatforms.length > 1 && ds.adPlatforms.includes("meta");
  // "Pedir ao Vyz": só nas abas desenhadas pela grade (fora a capa do visual, as páginas das fontes e a galeria de criativos)
  const gridTab = !!t && !(t.skin && (active === t.pages[0] || isSkinPage(t.skin, active))) && !(t.composed && SOURCE_TABS.has(active)) && !(active === "criativos" && creatives);
  const askHost: AskHost | undefined =
    canArrange && t && gridTab && metrics.open
      ? {
          pageName: PAGES[active].name,
          where: arrangePlan ? "logo abaixo dos cards" : "no primeiro espaço livre",
          context: { profile: t.profile, accepts: (id) => grid.accepts(active, id), hasProducts: ds.products.length > 0, kpiIds: activeCatalog.filter((m) => !!m.kpi).map((m) => m.id), visibleKpis: activeIds },
          preview: (b) => {
            if (b.type !== "rank") return null;
            const rows = rankRows(ds, b.entity, b.metric, { dir: b.dir, platform: b.platform, profile: t.profile });
            return rows ? rows.slice(0, 3).map((r) => ({ label: r.label, value: formatRank(r.value, b.metric, t.profile) })) : null;
          },
          apply: (blocks) => grid.insert(active, blocks.map((b) => ({ id: b.id, title: b.title, ...customSize(b.spec) }))),
          ai: askLayout
            ? async (text) => {
                const res = await askLayout({
                  text,
                  profile: t.profile,
                  pageName: PAGES[active].name,
                  sources: t.sources,
                  hideSpend: !!hideSpend,
                  hasProducts: ds.products.length > 0,
                  existing: grid.items(active).map((i) => i.id).filter(isCustomId),
                  kpis: activeCatalog.filter((m) => !!m.kpi).map((m) => ({ id: m.id, label: m.label })),
                  visibleKpis: activeIds,
                });
                return res.ok ? res.data : null;
              }
            : undefined,
        }
      : undefined;
  // gráficos e tabelas da aba no painel: as abas com grade (as das fontes, a galeria de criativos e as que o visual desenha à parte não têm)
  const hasGrid = canArrange && !!t && !(t.composed && SOURCE_TABS.has(active)) && !(active === "criativos" && creatives) && !(t.skin && isSkinPage(t.skin, active));
  const kpiN = (activeKpis ?? []).length;
  const onGrid = hasGrid ? grid.items(active) : [];
  const knownBlocks = t ? (rulesOf(active)?.labels ?? templateBlocksOf(templateOf(active), kpiN)) : [];
  const editorBlocks: EditorBlocks | undefined =
    hasGrid && t
      ? {
          shown: readingOrder(onGrid)
            .filter((i) => i.id !== KPIS_ID)
            .map((i) => ({ id: i.id, label: gridBlockLabel(i, knownBlocks, t.profile), w: i.w, added: kindOf(i.id) === "metric" || kindOf(i.id) === "custom" })),
          hidden: knownBlocks.filter((b) => b.id !== KPIS_ID && !onGrid.some((i) => i.id === b.id)),
          kpiStrip: !knownBlocks.some((b) => b.id === KPIS_ID) ? "none" : onGrid.some((i) => i.id === KPIS_ID) ? "shown" : "hidden",
          hide: (id) => grid.hide(active, id, kpiN),
          show: (id) => grid.add(active, id, undefined, kpiN),
          canHide: onGrid.length > 1,
          platform: {
            count: platformCardCount(onGrid),
            max: METRIC_CARDS_MAX,
            render: () => (
              <PlatformTray
                state={{ items: grid.items(active), hide: (id) => grid.hide(active, id, kpiN), add: (id) => grid.add(active, id, undefined, kpiN) }}
                sources={t.sources}
                ds={ds}
                profile={t.profile}
                hideSpend={hideSpend}
                arrange={arrangePlan}
              />
            ),
          },
          custom: { count: onGrid.filter((i) => kindOf(i.id) === "custom").length, max: CUSTOM_BLOCKS_MAX },
        }
      : undefined;
  const edit = useMetricEditorState({
    ask: askHost,
    pageName: PAGES[active]?.name,
    blocks: editorBlocks,
    metrics,
    visibleKpis: activeIds,
    hasData: (id) => {
      const v = isSampleMetric(id) ? currentTotals(ds)[id] : extraById.get(id)?.value;
      return v != null && Number.isFinite(v) && v !== 0;
    },
    valueOf: (id) => {
      if (isSampleMetric(id)) {
        const totals = metaPart ? platformPart(ds, "meta", "current") : currentTotals(ds);
        const def = metricDefinition(id, t?.profile ?? "ecommerce");
        return { text: formatMetricValue(totals[id], def.format), spark: metaPart ? undefined : series(ds.current, id) };
      }
      const extra = extraById.get(id);
      return extra ? { text: formatLive(extra.value, extra.format) } : null;
    },
    kpiPlace: "nesta aba",
    settingsHref: customizeId && backHref ? `/painel/dashboards/${customizeId}/editar` : undefined,
    kpiNote: pageKpis.filter((r) => r.length).length > 1 ? "Ocultar ou adicionar vale para todas as abas com cards." : undefined,
    noKpis: !activeKpis?.length,
    goToCards: pagesWithCards[0] ? () => setPage(pagesWithCards[0]) : undefined,
    arrange: canArrange ? arrangePlan : undefined,
    align:
      hasGrid && arrangePlan
        ? () => {
            const n = (activeKpis ?? []).length;
            if (grid.isAligned(active, n)) notify("A grade desta aba já está alinhada.", "ok");
            else grid.align(active, n);
          }
        : undefined,
  });
  // "Ver como fica" no editor: o dashboard volta ao normal (com as mudanças ainda não salvas)
  const editing = metrics.open && !edit.previewing;
  const filterLabels = useMemo(
    () => ({
      campaigns: Object.fromEntries(ds.campaigns.map((c) => [c.id, c.name])),
      ads: { ...Object.fromEntries(ds.creatives.map((c) => [c.id, c.name])), ...Object.fromEntries((creatives?.list ?? []).map((c) => [c.id, c.name])) },
      platforms: Object.fromEntries(ds.adPlatforms.map((id) => [id, PLATFORMS[id].name])),
    }),
    [creatives, ds],
  );
  const filterState = useFilterState({ initial: initialFilters, labels: filterLabels, periodDays: days, navigate: onFilterNavigate, suspended: editing });
  const filtered = useMemo(() => filterDataset(ds, filterState.filters, { today, adSelection: creatives?.selection }), [creatives?.selection, ds, filterState.filters, today]);
  // modelos novos: GA4 e orgânico (reais quando há conta ligada; senão, a amostra)
  const sourceExtras = useMemo<SourceExtras | null>(() => {
    if (!t?.composed) return null;
    if (realExtras) return realExtras;
    // amostra: GA4, CRM e orgânico de exemplo (o mesmo desenho das contas reais)
    const { current, previous } = dashboardRanges(period, customDays, today);
    const days = diffDays(previous.from, current.to) + 1;
    const analytics = generateAnalyticsData({ accountExternalId: `${spec.name}|${spec.client}`, endDate: current.to, days }).daily;
    const crm = generateCrmData({ accountExternalId: `${spec.name}|${spec.client}`, endDate: current.to, days }).daily;
    const organic = sampleOrganic(current, previous);
    return { current, previous, currency: "BRL", analytics, crm, organic: { instagram: organic, facebook: organic, all: organic } };
  }, [t, realExtras, period, customDays, today, spec.name, spec.client]);
  // modo apresentação (botão Apresentar): tela cheia, sem botões de edição, abas com ← →
  const { rootRef, presenting, stop: stopPresenting } = usePresentation({ pages: tabs, page, setPage, blocked: metrics.open });
  if (!t) return <p className="text-fg-2">Template não encontrado.</p>;
  const ctxOptions = { hideSpend, compare, showPrevious: compare, visibleColumns: metrics.visibility.columns, today, goals: spec.metricGoals };
  const baseCtx = makeContext(ds, ctxOptions);
  const ctx = filtered.active ? makeContext(filtered.ds, { ...ctxOptions, base: baseCtx, chart: filtered.chart, platformsDs: filtered.platforms }) : baseCtx;
  const chips = chipsOf(filterState.filters, filterState.labels, compare ? filterState.compared : null);
  // dados reais (contas ligadas) ou a amostra: o selo e as plataformas do topo dizem a verdade
  const isReal = !!dataset || !!realExtras;
  const realLabel = isReal ? "Dados reais" : "Amostra · dados fictícios";
  const headerSources = t.composed ? (linkedPlatforms ?? []) : t.sources;
  // páginas de uma plataforma (Meta, Google): os números só dela, quando o dashboard tem mais de uma
  const ctxFor = (p: PageId) => {
    const only = PAGE_PLATFORM[p];
    if (!t.composed || !only || ds.adPlatforms.length < 2 || !ds.adPlatforms.includes(only)) return ctx;
    const scoped = filterDataset(ds, { ...filterState.filters, platforms: [only] }, { today, adSelection: creatives?.selection });
    return makeContext(scoped.ds, { ...ctxOptions, base: baseCtx, chart: scoped.chart, platformsDs: scoped.platforms });
  };
  // páginas que não são de anúncio: Site, Força dos canais, Instagram, Página e Conteúdo
  const sourcePage = (p: PageId, fitScreen = false): ReactNode | null => {
    if (!sourceExtras) return null;
    const page =
      p === "site" ? <SitePage extras={sourceExtras} profile={t.profile} />
      : p === "canais-site" ? <ChannelsPage extras={sourceExtras} profile={t.profile} ds={ds} />
      : p === "crm" ? <CrmPage extras={sourceExtras} ds={ds} hideSpend={hideSpend} />
      : p === "instagram" ? <OrganicSourcePage extras={sourceExtras} which="instagram" />
      : p === "pagina-facebook" ? <OrganicSourcePage extras={sourceExtras} which="facebook" />
      : p === "conteudo" ? <OrganicSourcePage extras={sourceExtras} which="conteudo" />
      // recursos do Avançado: o desenho próprio deles, com os números deste dashboard
      : p === "criativos-ao-vivo" || p === "previsao" || p === "mmm" ? (
        // o desenho do recurso ocupa a altura toda (sem sobrar faixa escura embaixo) e rola por dentro
        <div className="h-full min-h-0 overflow-auto rounded-card [&>*]:min-h-full">
          <SkinView skin={p} ctx={ctxFor(p)} name={spec.name} client={spec.client} pages={[p]} active={p} periodLabel={periodLabel} syncedAt={syncedAt} timeZone={timeZone} mmm={p === "mmm" ? (isReal ? { real: mmmReadiness ?? null, connectHref: backHref ? "/painel/contas" : undefined, sheet: capa.sheet } : { sample: true }) : undefined} />
        </div>
      )
      : null;
    // na tela do painel, encaixa na altura (16:9, sem rolar a página), como a grade dos blocos
    return page && <FitFrame fit={fitScreen}>{page}</FitFrame>;
  };
  // métrica nova sem valor do servidor não vira card: o contador e a tela continuam batendo
  const idsOf = (p: PageId) => pageKpiIds(catalog, pageLayout(t, p).kpis.map((k) => k.metric), metrics.prefs?.kpis, { hideSpend }).filter((id) => isSampleMetric(id) || extraById.has(id));
  const layoutOf = (p: PageId) => sampleLayout(pageLayout(t, p), idsOf(p).filter(isSampleMetric));
  const extrasOf = (p: PageId) => idsOf(p).flatMap((id) => extraById.get(id) ?? []);
  // recorte sem a Meta (campanha ou plataforma de outra): a parte dela é zero
  const metaIn = (when: "current" | "previous") => (ctx.ds.adPlatforms.includes("meta") ? platformPart(ctx.ds, "meta", when) : totals([]));
  const creativesCtx = creatives && ds.adPlatforms.length > 1 && ds.adPlatforms.includes("meta") ? { ...ctx, cur: metaIn("current"), prev: metaIn("previous"), labelSuffix: " · Meta" } : ctx;
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? "";
  // template com visual próprio: a primeira aba dele sai no estilo da referência
  const skinned = (p: PageId) => !!t.skin && (p === t.pages[0] || isSkinPage(t.skin, p));
  // relatório do Lavanda: "Mês anterior fechado" e, com ele, a comparação com o mês antes
  const cm = closedMonth(today);
  const currentRange = dashboardRanges(period, customDays, today).current;
  const monthOn = isClosedMonth(cm, filterState.filters.days ?? currentRange);
  const monthRows = monthOn ? [...(ctx.chart ?? ctx.ds).previous, ...(ctx.chart ?? ctx.ds).current] : [];
  const month: MonthReport = {
    info: cm,
    active: monthOn,
    before: monthOn && coversRange(monthRows, today, cm.before) ? totals(rowsIn(monthRows, today, cm.before), ctx.prev.frequency) : null,
    select:
      cm.available && !monthOn && !editing
        ? () => {
            setPeriod("custom");
            setRange(null);
            setCustomDays(cm.periodDays);
            // com dados do servidor, a URL leva o período e o trecho juntos; na amostra, o trecho fica aqui
            if (onPeriodChange) onPeriodChange("custom", cm.periodDays, cm.month);
            else if (!filterState.filters.days || filterState.filters.days.from !== cm.month.from || filterState.filters.days.to !== cm.month.to) filterState.selectDays(cm.month);
          }
        : undefined,
  };
  // no relatório com o mês fechado, a comparação é com o mês antes dele: o selo do filtro diz isso
  const filterApi = month.active && month.before && active === t.pages[0] ? { ...filterState, compared: cm.before } : filterState;
  // cards de criativo dos visuais: a galeria do servidor (com o resultado do objetivo de cada campanha)
  // ou, sem ela, os criativos do dashboard; as métricas escolhidas valem para todos os cards
  const cardSource = creatives && creatives.level !== "list" && creatives.gallery.length ? fromGallery(creatives.gallery) : fromDataset(ctx.ds, formatResultLabel(t.profile));
  // quem edita troca (e grava); no link compartilhado, só vê a escolha salva
  const cardPrefs: CardPrefs = { ids: cardIds(metrics.cards, t.skin, { hideSpend }), set: metrics.canSaveCards ? metrics.setCards : undefined, hideSpend };
  // a fileira de cards da aba Criativos (a mesma da aba padrão, editável no modo edição), acima do jeito de cada visual
  const creativesKpis = <PageView layout={{ ...layoutOf("criativos"), widgets: [] }} ctx={creatives ? creativesCtx : ctxFor("criativos")} kpiEdit={metrics.edit} extraCards={extrasOf("criativos")} />;
  const skinView = (p: PageId, nav: boolean, content?: ReactNode) =>
    t.skin ? (
      <SkinView
        skin={t.skin}
        ctx={ctx}
        name={spec.name}
        client={spec.client}
        pages={tabs}
        active={p}
        periodLabel={periodLabel}
        month={month}
        cards={{ source: cardSource, level: creatives?.level ?? null, data: creatives, kpis: p === "criativos" ? creativesKpis : undefined }}
        syncHours={syncHours}
        syncedAt={syncedAt}
        timeZone={timeZone}
        pageCtx={ctxFor(p)}
        controls={nav ? skinControls : undefined}
        note={nav ? skinNote : undefined}
        screen={nav && screen}
        bar={nav ? skinBar : undefined}
        cover={hasCoverSkin(t.skin) ? (nav ? capa.cover : { value: capa.cover.value }) : undefined}
        sheet={hasCoverSkin(t.skin) ? (nav ? capa.sheet : { ...capa.sheet, connect: undefined, disconnect: undefined }) : undefined}
        grid={{
          items: grid.items(p),
          fit: nav && fit,
          editing: nav && editing && canArrange,
          arrange: arrangePlan,
          onChange: (g) => grid.change(p, g),
          onHide: (id) => grid.hide(p, id, (pageKpis[spec.pages.indexOf(p)] ?? []).length),
          onDropNew: (id, x, y) => grid.add(p, id, { x, y }),
          canDrop: (id) => grid.accepts(p, id),
        }}
        onPage={
          nav
            ? (np) => {
                setPage(np);
                setQueryParam("pagina", np);
              }
            : undefined
        }
      >
        {content}
      </SkinView>
    ) : null;
  const attribution = ATTRIBUTIONS.find((a) => a.value === spec.settings.attribution)?.label;

  // período e comparação num botão só (o comparar fica no pé do calendário)
  const periodControl = (compact = false) => (
    <DateRangePicker
      compact={compact}
      period={period}
      range={range}
      customDays={customDays}
      maxDays={60}
      compare={compare}
      onCompare={setCompare}
      onChange={(p, r) => {
        setPeriod(p);
        // o trecho de dias só vale dentro do período
        if (filterState.filters.days) filterState.remove("days");
        if (r) {
          setRange(r);
          setCustomDays(Math.max(3, rangeDays(r)));
        }
        onPeriodChange?.(p, r ? Math.max(3, rangeDays(r)) : customDays);
      }}
    />
  );
  // Na tela do dashboard do painel, cada aba se encaixa na altura do monitor (16:9, sem rolar a página):
  // o topo fica enxuto (título, abas e controles em menos linhas) e as ações vão para a barra do topo.
  const fit = !!backHref;
  // Visual com moldura própria (Lavanda, Pulso, Monocromo, Noturno, Areia): a tela mostra só
  // o dashboard no modelo escolhido. O cabeçalho padrão some; os controles entram no topo do
  // visual, com a paleta dele, e todas as abas ficam dentro da moldura.
  const framed = isFramedSkin(t.skin);
  const periodNote = `${periodLabel} · ${days} dias · janela de atribuição: ${attribution}. Os últimos 3 dias ficam em maturação.`;
  // objetivo sem resultado no período (lead, conversa): o aviso diz o que a conta registrou no lugar
  const notice = resultNotice(ds);
  const noticeLine = notice ? (
    <p role="status" className="rounded-control border border-line bg-surface-2/60 px-3 py-2 text-[12.5px] text-fg" data-aviso-resultado>
      {notice}
    </p>
  ) : null;
  // Na tela cheia, a nota do período vira dica: cada linha de texto a menos é altura para os blocos. No estreito ela segue escrita.
  const periodHint = (
    <Tooltip side="bottom" content={<span className="block max-w-[300px] font-normal">{periodNote}</span>}>
      <button
        type="button"
        aria-label={`Sobre o período: ${periodNote}`}
        className="hidden size-9 shrink-0 items-center justify-center rounded-full text-fg-2 outline-none transition-colors hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent @[720px]:inline-flex"
      >
        <Info size={16} aria-hidden />
      </button>
    </Tooltip>
  );
  // No painel, esse visual é a tela: vai de ponta a ponta, sem a barra padrão. A barra do topo
  // (voltar e as ações: editar, compartilhar, exportar) entra nele, nas cores dele.
  const screen = framed && !!backHref;
  const skinControls = framed ? (
    <div className="flex flex-wrap items-end gap-2">
      <div inert={editing || undefined} className={`contents ${editing ? "[&>*]:opacity-50" : ""}`}>
        {periodControl()}
      </div>
      {customizeId && !metrics.open && !presenting && <CustomizeButton onClick={() => metrics.openPanel()} />}
      {screen && periodHint}
      <span className="mb-2 shrink-0 rounded-chip bg-accent-soft px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap text-fg">{realLabel}</span>
      {isReal && syncStamp && <span className="mb-2 shrink-0">{syncStamp}</span>}
      {/* fora do painel (link público) não há barra: as ações, se houver, ficam aqui. Elas medem a largura desta linha. */}
      {!screen && actions && (
        <>
          <span className="flex-1" aria-hidden />
          {actions}
        </>
      )}
    </div>
  ) : undefined;
  // as ações medem a largura do espaço delas ([data-actions-slot]) para decidir o que cabe
  const skinBar = screen ? (
    <>
      {!presenting && (
      <Link
        href={backHref}
        className="-ml-2 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control px-2 text-[13.5px] font-medium text-fg-2 outline-none transition-colors hover:bg-accent-soft hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft size={16} aria-hidden />
        Dashboards
      </Link>
      )}
      {/* período, comparar e personalizar na mesma barra (uma linha a menos em cima dos blocos); no estreito descem para a linha de baixo */}
      <div className="order-last w-full @[1150px]:order-none @[1150px]:ml-1 @[1150px]:w-auto">{skinControls}</div>
      <div data-actions-slot className="flex min-w-10 flex-1 justify-end">
        {presenting ? null : actions}
      </div>
    </>
  ) : undefined;
  const skinNote = framed ? (
    <>
      <FilterBar compare={compare} />
      <p className={`text-[12.5px] text-fg-2 ${screen ? "@[720px]:hidden" : ""}`}>{periodNote}</p>
      {noticeLine}
    </>
  ) : undefined;
  // o miolo das abas que o visual não desenha: os blocos padrão (dentro da moldura, ganham a paleta dele)
  const pageContent =
    sourcePage(active, !!backHref && !printing) ?? (active === "criativos" && creatives ? (
      // Criativos rola (a galeria é longa): a única aba fora do encaixe na tela
      <div className="space-y-2">
        <PageView layout={{ ...layoutOf(active), widgets: [] }} ctx={creativesCtx} kpiEdit={metrics.edit} extraCards={extrasOf(active)} />
        <div data-dim-self>
          <CreativesPage data={creatives} />
        </div>
      </div>
    ) : (
      <GridPage page={active} layout={layoutOf(active)} ctx={ctxFor(active)} kpiEdit={metrics.edit} extraCards={extrasOf(active)} grid={grid} editing={editing && canArrange} arrange={arrangePlan} fit={fit} />
    ));

  return (
    <CardPrefsProvider value={t?.skin ? cardPrefs : null}>
    <MetricEditProvider value={edit.editor}>
    <FilterProvider value={filterApi}>
    {/* data-skin-screen: avisa a moldura do painel (globals.css) que este dashboard toma a tela toda */}
    <div
      ref={rootRef}
      style={brandStyle(spec.brand)}
      data-skin-screen={screen ? "" : undefined}
      data-presenting={presenting ? "" : undefined}
      data-metric-editing={editing ? edit.section : undefined}
      data-fit-reserve={edit.previewing ? 64 : undefined}
      // apresentação: o dashboard cobre a tela (e entra em tela cheia, onde o navegador deixa); rola por dentro
      // editor aberto: no computador ele fica na lateral e o dashboard estreita ao lado (não fica por baixo); abaixo disso, a faixa do rodapé
      className={presenting ? presentingClass(framed) : editing ? (edit.collapsed ? EDITING_PAD_COLLAPSED : EDITING_PAD) : edit.previewing ? "pb-20" : ""}
    >
    {/* o espaçamento vale só entre as partes visíveis: a bandeja e o aviso (abaixo) não empurram a página */}
    <div className={screen ? "" : "space-y-4"}>
      {/* avisos curtos do Personalizar (bloco que não cabe, limite da grade) */}
      {customizeId && <Notices placement="top" />}
      {!framed && (
        <DashboardNav
          brand={<BrandMark brand={spec.brand} />}
          name={spec.name}
          client={spec.client}
          backHref={presenting ? undefined : backHref}
          locked={editing}
          chips={
            <>
              {headerSources.map((s) =>
                // com mais de uma plataforma de anúncios, a fonte também filtra
                ds.adPlatforms.length > 1 && ds.adPlatforms.includes(s) && !editing ? (
                  <button
                    key={s}
                    type="button"
                    data-filter-item={s}
                    aria-pressed={filterTone(filterState, "platforms", s) === "selected"}
                    aria-label={filterAria("platforms", PLATFORMS[s].name)}
                    onClick={(e) => filterState.toggle("platforms", s, PLATFORMS[s].name, e)}
                    className={`cursor-pointer rounded-full border px-2 py-px text-[11px] outline-none hover:border-accent focus-visible:ring-2 focus-visible:ring-accent ${filterTone(filterState, "platforms", s) === "selected" ? "border-accent bg-accent-soft text-fg" : filterTone(filterState, "platforms", s) === "dimmed" ? "border-line text-fg-2 opacity-45" : "border-line text-fg-2"}`}
                  >
                    {PLATFORMS[s].name}
                  </button>
                ) : (
                  <span key={s} className="rounded-full border border-line px-2 py-px text-[11px] text-fg-2">
                    {PLATFORMS[s].name}
                  </span>
                ),
              )}
              <span className="rounded-full bg-accent-soft px-2 py-px text-[11px] font-medium text-fg">{realLabel}</span>
              {isReal && syncStamp}
              {actions && !isReal && <PendingChip label="Modelo com dados de exemplo" detail="Os números são fictícios. Para os números das suas contas, crie um dashboard Meta Ads ou Google Ads · E-commerce." />}
            </>
          }
          tabs={{
            items: tabs.map((p) => ({ value: p, label: PAGES[p].name, icon: <PageIcon page={p} /> })),
            value: active,
            onChange: (p) => {
              setPage(p as PageId);
              setQueryParam("pagina", p);
            },
          }}
          period={(compact) => <div inert={editing || undefined} className={editing ? "opacity-50" : ""}>{periodControl(compact)}</div>}
          hint={periodHint}
          edit={customizeId && !metrics.open && !presenting ? <CustomizeButton onClick={() => metrics.openPanel()} /> : undefined}
          actions={presenting ? undefined : actions}
        />
      )}

      {!framed && (
        <>
          <div className="print:hidden">
            <FilterBar compare={compare} />
          </div>

          {/* no encaixe a nota vira dica ao lado do período; no celular ela segue escrita */}
          <p className={`text-[12.5px] text-fg-2 print:hidden ${fit ? "md:hidden" : ""}`}>{periodNote}</p>
          {noticeLine}
        </>
      )}

      {!printing && (
        <div className="relative" data-anim={assemble ? "on" : "off"}>
          <div className="scanner" aria-hidden />
          <div className="m-unveil">
            {framed ? (
              // a moldura do visual fica montada; só o miolo troca de aba
              skinView(active, true, skinned(active) ? undefined : <div key={active}>{pageContent}</div>)
            ) : skinned(active) ? (
              <div key={active}>{skinView(active, true)}</div>
            ) : (
              <div key={active}>{pageContent}</div>
            )}
          </div>
        </div>
      )}

      {printing && (
        <div className="print-root">
          <section className="print-page flex flex-col justify-between">
            <div>
              <BrandMark brand={spec.brand} />
              <h1 className="display mt-16 text-[48px]">{spec.name}</h1>
              <p className="mt-3 text-[20px] text-fg-2">{spec.client}</p>
            </div>
            <dl className="grid grid-cols-3 gap-6 text-[14px]">
              <div>
                <dt className="text-fg-2">Período</dt>
                <dd className="font-semibold">
                  {periodLabel} ({days} dias)
                </dd>
              </div>
              <div>
                <dt className="text-fg-2">Gerado em</dt>
                <dd className="font-semibold tnum">{ddmmyyyy(new Date())}</dd>
              </div>
              <div>
                <dt className="text-fg-2">Dados</dt>
                <dd className="font-semibold">{realLabel}</dd>
              </div>
            </dl>
            {chips.length > 0 && (
              <p data-print-filters className="mt-6 text-[14px]">
                <span className="text-fg-2">Filtros ativos: </span>
                <span className="font-semibold">{chips.map((c) => c.text).join(" · ")}</span>
              </p>
            )}
          </section>
          {tabs.map((p) => (
            <section key={p} className="print-page">
              <p className="mb-3 flex items-baseline justify-between text-[13px] text-fg-2">
                <span className="title text-[18px] text-fg">{PAGES[p].name}</span>
                <span>
                  {spec.client} · {periodLabel}
                </span>
              </p>
              {chips.length > 0 && <p className="mb-3 text-[12px] text-fg-2">Filtros ativos: {filterSummary(filterState.filters, filterState.labels)}</p>}
              {sourcePage(p) ? (
                sourcePage(p)
              ) : p === "criativos" && creatives ? (
                <div className="space-y-2">
                  <PageView layout={{ ...layoutOf(p), widgets: [] }} ctx={creativesCtx} extraCards={extrasOf(p)} />
                  <CreativeList rows={creatives.list} currency={creatives.currency} hideSpend={creatives.hideSpend} />
                </div>
              ) : skinned(p) ? (
                skinView(p, false)
              ) : framed ? (
                skinView(p, false, <PageView layout={layoutOf(p)} ctx={ctxFor(p)} extraCards={extrasOf(p)} />)
              ) : (
                <PageView layout={layoutOf(p)} ctx={ctxFor(p)} extraCards={extrasOf(p)} />
              )}
            </section>
          ))}
        </div>
      )}
    </div>
      {presenting && <PresenterBar pages={tabs} page={active} setPage={setPage} name={(p) => PAGES[p].name} onStop={stopPresenting} />}
      {customizeId && <MetricTray state={edit} />}
      {customizeId && <MetricNoticeBar notice={metrics.notice} onUndo={metrics.undo} onDismiss={metrics.dismiss} />}
    </div>
    </FilterProvider>
    </MetricEditProvider>
    </CardPrefsProvider>
  );
}
