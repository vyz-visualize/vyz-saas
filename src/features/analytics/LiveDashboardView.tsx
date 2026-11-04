"use client";

// Miolo dos dashboards com dados reais: cabeçalho, abas e a página ativa. Os
// dados já chegam prontos (servidor ou prévia); trocar de aba não consulta nada.

import Link from "next/link";
import { useState, type ComponentType, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/kit";
import { OverflowTabs } from "@/components/ui/OverflowTabs";
import { btn } from "@/components/ui/styles";
import { PLATFORMS } from "@/features/accounts/platforms";
import { GOOGLE_CATALOG, META_CATALOG, type CatalogMetric } from "@/features/dashboards/metric-prefs";
import { MetricVisibilityProvider, useMetricPrefsState, type SaveMetricPrefs } from "@/features/dashboards/metric-prefs-context";
import { MetricNoticeBar } from "@/features/dashboards/MetricActions";
import { CustomizeButton, MetricsPanel } from "@/features/dashboards/MetricsPanel";
import { PAGES } from "@/features/templates/pages";
import type { PageId } from "@/features/templates/types";
import { GoogleCampaigns, GoogleOverview, GoogleProducts, GoogleTerms } from "./google/GooglePages";
import { MetaAudience, MetaCampaigns, MetaCreatives, MetaFunnel, MetaOverview } from "./meta/MetaPages";
import { ddmm, ddmmyyyyIso } from "./ranges";
import type { PageProps } from "./shared";
import type { DashboardView, LiveDashboardData, LivePlatform } from "./types";

/** Páginas que cada dashboard live sabe desenhar, na ordem padrão. */
export const LIVE_PAGES: Record<LivePlatform, Partial<Record<PageId, ComponentType<PageProps>>>> = {
  meta: { "visao-geral": MetaOverview, campanhas: MetaCampaigns, funil: MetaFunnel, criativos: MetaCreatives, publico: MetaAudience },
  google: { "visao-geral": GoogleOverview, campanhas: GoogleCampaigns, termos: GoogleTerms, produtos: GoogleProducts },
};

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
};

const CATALOG: Record<LivePlatform, readonly CatalogMetric[]> = { meta: META_CATALOG, google: GOOGLE_CATALOG };

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

/** A única aba com fileira de cards nos dashboards com dados reais. */
const KPI_PAGE: PageId = "visao-geral";

export function LiveDashboardView({ data, pageIds, initialPage, actions, toolbar, logo, metricPrefs, canCustomize = false, saveMetrics }: LiveDashboardViewProps) {
  const metrics = useMetricPrefsState({ dashboardId: data.dashboard.id, scope: data.platform, catalog: CATALOG[data.platform], initial: metricPrefs, hideSpend: data.hideSpend, saveAction: saveMetrics });
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

  return (
    <div className="@container space-y-4">
      <header className="flex items-start justify-between gap-4 overflow-x-clip [overflow-clip-margin:4px]">
        {logo && <div className="hidden shrink-0 pt-1.5 @[500px]:block">{logo}</div>}
        <div className="min-w-0 flex-1">
          <h1 className="title truncate text-[1.55rem]">{data.dashboard.name}</h1>
          {data.dashboard.clientName && <p className="text-[14px] text-fg-2">{data.dashboard.clientName}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px]">
            <span className="rounded-chip border border-line px-2 py-0.5 text-fg-2">{PLATFORMS[data.platform].name}</span>
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

      <OverflowTabs label="Páginas do dashboard" value={active} onChange={setPage} items={pages.map((p) => ({ value: p, label: PAGES[p]?.name ?? p }))} />

      {(toolbar || canCustomize) && (
        <div className="flex flex-wrap items-end gap-2">
          {toolbar}
          {canCustomize && (
            <div className="ml-auto">
              <CustomizeButton onClick={() => metrics.openPanel()} />
            </div>
          )}
        </div>
      )}

      <p className="flex flex-wrap gap-x-2 text-[12.5px] text-fg-2">
        <span className="tnum">
          {ddmm(data.current.from)} a {ddmmyyyyIso(data.current.to)} · {data.current.days} {data.current.days === 1 ? "dia" : "dias"}, comparado com {ddmm(data.previous.from)} a {ddmm(data.previous.to)}
        </span>
        {data.maturingFrom && <span>· a partir de {ddmm(data.maturingFrom)} as conversões ainda estão chegando (em maturação)</span>}
        {last && !data.sample && <span>· atualizado em {syncedAt(last, data.timeZone)}</span>}
      </p>

      <div role="tabpanel" id={panelId} aria-label={PAGES[active]?.name ?? active}>
        {data.status === "no_accounts" ? (
          <EmptyState
            title="Nenhuma conta ativa neste dashboard"
            text={`Ative uma conta do ${PLATFORMS[data.platform].name} e ligue ao dashboard para ver os números.`}
            action={
              <Link href="/painel/contas" className={btn.small}>
                Ir para Contas
              </Link>
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
      {canCustomize && (
        <MetricsPanel
          open={metrics.open}
          onClose={metrics.close}
          catalog={metrics.catalog}
          prefs={metrics.prefs}
          hasData={(id) => liveHasData(data.view, id)}
          onToggle={metrics.toggle}
          onRestore={metrics.restore}
          onSave={metrics.save}
          pending={metrics.pending}
          error={metrics.error}
          visibleKpis={[...metrics.visibility.kpis]}
          kpiPlace={active === KPI_PAGE ? undefined : `na ${PAGES[KPI_PAGE]?.name ?? "Visão geral"}`}
          noKpis={!pages.includes(KPI_PAGE)}
        />
      )}
      {canCustomize && <MetricNoticeBar notice={metrics.notice} onUndo={metrics.undo} onDismiss={metrics.dismiss} />}
    </div>
  );
}

/** Erro amigável (o detalhe fica no log do servidor). */
export function LiveDashboardError({ message }: { message: string }) {
  return <EmptyState title="Não foi possível abrir o dashboard" text={message} />;
}
