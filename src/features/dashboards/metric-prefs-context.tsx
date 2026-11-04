"use client";

// Estado das métricas de um dashboard: o que está salvo e o rascunho do painel,
// que já aparece na tela. Fechar sem salvar volta ao que estava.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { normalizeScope, parseMetricPrefs, pickColumns, toggleMetric, visibleIds, withScope, type CatalogMetric, type MetricPrefs, type MetricScope, type MetricSection, type ScopePrefs } from "./metric-prefs";

export type MetricVisibility = { kpis: ReadonlySet<string>; columns: ReadonlySet<string>; blockedColumn: (id: string) => boolean };

const Ctx = createContext<MetricVisibility | null>(null);

export function MetricVisibilityProvider({ value, children }: { value: MetricVisibility; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useMetricVisibility = () => useContext(Ctx);

/** Tira da tabela as colunas ocultas. Fora do contexto (prévias), mostra todas. */
export function useVisibleColumns<T extends { metric?: string }>(columns: readonly T[]): readonly T[] {
  const v = useMetricVisibility();
  return v ? pickColumns(columns, v.columns, v.blockedColumn) : columns;
}

/** A coluna aparece? Para tabelas que não usam DataTable. */
export const useColumnVisible = (id: string) => {
  const v = useMetricVisibility();
  return v ? v.columns.has(id) : true;
};

/** A ação de salvar vem de quem renderiza: as tabelas usam este arquivo e não podem puxar código de servidor. */
export type SaveMetricPrefs = (dashboardId: string, scope: MetricScope, value: ScopePrefs) => Promise<{ ok: true } | { ok: false; error: { message: string } }>;

type Input = { dashboardId: string | null; scope: MetricScope; catalog: readonly CatalogMetric[]; initial: unknown; hideSpend?: boolean; saveAction?: SaveMetricPrefs };

export function useMetricPrefsState({ dashboardId, scope, catalog, initial, hideSpend, saveAction }: Input) {
  const [saved, setSaved] = useState<MetricPrefs>(() => parseMetricPrefs(initial));
  const [draft, setDraft] = useState<MetricPrefs>(saved);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const current = draft[scope];

  const visibility = useMemo<MetricVisibility>(
    () => ({
      kpis: new Set(visibleIds(catalog, "kpis", current?.kpis, { hideSpend })),
      columns: new Set(visibleIds(catalog, "columns", current?.columns, { hideSpend })),
      blockedColumn: (id) => !!hideSpend && !!catalog.find((m) => m.id === id)?.spendDerived,
    }),
    [catalog, current, hideSpend],
  );

  const toggle = useCallback(
    (section: MetricSection, id: string) => setDraft((d) => withScope(d, scope, { ...d[scope], [section]: toggleMetric(catalog, section, d[scope]?.[section], id) })),
    [catalog, scope],
  );
  const restore = useCallback(() => setDraft((d) => withScope(d, scope, {})), [scope]);
  const close = useCallback(() => {
    setDraft(saved);
    setError(null);
    setOpen(false);
  }, [saved]);
  const save = useCallback(async () => {
    if (!dashboardId || !saveAction) return;
    setPending(true);
    setError(null);
    const value = normalizeScope(catalog, draft[scope]);
    const r = await saveAction(dashboardId, scope, value);
    setPending(false);
    if (!r.ok) return setError(r.error.message);
    const next = withScope(draft, scope, value);
    setSaved(next);
    setDraft(next);
    setOpen(false);
  }, [catalog, dashboardId, draft, saveAction, scope]);

  return { open, setOpen, close, save, restore, toggle, pending, error, prefs: current, visibility };
}
