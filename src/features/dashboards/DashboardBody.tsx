"use client";

import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Switch } from "@/components/ui/controls";
import { PendingChip } from "@/components/ui/kit";
import { OverflowTabs } from "@/components/ui/OverflowTabs";
import { PeriodPicker, rangeDays, type Range } from "@/components/ui/PeriodPicker";
import { Notices, notify } from "@/components/ui/Toast";
import { Tooltip } from "@/components/ui/Tooltip";
import { PLATFORMS } from "@/features/accounts/platforms";
import { CreativeList } from "@/features/analytics/creatives/CreativeList";
import { CreativesPage } from "@/features/analytics/creatives/CreativesPage";
import { setQueryParam } from "@/features/analytics/creatives/query";
import { chipsOf, filterAria, filterTone, FilterBar, FilterProvider, useFilterState } from "@/features/analytics/filter-context";
import { filterSummary, NO_FILTERS, type DashFilters } from "@/features/analytics/filters";
import type { CreativesData, SampleExtraMetric } from "@/features/analytics/types";
import { formatValue as formatLive } from "@/features/analytics/format";
import { currentTotals, platformPart, series, totals } from "@/features/metrics/compute";
import { filterDataset } from "@/features/metrics/filter-dataset";
import { DEFAULT_TIME_ZONE, localDate } from "@/features/sync/dates";
import { formatValue as formatMetricValue, metric as metricDefinition } from "@/features/metrics/definitions";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { PAGES } from "@/features/templates/pages";
import type { MetricId } from "@/features/metrics/definitions";
import type { PageId, PageLayout } from "@/features/templates/types";
import { FocusBarActions } from "@/features/workspace/FocusBarActions";
import { ATTRIBUTIONS, periodDays, PERIODS, type DashboardSettings, type PeriodId } from "@/features/workspace/types";
import type { Brand } from "@/features/workspace/workspace";
import { ddmmyyyy } from "@/lib/format";
import { brandVars } from "./brand";
import { datasetFor, pageLayout, sampleDefaultKpis } from "./data";
import { isSampleMetric, pageCatalog, pageKpiIds, sampleCatalog, type MetricPrefs } from "./metric-prefs";
import { useMetricPrefsState, type SaveMetricPrefs } from "./metric-prefs-context";
import { MetricNoticeBar } from "./MetricActions";
import { MetricEditProvider } from "./metric-edit-context";
import { CustomizeButton, MetricEditBar, MetricTray, useMetricEditorState } from "./MetricEditor";
import { pageRules } from "./layout/page-rules";
import { GridPage, templateBlocksOf } from "./layout/GridPage";
import { PlatformTray } from "./layout/LayoutEditor";
import type { DashboardLayout } from "./layout/model";
import { useDashboardLayout, type SaveLayout } from "./layout/useDashboardLayout";
import { SkinView } from "./skins";
import { isFramedSkin } from "./skins/blocks";
import { PageView } from "./widgets/PageView";
import { makeContext } from "./widgets/Widgets";

export type DashboardSpec = { templateId: string; name: string; client: string; pages: PageId[]; settings: DashboardSettings; brand?: Brand; metricPrefs?: MetricPrefs; layout?: DashboardLayout };

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
  /** Grava a disposição de uma aba (member+). */
  saveLayout?: (dashboardId: string, page: PageId, items: unknown) => ReturnType<SaveLayout>;
  /** Mover e redimensionar blocos (Avançado). Nos outros planos, só métricas entram e saem. */
  canArrange?: boolean;
  /** Modelos que usam a Meta: a página de Criativos por plano, no lugar do widget. */
  creatives?: CreativesData;
  initialPage?: PageId;
  /** Métricas novas do Personalizar, na escala do modelo. */
  extraMetrics?: readonly SampleExtraMetric[];
  /** A página de Criativos vem do servidor: trocar o período precisa navegar. */
  onPeriodChange?: (period: PeriodId, customDays: number) => void;
  /** Filtros que vieram na URL. */
  initialFilters?: DashFilters;
  /** Galeria e métricas novas vêm do servidor: filtrar precisa navegar. Sem isso, só troca o endereço. */
  onFilterNavigate?: (search: string) => void;
  /** No painel: para onde o voltar leva. Com ele, o modelo com visual próprio toma a tela toda (de ponta a ponta) e traz o voltar no topo dele. */
  backHref?: string;
};

/** Os cards de uma aba do exemplo: os dela que seguem visíveis e, depois, os adicionados. */
export function sampleLayout(layout: PageLayout, visible: readonly string[]): PageLayout {
  const kept = layout.kpis.filter((k) => visible.includes(k.metric));
  const extras = (visible as MetricId[]).filter((m) => !layout.kpis.some((k) => k.metric === m)).map((metric) => ({ metric, sub: "delta" as const }));
  return { ...layout, kpis: [...kept, ...extras] };
}

/** Cabeçalho, abas, período e a página ativa. Mesmo miolo no painel e no link público. */
export function DashboardBody({ spec, hideSpend, assemble, actions, printing, customizeId, saveMetrics, saveLayout, canArrange: arrangePlan = false, creatives, extraMetrics = [], initialPage, onPeriodChange, initialFilters = NO_FILTERS, onFilterNavigate, backHref }: BodyProps) {
  const t = dashboardTemplate(spec.templateId);
  const [page, setPage] = useState<PageId>(initialPage && spec.pages.includes(initialPage) ? initialPage : (spec.pages[0] ?? "visao-geral"));
  const [period, setPeriod] = useState<PeriodId>(spec.settings.period);
  const [customDays, setCustomDays] = useState(spec.settings.customDays || 14);
  const [range, setRange] = useState<Range | null>(null);
  const [compare, setCompare] = useState(true);
  const days = periodDays({ period, customDays });
  const ds = useMemo(() => datasetFor({ ...spec, settings: spec.settings }, days), [spec, days]);
  const defaults = useMemo(() => (t ? sampleDefaultKpis(t, spec.pages) : []), [t, spec.pages]);
  const catalog = useMemo(() => sampleCatalog(t?.profile ?? "ecommerce", defaults, t?.sources), [t, defaults]);
  const extraById = useMemo(() => new Map(extraMetrics.map((m) => [m.id, m])), [extraMetrics]);
  const pageKpis = useMemo(() => (t ? spec.pages.map((p) => pageLayout(t, p).kpis.map((k) => k.metric as string)) : []), [t, spec.pages]);
  const active = spec.pages.includes(page) ? page : spec.pages[0];
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
  const metrics = useMetricPrefsState({ dashboardId: customizeId ?? null, scope: "sample", catalog: activeCatalog, pageKpis, initial: spec.metricPrefs, hideSpend, saveAction: saveMetrics, companion: canArrange ? grid.companion : undefined });
  const pagesWithCards = spec.pages.filter((p, i) => (pageKpis[i] ?? []).length > 0);
  const known = (id: string) => isSampleMetric(id) || extraById.has(id);
  const activeIds = pageKpiIds(catalog, activeKpis ?? [], metrics.prefs?.kpis, { hideSpend }).filter(known);
  // aba Criativos com outras plataformas: os cards mostram a parte da Meta, a mesma dos anúncios
  const metaPart = !!creatives && active === "criativos" && ds.adPlatforms.length > 1 && ds.adPlatforms.includes("meta");
  const edit = useMetricEditorState({
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
    kpiNote: pageKpis.filter((r) => r.length).length > 1 ? "Ocultar ou adicionar vale para todas as abas com cards." : undefined,
    noKpis: !activeKpis?.length,
    goToCards: pagesWithCards[0] ? () => setPage(pagesWithCards[0]) : undefined,
    arrange: canArrange ? arrangePlan : undefined,
    align:
      canArrange && arrangePlan && t && !(active === "criativos" && creatives)
        ? () => {
            const n = (activeKpis ?? []).length;
            if (grid.isAligned(active, n)) notify("A grade desta aba já está alinhada.", "ok");
            else grid.align(active, n);
          }
        : undefined,
    extraTab:
      canArrange && t && !(active === "criativos" && creatives)
        ? {
            label: "Por plataforma",
            render: () => (
              <PlatformTray
                state={{ items: grid.items(active), hide: (id) => grid.hide(active, id), add: (id) => grid.add(active, id, undefined, (activeKpis ?? []).length), dirty: grid.companion.dirty }}
                blocks={rulesOf(active)?.labels ?? templateBlocksOf(templateOf(active), (activeKpis ?? []).length)}
                sources={t.sources}
                ds={ds}
                profile={t.profile}
                hideSpend={hideSpend}
                arrange={arrangePlan}
              />
            ),
          }
        : undefined,
  });
  const editing = metrics.open;
  const filterLabels = useMemo(
    () => ({
      campaigns: Object.fromEntries(ds.campaigns.map((c) => [c.id, c.name])),
      ads: { ...Object.fromEntries(ds.creatives.map((c) => [c.id, c.name])), ...Object.fromEntries((creatives?.list ?? []).map((c) => [c.id, c.name])) },
      platforms: Object.fromEntries(ds.adPlatforms.map((id) => [id, PLATFORMS[id].name])),
    }),
    [creatives, ds],
  );
  const filterState = useFilterState({ initial: initialFilters, labels: filterLabels, periodDays: days, navigate: onFilterNavigate, suspended: editing });
  const today = useMemo(() => localDate(new Date(), DEFAULT_TIME_ZONE), []);
  const filtered = useMemo(() => filterDataset(ds, filterState.filters, { today, adSelection: creatives?.selection }), [creatives?.selection, ds, filterState.filters, today]);
  if (!t) return <p className="text-fg-2">Template não encontrado.</p>;
  const ctxOptions = { hideSpend, compare, showPrevious: compare, visibleColumns: metrics.visibility.columns, today };
  const baseCtx = makeContext(ds, ctxOptions);
  const ctx = filtered.active ? makeContext(filtered.ds, { ...ctxOptions, base: baseCtx, chart: filtered.chart, platformsDs: filtered.platforms }) : baseCtx;
  const chips = chipsOf(filterState.filters, filterState.labels, compare ? filterState.compared : null);
  // métrica nova sem valor do servidor não vira card: o contador e a tela continuam batendo
  const idsOf = (p: PageId) => pageKpiIds(catalog, pageLayout(t, p).kpis.map((k) => k.metric), metrics.prefs?.kpis, { hideSpend }).filter((id) => isSampleMetric(id) || extraById.has(id));
  const layoutOf = (p: PageId) => sampleLayout(pageLayout(t, p), idsOf(p).filter(isSampleMetric));
  const extrasOf = (p: PageId) => idsOf(p).flatMap((id) => extraById.get(id) ?? []);
  // recorte sem a Meta (campanha ou plataforma de outra): a parte dela é zero
  const metaIn = (when: "current" | "previous") => (ctx.ds.adPlatforms.includes("meta") ? platformPart(ctx.ds, "meta", when) : totals([]));
  const creativesCtx = creatives && ds.adPlatforms.length > 1 && ds.adPlatforms.includes("meta") ? { ...ctx, cur: metaIn("current"), prev: metaIn("previous"), labelSuffix: " · Meta" } : ctx;
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? "";
  // template com visual próprio: a primeira aba dele sai no estilo da referência
  const skinned = (p: PageId) => !!t.skin && p === t.pages[0];
  const skinView = (p: PageId, nav: boolean, content?: ReactNode) =>
    t.skin ? (
      <SkinView
        skin={t.skin}
        ctx={ctx}
        name={spec.name}
        client={spec.client}
        pages={spec.pages}
        active={p}
        periodLabel={periodLabel}
        controls={nav ? skinControls : undefined}
        note={nav ? skinNote : undefined}
        screen={nav && screen}
        bar={nav ? skinBar : undefined}
        grid={{
          items: grid.items(p),
          fit: nav && fit,
          editing: nav && editing && canArrange && arrangePlan,
          onChange: (g) => grid.change(p, g),
          onHide: (id) => grid.hide(p, id),
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

  const periodControl = (labelHidden = false) => (
    <PeriodPicker
      labelHidden={labelHidden}
      period={period}
      range={range}
      customDays={customDays}
      maxDays={60}
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
  const compareControl = (
    <Switch
      label={
        <>
          <span className={fit ? "" : "@[760px]:hidden"}>Comparar</span>
          {!fit && <span className="hidden @[760px]:inline">Comparar com o período anterior</span>}
        </>
      }
      checked={compare}
      onChange={setCompare}
    />
  );
  // Visual com moldura própria (Lavanda, Pulso, Monocromo, Noturno, Areia): a tela mostra só
  // o dashboard no modelo escolhido. O cabeçalho padrão some; os controles entram no topo do
  // visual, com a paleta dele, e todas as abas ficam dentro da moldura.
  const framed = isFramedSkin(t.skin);
  const periodNote = `${periodLabel} · ${days} dias · janela de atribuição: ${attribution}. Os últimos 3 dias ficam em maturação.`;
  // Na tela cheia, a nota do período vira dica: cada linha de texto a menos é altura para os blocos. No estreito ela segue escrita.
  const periodHint = (
    <Tooltip side="bottom" content={<span className="block max-w-[300px] font-normal">{periodNote}</span>}>
      <button
        type="button"
        aria-label={`Sobre o período: ${periodNote}`}
        className="hidden size-10 shrink-0 items-center justify-center rounded-control border border-line text-fg-2 outline-none transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent @[720px]:inline-flex"
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
        <div className="w-full @[540px]:w-52 @[760px]:w-60">{periodControl(screen)}</div>
        <div className="flex h-10 shrink-0 items-center rounded-control border border-line px-2.5 text-[13px] whitespace-nowrap [&>div]:gap-2">
          <Switch label="Comparar" checked={compare} onChange={setCompare} />
        </div>
      </div>
      {customizeId && !editing && <CustomizeButton onClick={() => metrics.openPanel()} />}
      {screen && periodHint}
      <span className="mb-2 shrink-0 rounded-chip bg-accent-soft px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap text-fg">Amostra · dados fictícios</span>
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
      <Link
        href={backHref}
        className="-ml-2 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control px-2 text-[13.5px] font-medium text-fg-2 outline-none transition-colors hover:bg-accent-soft hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft size={16} aria-hidden />
        Dashboards
      </Link>
      {/* período, comparar e personalizar na mesma barra (uma linha a menos em cima dos blocos); no estreito descem para a linha de baixo */}
      <div className="order-last w-full @[1150px]:order-none @[1150px]:ml-1 @[1150px]:w-auto">{skinControls}</div>
      <div data-actions-slot className="flex min-w-10 flex-1 justify-end">
        {actions}
      </div>
    </>
  ) : undefined;
  const skinNote = framed ? (
    <>
      <FilterBar compare={compare} />
      <p className={`text-[12.5px] text-fg-2 ${screen ? "@[720px]:hidden" : ""}`}>{periodNote}</p>
    </>
  ) : undefined;
  // o miolo das abas que o visual não desenha: os blocos padrão (dentro da moldura, ganham a paleta dele)
  const pageContent =
    active === "criativos" && creatives ? (
      <div className="space-y-2">
        <PageView layout={{ ...layoutOf(active), widgets: [] }} ctx={creativesCtx} kpiEdit={metrics.edit} extraCards={extrasOf(active)} />
        <div data-dim-self>
          <CreativesPage data={creatives} />
        </div>
      </div>
    ) : (
      <GridPage page={active} layout={layoutOf(active)} ctx={ctx} kpiEdit={metrics.edit} extraCards={extrasOf(active)} grid={grid} editing={editing && canArrange && arrangePlan} fit={fit} />
    );

  return (
    <MetricEditProvider value={edit.editor}>
    <FilterProvider value={filterState}>
    {/* data-skin-screen: avisa a moldura do painel (globals.css) que este dashboard toma a tela toda */}
    <div style={brandStyle(spec.brand)} data-skin-screen={screen ? "" : undefined} data-metric-editing={editing ? edit.section : undefined} className={editing ? "pb-[62dvh] md:pb-[320px]" : ""}>
    {/* o espaçamento vale só entre as partes visíveis: a bandeja e o aviso (abaixo) não empurram a página */}
    <div className={screen ? "" : "space-y-4"}>
      {customizeId && <MetricEditBar state={edit} />}
      {/* avisos curtos do Personalizar (bloco que não cabe, limite da grade) */}
      {customizeId && <Notices placement="top" />}
      {!framed && (
      <div className={`@container print:hidden ${fit ? "space-y-3" : "space-y-4"}`}>
        <header className="flex items-start justify-between gap-4 overflow-x-clip [overflow-clip-margin:4px]">
          <div className={`flex min-w-0 flex-1 items-start gap-4 ${fit ? "@[900px]:items-center" : ""}`}>
            <div className={`hidden shrink-0 pt-1.5 @[500px]:block ${fit ? "@[900px]:pt-0" : ""}`}>
              <BrandMark brand={spec.brand} />
            </div>
            {/* no encaixe, título, cliente e etiquetas dividem uma linha só */}
            <div className={fit ? "min-w-0 @[900px]:flex @[900px]:flex-wrap @[900px]:items-center @[900px]:gap-x-3 @[900px]:gap-y-1" : "min-w-0"}>
              <h1 className={`title truncate ${fit ? "text-[1.6rem] @[900px]:text-[1.3rem]" : "text-[1.6rem]"}`}>{spec.name}</h1>
              <p className="text-[14px] text-fg-2">{spec.client}</p>
              <div className={`flex flex-wrap items-center gap-1.5 ${fit ? "mt-2 @[900px]:mt-0" : "mt-2"}`}>
                {t.sources.map((s) =>
                  // com mais de uma plataforma de anúncios, a fonte também filtra
                  ds.adPlatforms.length > 1 && ds.adPlatforms.includes(s) && !editing ? (
                    <button
                      key={s}
                      type="button"
                      data-filter-item={s}
                      aria-pressed={filterTone(filterState, "platforms", s) === "selected"}
                      aria-label={filterAria("platforms", PLATFORMS[s].name)}
                      onClick={(e) => filterState.toggle("platforms", s, PLATFORMS[s].name, e)}
                      className={`cursor-pointer rounded-chip border px-2 py-0.5 text-[11.5px] outline-none hover:border-accent focus-visible:ring-2 focus-visible:ring-accent ${filterTone(filterState, "platforms", s) === "selected" ? "border-accent bg-accent-soft text-fg" : filterTone(filterState, "platforms", s) === "dimmed" ? "border-line text-fg-2 opacity-45" : "border-line text-fg-2"}`}
                    >
                      {PLATFORMS[s].name}
                    </button>
                  ) : (
                    <span key={s} className="rounded-chip border border-line px-2 py-0.5 text-[11.5px] text-fg-2">
                      {PLATFORMS[s].name}
                    </span>
                  ),
                )}
                <span className="rounded-chip bg-accent-soft px-2 py-0.5 text-[11.5px] font-medium text-fg">Amostra · dados fictícios</span>
                {actions && <PendingChip label="Modelo com dados de exemplo" detail="Os números são fictícios. Para os números das suas contas, crie um dashboard Meta Ads ou Google Ads · E-commerce." />}
              </div>
            </div>
          </div>
          {/* na tela cheia do painel, as ações ficam na barra do topo, não no dashboard */}
          {fit ? <FocusBarActions>{actions}</FocusBarActions> : actions}
        </header>

        <div className={fit ? "flex flex-col gap-3 @[1000px]:flex-row @[1000px]:items-end" : "flex flex-col gap-3"}>
          <div className={fit ? "min-w-0 @[1000px]:flex-1" : "min-w-0"}>
            <OverflowTabs
              label="Páginas do dashboard"
              value={active}
              onChange={(p) => {
                setPage(p);
                setQueryParam("pagina", p);
              }}
              items={spec.pages.map((p) => ({ value: p, label: PAGES[p].name }))}
            />
          </div>
          <div className={`flex flex-wrap items-end gap-2 ${fit ? "@[1000px]:shrink-0 @[1000px]:flex-nowrap" : ""}`}>
            <div inert={editing || undefined} className={`contents ${editing ? "[&>*]:opacity-50" : ""}`}>
            <div className="w-full @[540px]:w-52 @[760px]:w-60">
              {periodControl(fit)}
            </div>
            <div className="flex h-10 shrink-0 items-center rounded-control border border-line px-2.5 text-[13px] whitespace-nowrap [&>div]:gap-2">
              {compareControl}
            </div>
            </div>
            {fit && periodHint}
            {customizeId && !editing && (
              <div className="ml-auto">
                <CustomizeButton onClick={() => metrics.openPanel()} />
              </div>
            )}
          </div>
        </div>
      </div>

      )}

      {!framed && (
        <>
          <div className="print:hidden">
            <FilterBar compare={compare} />
          </div>

          {/* no encaixe a nota vira dica ao lado do período; no celular ela segue escrita */}
          <p className={`text-[12.5px] text-fg-2 print:hidden ${fit ? "md:hidden" : ""}`}>{periodNote}</p>
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
                <dd className="font-semibold">Amostra · dados fictícios</dd>
              </div>
            </dl>
            {chips.length > 0 && (
              <p data-print-filters className="mt-6 text-[14px]">
                <span className="text-fg-2">Filtros ativos: </span>
                <span className="font-semibold">{chips.map((c) => c.text).join(" · ")}</span>
              </p>
            )}
          </section>
          {spec.pages.map((p) => (
            <section key={p} className="print-page">
              <p className="mb-3 flex items-baseline justify-between text-[13px] text-fg-2">
                <span className="title text-[18px] text-fg">{PAGES[p].name}</span>
                <span>
                  {spec.client} · {periodLabel}
                </span>
              </p>
              {chips.length > 0 && <p className="mb-3 text-[12px] text-fg-2">Filtros ativos: {filterSummary(filterState.filters, filterState.labels)}</p>}
              {p === "criativos" && creatives ? (
                <div className="space-y-2">
                  <PageView layout={{ ...layoutOf(p), widgets: [] }} ctx={creativesCtx} extraCards={extrasOf(p)} />
                  <CreativeList rows={creatives.list} currency={creatives.currency} hideSpend={creatives.hideSpend} />
                </div>
              ) : skinned(p) ? (
                skinView(p, false)
              ) : framed ? (
                skinView(p, false, <PageView layout={layoutOf(p)} ctx={ctx} extraCards={extrasOf(p)} />)
              ) : (
                <PageView layout={layoutOf(p)} ctx={ctx} extraCards={extrasOf(p)} />
              )}
            </section>
          ))}
        </div>
      )}
    </div>
      {customizeId && <MetricTray state={edit} />}
      {customizeId && <MetricNoticeBar notice={metrics.notice} onUndo={metrics.undo} onDismiss={metrics.dismiss} />}
    </div>
    </FilterProvider>
    </MetricEditProvider>
  );
}
