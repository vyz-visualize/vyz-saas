"use client";

// Filtros da demonstração: a mesma regra e o mesmo contexto dos dashboards (clicar,
// Cmd/Ctrl, chips, destaque), mas só na memória. No site, a URL não muda.

import { useCallback, useMemo, useState } from "react";
import type { FilterApi, FilterModifiers } from "@/features/analytics/filter-context";
import { comparedDays, DIM_LABEL, NO_FILTERS, rangeLabel, removeFilter, toggleDays, toggleFilter, type DashFilters, type DayRange, type FilterDim, type FilterLabels } from "@/features/analytics/filters";

export function useLocalFilters(labels: FilterLabels, periodDays: number, onChange?: (next: DashFilters) => void): FilterApi {
  const [filters, setFilters] = useState<DashFilters>(NO_FILTERS);
  const [announcement, setAnnouncement] = useState("");

  const apply = useCallback(
    (next: DashFilters, message: string) => {
      setFilters(next);
      setAnnouncement(message);
      onChange?.(next);
    },
    [onChange],
  );

  const toggle = useCallback(
    (dim: FilterDim, id: string, name: string, e?: FilterModifiers) => {
      const next = toggleFilter(filters, dim, id, !!(e?.metaKey || e?.ctrlKey));
      apply(next, next[dim].includes(id) ? `Filtro aplicado: ${DIM_LABEL[dim]} ${name}` : `Filtro removido: ${DIM_LABEL[dim]} ${name}`);
    },
    [apply, filters],
  );
  const selectDays = useCallback(
    (days: DayRange | null) => {
      const next = toggleDays(filters, days);
      apply(next, next.days ? `Filtro aplicado: Dias ${rangeLabel(next.days)}` : "Filtro de dias removido");
    },
    [apply, filters],
  );
  const remove = useCallback((dim: FilterDim | "days", id?: string) => apply(removeFilter(filters, dim, id), `Filtro removido: ${DIM_LABEL[dim]}`), [apply, filters]);
  const clear = useCallback(() => apply(NO_FILTERS, "Filtros limpos"), [apply]);

  return useMemo(
    () => ({ filters, labels, compared: filters.days ? comparedDays(filters.days, periodDays) : null, interactive: true, pending: false, announcement, toggle, selectDays, remove, clear }),
    [announcement, clear, filters, labels, periodDays, remove, selectDays, toggle],
  );
}
