import type { PageLayout, Span } from "@/features/templates/types";
import { KPI_GRID, kpiSpans } from "./kpi-grid";
import type { KpiEdit } from "../metric-prefs-context";
import type { SampleExtraMetric } from "@/features/analytics/types";
import { EmptySlots, useKpiDropRow, useMetricEditor } from "../metric-edit-context";
import { ExtraKpi, Kpi, Widget, type WidgetContext } from "./Widgets";

// Grid por container query: 1 coluna no estreito, 2 no médio e 4 no largo.
const SPAN: Record<Span, string> = {
  1: "",
  2: "@[460px]:col-span-2",
  3: "@[460px]:col-span-2 @[900px]:col-span-3",
  4: "@[460px]:col-span-2 @[900px]:col-span-4",
};

type PageViewProps = {
  layout: PageLayout;
  ctx: WidgetContext;
  /** "compact": KPIs + os dois primeiros widgets lado a lado (LP e miniaturas). */
  variant?: "full" | "compact";
  /** Atalhos nos cards (só para quem pode editar). */
  kpiEdit?: KpiEdit;
  /** Métricas novas ligadas no Personalizar, depois dos cards do modelo. */
  extraCards?: readonly SampleExtraMetric[];
};

/** Uma página do dashboard: linha de KPIs e os widgets abaixo. */
export function PageView({ layout, ctx, variant = "full", kpiEdit, extraCards = [] }: PageViewProps) {
  const cards = layout.kpis.length + extraCards.length;
  const editor = useMetricEditor();
  const editingCards = editor?.section === "kpis" && !!kpiEdit;
  const drop = useKpiDropRow();
  const hide = (id: string) => (!editor && kpiEdit && cards > 1 ? () => kpiEdit.hide(id) : undefined);
  const remove = (id: string) => (editingCards && editor.canRemoveKpi ? () => editor.removeKpi(id) : undefined);
  const compact = variant === "compact";
  const spans = kpiSpans(cards);
  const widgets = compact ? layout.widgets.slice(0, 2) : layout.widgets;
  return (
    <div data-dim-scope className="@container space-y-2">
      {cards > 0 && (
        // sem buraco: as fileiras se dividem por igual (6 cards = 3 + 3); no Personalizar, a grade de 4 com as vagas
        <div className={editingCards ? "grid grid-cols-2 gap-2 relative @[440px]:grid-cols-4" : KPI_GRID} data-kpi-row {...drop.props}>
          {layout.kpis.map((k, i) => (
            <div key={k.metric} className={`min-w-0 [&>*]:h-full ${editingCards ? "" : spans[i]}`}>
              <Kpi spec={k} ctx={ctx} delay={200 + i * 70} onHide={hide(k.metric)} onRemove={remove(k.metric)} />
            </div>
          ))}
          {extraCards.map((m, i) => (
            <div key={m.id} className={`min-w-0 [&>*]:h-full ${editingCards ? "" : spans[layout.kpis.length + i]}`}>
              <ExtraKpi m={m} ctx={ctx} delay={200 + (layout.kpis.length + i) * 70} onHide={hide(m.id)} onRemove={remove(m.id)} />
            </div>
          ))}
          {editingCards && <EmptySlots count={editor.slots - cards} onClick={editor.openTray} />}
          {drop.overlay}
        </div>
      )}
      {widgets.length > 0 && (
        <div className={compact ? "grid gap-2 @[440px]:grid-cols-[1.55fr_1fr]" : "grid grid-cols-1 gap-2 @[460px]:grid-cols-2 @[900px]:grid-cols-4"}>
          {widgets.map((w, i) => (
            <div key={`${w.type}-${i}`} className={compact ? "min-w-0" : `min-w-0 ${SPAN[w.span ?? 2]}`}>
              <Widget spec={w} ctx={ctx} delay={440 + i * 70} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
