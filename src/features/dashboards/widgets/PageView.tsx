import type { PageLayout, Span } from "@/features/templates/types";
import type { KpiEdit } from "../metric-prefs-context";
import { Kpi, Widget, type WidgetContext } from "./Widgets";

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
};

/** Uma página do dashboard: linha de KPIs e os widgets abaixo. */
export function PageView({ layout, ctx, variant = "full", kpiEdit }: PageViewProps) {
  const compact = variant === "compact";
  const widgets = compact ? layout.widgets.slice(0, 2) : layout.widgets;
  return (
    <div className="@container space-y-2">
      {layout.kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-2 @[440px]:grid-cols-4">
          {layout.kpis.map((k, i) => (
            <Kpi key={k.metric} spec={k} ctx={ctx} delay={200 + i * 70} onHide={kpiEdit && layout.kpis.length > 1 ? () => kpiEdit.hide(k.metric) : undefined} />
          ))}
        </div>
      )}
      <div className={compact ? "grid gap-2 @[440px]:grid-cols-[1.55fr_1fr]" : "grid grid-cols-1 gap-2 @[460px]:grid-cols-2 @[900px]:grid-cols-4"}>
        {widgets.map((w, i) => (
          <div key={`${w.type}-${i}`} className={compact ? "min-w-0" : `min-w-0 ${SPAN[w.span ?? 2]}`}>
            <Widget spec={w} ctx={ctx} delay={440 + i * 70} />
          </div>
        ))}
      </div>
    </div>
  );
}
