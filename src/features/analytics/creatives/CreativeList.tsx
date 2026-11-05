"use client";

// Lista simples de criativos (todos os planos): nome, campanha, investimento e o
// resultado principal do objetivo. Serve também ao PDF.

import { int } from "@/lib/format";
import { useDashFilters } from "../filter-context";
import { hasFilters } from "../filters";
import { moneyCompact } from "../format";
import type { CreativeListVM } from "../types";
import { Chip, DataTable, NoData, Panel, type Column } from "../ui";

export function CreativeList({ rows, currency, hideSpend }: { rows: CreativeListVM[]; currency: string; hideSpend: boolean }) {
  const filters = useDashFilters();
  const filtered = !!filters && hasFilters(filters.filters);
  if (!rows.length) return <NoData text={filtered ? "Nenhum anúncio com esses filtros." : "Nenhum anúncio veiculou no período."} />;
  const columns: Column<CreativeListVM>[] = [
    {
      key: "name",
      label: "Anúncio",
      sort: (r) => r.name,
      render: (r) => (
        <span className="block min-w-0 py-0.5 whitespace-normal">
          <span className="flex flex-wrap items-center gap-1.5 font-medium text-fg">
            <span className="min-w-0 [overflow-wrap:anywhere]">{r.name}</span>
            {r.status !== "active" && <Chip>{r.status === "paused" ? "Pausado" : r.status}</Chip>}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-fg-2 [overflow-wrap:anywhere]">{r.campaignName}</span>
        </span>
      ),
    },
    ...(hideSpend ? [] : [{ key: "spend", label: "Investimento", align: "right" as const, sort: (r: CreativeListVM) => r.spend, render: (r: CreativeListVM) => moneyCompact(r.spend, currency) }]),
    {
      key: "result",
      label: "Resultado",
      align: "right",
      sort: (r) => r.result.value,
      render: (r) => (
        <span className="block whitespace-normal">
          <span className="font-semibold text-fg">{r.result.value == null ? "—" : int(r.result.value)}</span> <span className="text-[11.5px] text-fg-2">{r.result.label}</span>
        </span>
      ),
    },
  ];
  return (
    <Panel title="Criativos do período" subtitle={`${rows.length} anúncios com entrega`}>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} rowFilter={{ dim: "ads", id: (r) => r.id, name: (r) => r.name }} caption="Criativos do período" initialSort={{ key: hideSpend ? "result" : "spend", dir: "desc" }} minWidth={0} />
    </Panel>
  );
}
