"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Switch } from "@/components/ui/controls";
import { PendingChip } from "@/components/ui/kit";
import { OverflowTabs } from "@/components/ui/OverflowTabs";
import { PeriodPicker, rangeDays, type Range } from "@/components/ui/PeriodPicker";
import { PLATFORMS } from "@/features/accounts/platforms";
import { CreativeList } from "@/features/analytics/creatives/CreativeList";
import { CreativesPage } from "@/features/analytics/creatives/CreativesPage";
import { setQueryParam } from "@/features/analytics/creatives/query";
import type { CreativesData } from "@/features/analytics/types";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { PAGES } from "@/features/templates/pages";
import type { MetricId } from "@/features/metrics/definitions";
import type { PageId, PageLayout } from "@/features/templates/types";
import { ATTRIBUTIONS, periodDays, PERIODS, type DashboardSettings, type PeriodId } from "@/features/workspace/types";
import type { Brand } from "@/features/workspace/workspace";
import { ddmmyyyy } from "@/lib/format";
import { brandVars } from "./brand";
import { datasetFor, pageLayout, sampleDefaultKpis } from "./data";
import { pageCatalog, pageKpiIds, sampleCatalog, type MetricPrefs } from "./metric-prefs";
import { useMetricPrefsState, type SaveMetricPrefs } from "./metric-prefs-context";
import { MetricNoticeBar } from "./MetricActions";
import { CustomizeButton, MetricsPanel } from "./MetricsPanel";
import { PageView } from "./widgets/PageView";
import { makeContext } from "./widgets/Widgets";

export type DashboardSpec = { templateId: string; name: string; client: string; pages: PageId[]; settings: DashboardSettings; brand?: Brand; metricPrefs?: MetricPrefs };

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
  /** Modelos que usam a Meta: a página de Criativos por plano, no lugar do widget. */
  creatives?: CreativesData;
  initialPage?: PageId;
  /** A página de Criativos vem do servidor: trocar o período precisa navegar. */
  onPeriodChange?: (period: PeriodId, customDays: number) => void;
};

/** Os cards de uma aba do exemplo: os dela que seguem visíveis e, depois, os adicionados. */
export function sampleLayout(layout: PageLayout, visible: readonly string[]): PageLayout {
  const kept = layout.kpis.filter((k) => visible.includes(k.metric));
  const extras = (visible as MetricId[]).filter((m) => !layout.kpis.some((k) => k.metric === m)).map((metric) => ({ metric, sub: "delta" as const }));
  return { ...layout, kpis: [...kept, ...extras] };
}

/** Cabeçalho, abas, período e a página ativa. Mesmo miolo no painel e no link público. */
export function DashboardBody({ spec, hideSpend, assemble, actions, printing, customizeId, saveMetrics, creatives, initialPage, onPeriodChange }: BodyProps) {
  const t = dashboardTemplate(spec.templateId);
  const [page, setPage] = useState<PageId>(initialPage && spec.pages.includes(initialPage) ? initialPage : (spec.pages[0] ?? "visao-geral"));
  const [period, setPeriod] = useState<PeriodId>(spec.settings.period);
  const [customDays, setCustomDays] = useState(spec.settings.customDays || 14);
  const [range, setRange] = useState<Range | null>(null);
  const [compare, setCompare] = useState(true);
  const days = periodDays({ period, customDays });
  const ds = useMemo(() => datasetFor({ ...spec, settings: spec.settings }, days), [spec, days]);
  const defaults = useMemo(() => (t ? sampleDefaultKpis(t, spec.pages) : []), [t, spec.pages]);
  const catalog = useMemo(() => sampleCatalog(t?.profile ?? "ecommerce", defaults), [t, defaults]);
  const pageKpis = useMemo(() => (t ? spec.pages.map((p) => pageLayout(t, p).kpis.map((k) => k.metric as string)) : []), [t, spec.pages]);
  const active = spec.pages.includes(page) ? page : spec.pages[0];
  const activeKpis = pageKpis[spec.pages.indexOf(active)];
  // o painel conta os cards da aba aberta: os mesmos que a tela mostra
  const activeCatalog = useMemo(() => pageCatalog(catalog, activeKpis ?? []), [catalog, activeKpis]);
  const metrics = useMetricPrefsState({ dashboardId: customizeId ?? null, scope: "sample", catalog: activeCatalog, pageKpis, initial: spec.metricPrefs, hideSpend, saveAction: saveMetrics });
  if (!t) return <p className="text-fg-2">Template não encontrado.</p>;
  const ctx = makeContext(ds, { hideSpend, compare, showPrevious: compare, visibleColumns: metrics.visibility.columns });
  const idsOf = (p: PageId) => pageKpiIds(catalog, pageLayout(t, p).kpis.map((k) => k.metric), metrics.prefs?.kpis, { hideSpend });
  const layoutOf = (p: PageId) => sampleLayout(pageLayout(t, p), idsOf(p));
  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? "";
  const attribution = ATTRIBUTIONS.find((a) => a.value === spec.settings.attribution)?.label;

  return (
    <div style={brandStyle(spec.brand)} className="space-y-4">
      {/* pela largura do contêiner, não da janela: o painel "Personalizar" encolhe esta área */}
      <div className="@container space-y-4 print:hidden">
        <header className="flex items-start justify-between gap-4 overflow-x-clip [overflow-clip-margin:4px]">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="hidden shrink-0 pt-1.5 @[500px]:block">
              <BrandMark brand={spec.brand} />
            </div>
            <div className="min-w-0">
              <h1 className="title truncate text-[1.6rem]">{spec.name}</h1>
              <p className="text-[14px] text-fg-2">{spec.client}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {t.sources.map((s) => (
                  <span key={s} className="rounded-chip border border-line px-2 py-0.5 text-[11.5px] text-fg-2">
                    {PLATFORMS[s].name}
                  </span>
                ))}
                <span className="rounded-chip bg-accent-soft px-2 py-0.5 text-[11.5px] font-medium text-fg">Amostra · dados fictícios</span>
                {actions && <PendingChip label="Modelo com dados de exemplo" detail="Os números são fictícios. Para os números das suas contas, crie um dashboard Meta Ads ou Google Ads · E-commerce." />}
              </div>
            </div>
          </div>
          {actions}
        </header>

        <div className="flex flex-col gap-3">
          <div className="min-w-0">
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
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-full @[540px]:w-52 @[760px]:w-60">
              <PeriodPicker
                period={period}
                range={range}
                customDays={customDays}
                maxDays={60}
                onChange={(p, r) => {
                  setPeriod(p);
                  if (r) {
                    setRange(r);
                    setCustomDays(Math.max(3, rangeDays(r)));
                  }
                  onPeriodChange?.(p, r ? Math.max(3, rangeDays(r)) : customDays);
                }}
              />
            </div>
            <div className="flex h-10 shrink-0 items-center rounded-control border border-line px-2.5 text-[13px] whitespace-nowrap [&>div]:gap-2">
              <Switch
                label={
                  <>
                    <span className="@[760px]:hidden">Comparar</span>
                    <span className="hidden @[760px]:inline">Comparar com o período anterior</span>
                  </>
                }
                checked={compare}
                onChange={setCompare}
              />
            </div>
            {customizeId && (
              <div className="ml-auto">
                <CustomizeButton onClick={() => metrics.openPanel()} />
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[12.5px] text-fg-2 print:hidden">
        {periodLabel} · {days} dias · janela de atribuição: {attribution}. Os últimos 3 dias ficam em maturação.
      </p>

      {!printing && (
        <div className="relative" data-anim={assemble ? "on" : "off"}>
          <div className="scanner" aria-hidden />
          <div className="m-unveil">
            {active === "criativos" && creatives ? (
              <div key={active} className="space-y-2">
                <PageView layout={{ ...layoutOf(active), widgets: [] }} ctx={ctx} kpiEdit={metrics.edit} />
                <CreativesPage data={creatives} />
              </div>
            ) : (
              <PageView key={active} layout={layoutOf(active)} ctx={ctx} kpiEdit={metrics.edit} />
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
          </section>
          {spec.pages.map((p) => (
            <section key={p} className="print-page">
              <p className="mb-3 flex items-baseline justify-between text-[13px] text-fg-2">
                <span className="title text-[18px] text-fg">{PAGES[p].name}</span>
                <span>
                  {spec.client} · {periodLabel}
                </span>
              </p>
              {p === "criativos" && creatives ? (
                <div className="space-y-2">
                  <PageView layout={{ ...layoutOf(p), widgets: [] }} ctx={ctx} />
                  <CreativeList rows={creatives.list} currency={creatives.currency} hideSpend={creatives.hideSpend} />
                </div>
              ) : (
                <PageView layout={layoutOf(p)} ctx={ctx} />
              )}
            </section>
          ))}
        </div>
      )}
      {customizeId && (
        <MetricsPanel
          open={metrics.open}
          onClose={metrics.close}
          catalog={metrics.catalog}
          visibleKpis={idsOf(active)}
          prefs={metrics.prefs}
          hasData={(id) => {
            const v = ctx.cur[id as MetricId];
            return Number.isFinite(v) && v !== 0;
          }}
          onToggle={metrics.toggle}
          onRestore={metrics.restore}
          onSave={metrics.save}
          pending={metrics.pending}
          error={metrics.error}
          kpiPlace="nesta aba"
          kpiNote={pageKpis.filter((r) => r.length).length > 1 ? "Ocultar ou adicionar vale para todas as abas com cards." : undefined}
          noKpis={!activeKpis?.length}
        />
      )}
      {customizeId && <MetricNoticeBar notice={metrics.notice} onUndo={metrics.undo} onDismiss={metrics.dismiss} />}
    </div>
  );
}
