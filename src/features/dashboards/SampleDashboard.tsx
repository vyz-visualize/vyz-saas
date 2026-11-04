"use client";

// Dashboard de template com dados de exemplo: a configuração vem do banco e os
// números do gerador de amostra (mesmos para o mesmo nome + cliente). O PDF
// imprime todas as páginas, uma por folha.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { CreativesData } from "@/features/analytics/types";
import type { PageId } from "@/features/templates/types";
import type { Brand } from "@/features/workspace/workspace";
import { saveDashboardMetricPrefs } from "@/server/dashboards/actions";
import { DashboardActions } from "./DashboardActions";
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
  /** Modelos que usam a Meta: a página de Criativos por plano. */
  creatives?: CreativesData;
  initialPage?: PageId;
};

export function SampleDashboard({ dashboard, brand, canEdit, hideSpend, assemble, creatives, initialPage }: Props) {
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
      hideSpend={hideSpend}
      assemble={assemble}
      printing={printing}
      creatives={creatives}
      initialPage={initialPage}
      onPeriodChange={
        creatives
          ? (period, customDays) => {
              const q = new URLSearchParams(params?.toString() ?? "");
              q.delete("periodo");
              q.delete("dias");
              const rest = q.toString();
              router.push(`${pathname}?${periodQuery({ period, customDays })}${rest ? `&${rest}` : ""}`, { scroll: false });
            }
          : undefined
      }
      customizeId={canEdit ? dashboard.id : undefined}
      saveMetrics={canEdit ? saveDashboardMetricPrefs : undefined}
      actions={
        canEdit ? (
          <DashboardActions dashboard={{ id: dashboard.id, name: dashboard.name, live: false }} period={dashboard.settings.period} pages={dashboard.pages.length} onExport={() => setPrinting(true)} />
        ) : undefined
      }
    />
  );
}
