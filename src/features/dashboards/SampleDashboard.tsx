"use client";

// Dashboard de template com dados de exemplo: a configuração vem do banco e os
// números do gerador de amostra (mesmos para o mesmo nome + cliente). O PDF
// imprime todas as páginas, uma por folha.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { DashFilters } from "@/features/analytics/filters";
import type { CreativesData, SampleExtraMetric } from "@/features/analytics/types";
import type { PageId } from "@/features/templates/types";
import type { Brand } from "@/features/workspace/workspace";
import { saveDashboardLayout, saveDashboardMetricPrefs } from "@/server/dashboards/actions";
import { DashboardActions } from "./DashboardActions";
import type { Dataset } from "@/features/metrics/source";
import type { SourceExtras } from "./SourcePages";
import { DashboardBody, type DashboardSpec } from "./DashboardBody";
import { periodQuery } from "./model";

type Props = {
  dashboard: DashboardSpec & { id: string };
  brand?: Brand;
  /** Botões do painel (member+). Sem isso, só leitura (link público, viewer). */
  canEdit?: boolean;
  hideSpend?: boolean;
  /** Montagem com scanner (logo depois de gerar). */
  assemble?: boolean;
  /** Mover e redimensionar blocos no Personalizar (Avançado). */
  canArrange?: boolean;
  /** Modelos que usam a Meta: a página de Criativos por plano. */
  creatives?: CreativesData;
  /** Métricas novas do Personalizar, na escala do modelo. */
  extraMetrics?: readonly SampleExtraMetric[];
  initialPage?: PageId;
  /** Filtros que vieram na URL. */
  initialFilters?: DashFilters;
  /** No painel: para onde o voltar leva (o modelo com visual próprio toma a tela toda e traz o voltar nele). */
  backHref?: string;
  /** Dados reais das contas ligadas: trocar o período navega e o servidor lê de novo. */
  realData?: Dataset;
  /** GA4 e orgânico reais (modelos novos). */
  sourceExtras?: SourceExtras;
};

export function SampleDashboard({ dashboard, brand, canEdit, canArrange, hideSpend, assemble, creatives, extraMetrics, initialPage, initialFilters, backHref, realData, sourceExtras }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done, { once: true });
    // espera os gráficos medirem a largura do A4 (ResizeObserver + 1 quadro)
    const t = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);

  return (
    <DashboardBody
      spec={{ ...dashboard, brand }}
      dataset={realData}
      sourceExtras={sourceExtras}
      hideSpend={hideSpend}
      assemble={assemble}
      printing={printing}
      creatives={creatives}
      extraMetrics={extraMetrics}
      initialPage={initialPage}
      initialFilters={initialFilters}
      backHref={backHref}
      onFilterNavigate={creatives || extraMetrics?.length || realData ? (search) => router.replace(`${pathname}${search}`, { scroll: false }) : undefined}
      onPeriodChange={
        creatives || extraMetrics?.length || realData
          ? (period, customDays) => {
              const q = new URLSearchParams(params?.toString() ?? "");
              q.delete("periodo");
              q.delete("dias");
              q.delete("de");
              q.delete("ate");
              const rest = q.toString();
              router.push(`${pathname}?${periodQuery({ period, customDays })}${rest ? `&${rest}` : ""}`, { scroll: false });
            }
          : undefined
      }
      customizeId={canEdit ? dashboard.id : undefined}
      saveMetrics={canEdit ? saveDashboardMetricPrefs : undefined}
      saveLayout={canEdit ? saveDashboardLayout : undefined}
      canArrange={canEdit && canArrange}
      actions={
        canEdit ? (
          <DashboardActions dashboard={{ id: dashboard.id, name: dashboard.name, live: false }} period={dashboard.settings.period} pages={dashboard.pages.length} onExport={() => setPrinting(true)} />
        ) : undefined
      }
    />
  );
}
