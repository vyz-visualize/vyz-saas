"use client";

// Dashboard de template com dados de exemplo: a configuração vem do banco e os
// números do gerador de amostra (mesmos para o mesmo nome + cliente). O PDF
// imprime todas as páginas, uma por folha.

import { useEffect, useState } from "react";
import type { Brand } from "@/features/workspace/workspace";
import { saveDashboardMetricPrefs } from "@/server/dashboards/actions";
import { DashboardActions } from "./DashboardActions";
import { DashboardBody, type DashboardSpec } from "./DashboardBody";

type Props = {
  dashboard: DashboardSpec & { id: string };
  brand?: Brand;
  /** Botões do painel (member+). Sem isso, só leitura (link público, viewer). */
  canEdit?: boolean;
  hideSpend?: boolean;
  /** Montagem com scanner (logo depois de gerar). */
  assemble?: boolean;
};

export function SampleDashboard({ dashboard, brand, canEdit, hideSpend, assemble }: Props) {
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
