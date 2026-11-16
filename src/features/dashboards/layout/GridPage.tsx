"use client";

// Uma aba do dashboard na grade: os blocos do template (cards de KPI e widgets) e os
// cards de métrica por plataforma, na disposição salva. No modo Personalizar, a grade
// mostra as casinhas e aceita arrastar.

import type { PlatformId } from "@/features/accounts/platforms";
import type { SampleExtraMetric } from "@/features/analytics/types";
import {
  isSalesProfile,
  metric as metricDef,
  type MetricId,
} from "@/features/metrics/definitions";
import type {
  PageId,
  PageLayout,
  WidgetSpec,
} from "@/features/templates/types";
import type { KpiEdit } from "../metric-prefs-context";
import { PageView } from "../widgets/PageView";
import { Widget, type WidgetContext } from "../widgets/Widgets";
import { GridCanvas, type Block } from "./GridCanvas";
import { PlatformMetricCard } from "./LayoutEditor";
import { customSize, customSpec, customTitle, trendOptions } from "./custom-blocks";
import { KPIS_ID, parseMetricCardId, widgetId } from "./model";
import { platformLabel } from "./platform-metrics";
import type { DashboardLayoutState } from "./useDashboardLayout";

const WIDGET_LABEL: Record<WidgetSpec["type"], string> = {
  line: "Gráfico por dia",
  trend: "Desempenho diário",
  ranking: "Ranking de campanhas",
  rank: "Ranking",
  breakdown: "Quebra",
  searchTerms: "Termos de pesquisa",
  videos: "Retenção dos vídeos",
  funnel: "Funil",
  bars: "Barras",
  scatter: "Dispersão",
  split: "Atribuição por plataforma",
  platforms: "Por plataforma",
  table: "Tabela",
  creatives: "Criativos",
  goals: "Metas",
  audience: "Público",
  compare: "Comparativo",
  crm: "CRM",
  alerts: "Alertas",
  audio: "Áudio",
};

type Props = {
  page: PageId;
  layout: PageLayout;
  ctx: WidgetContext;
  kpiEdit?: KpiEdit;
  extraCards?: readonly SampleExtraMetric[];
  grid: DashboardLayoutState;
  editing?: boolean;
  /** Encaixa a aba na altura da tela (sem rolar a página). */
  fit?: boolean;
};

export function GridPage({
  page,
  layout,
  ctx,
  kpiEdit,
  extraCards = [],
  grid,
  editing,
  fit,
}: Props) {
  const kpiCount = layout.kpis.length + extraCards.length;
  const items = grid.items(page);

  const templateBlocks = templateBlocksOf(layout, kpiCount);
  const blocks: Record<string, Block> = {};
  if (kpiCount)
    blocks[KPIS_ID] = {
      label: templateBlocks[0].label,
      node: (
        <PageView
          layout={{ kpis: layout.kpis, widgets: [] }}
          ctx={ctx}
          kpiEdit={kpiEdit}
          extraCards={extraCards}
          strip
        />
      ),
    };
  layout.widgets.forEach((w, i) => {
    blocks[widgetId(i)] = {
      label: w.title ?? WIDGET_LABEL[w.type],
      node: <Widget spec={w} ctx={ctx} delay={440 + i * 70} />,
    };
  });
  for (const it of items) {
    // bloco pedido no editor: o id diz o que ele é; o nome é o que a pessoa deu (ou o do pedido)
    const custom = customSpec(it.id);
    if (custom) {
      const title = it.title ?? customTitle(custom, ctx.profile);
      const spec = custom.type === "trend" ? { ...custom, metrics: trendOptions(custom.metrics[0], isSalesProfile(ctx.profile)) } : custom;
      blocks[it.id] = { label: title, node: <Widget spec={{ ...spec, title }} ctx={ctx} delay={440} /> };
      continue;
    }
    const m = parseMetricCardId(it.id);
    if (m)
      blocks[it.id] = {
        label: `${metricDef(m.metric as MetricId, ctx.profile).label} · ${platformLabel(m.platform as PlatformId)}`,
        node: (
          <PlatformMetricCard
            id={it.id}
            ds={ctx.ds}
            profile={ctx.profile}
            compare={ctx.compare}
          />
        ),
      };
  }

  const canvas = (
    <GridCanvas
      items={items}
      blocks={blocks}
      editing={editing}
      fit={fit}
      contain
      kpiCount={kpiCount}
      onChange={(g) => grid.change(page, g)}
      onHide={(id) => grid.hide(page, id)}
      onDropNew={(id, x, y) => grid.add(page, id, { x, y }, kpiCount)}
      canDrop={(id) => grid.accepts(page, id)}
      sizeOf={(id) => {
        if (id.startsWith("m:") || id === "_incoming") return { w: 3, h: 4 };
        const custom = customSpec(id);
        if (custom) return customSize(custom);
        return grid.base(page).find((b) => b.id === id) ?? { w: 6, h: 8 };
      }}
    />
  );

  return canvas;
}

/** Blocos do modelo nesta aba, com o nome que aparece na grade e na bandeja. */
export function templateBlocksOf(
  layout: PageLayout,
  kpiCount: number,
): { id: string; label: string }[] {
  return [
    ...(kpiCount ? [{ id: KPIS_ID, label: `Cards de KPI (${kpiCount})` }] : []),
    ...layout.widgets.map((w, i) => ({
      id: widgetId(i),
      label: w.title ?? WIDGET_LABEL[w.type],
    })),
  ];
}
