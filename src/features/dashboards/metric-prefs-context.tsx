"use client";

// Estado das métricas de um dashboard: o que está salvo e o rascunho do painel,
// que já aparece na tela. Fechar sem salvar volta ao que estava.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { hideKpi, normalizeScope, parseMetricPrefs, pickColumns, toggleMetric, visibleIds, withScope, type CatalogMetric, type MetricPrefs, type MetricScope, type MetricSection, type ScopePrefs } from "./metric-prefs";

/** Atalhos nos próprios cards. Só existem para quem pode editar. */
export type KpiEdit = { hide: (id: string) => void; add: () => void };

export type MetricVisibility = { kpis: ReadonlySet<string>; columns: ReadonlySet<string>; blockedColumn: (id: string) => boolean; edit?: KpiEdit };

/** Aviso depois de ocultar pelo card: com Desfazer, ou o erro ao salvar. */
export type MetricNotice = { id: number; text: string; before?: MetricPrefs };

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

type Input = {
  dashboardId: string | null;
  scope: MetricScope;
  /** Catálogo do que está na tela (no exemplo, o da aba aberta). */
  catalog: readonly CatalogMetric[];
  /** Cards de cada aba, nos dashboards de exemplo. */
  pageKpis?: readonly (readonly string[])[];
  initial: unknown;
  hideSpend?: boolean;
  saveAction?: SaveMetricPrefs;
};

export function useMetricPrefsState({ dashboardId, scope, catalog, pageKpis, initial, hideSpend, saveAction }: Input) {
  const [saved, setSaved] = useState<MetricPrefs>(() => parseMetricPrefs(initial));
  const [draft, setDraft] = useState<MetricPrefs>(saved);
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<MetricSection>("kpis");
  const [notice, setNotice] = useState<MetricNotice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const current = draft[scope];

  /** Grava sem passar pelo painel. Se falhar, a tela volta ao que estava e avisa. */
  const persist = useCallback(
    async (next: MetricPrefs, rollback: MetricPrefs) => {
      if (!dashboardId || !saveAction) return;
      const failed = (message: string) => {
        setSaved(rollback);
        setDraft(rollback);
        setNotice({ id: Date.now(), text: message });
      };
      try {
        const r = await saveAction(dashboardId, scope, next[scope] ?? {});
        if (!r.ok) failed(r.error.message);
      } catch {
        failed("Não foi possível salvar. Tente de novo.");
      }
    },
    [dashboardId, saveAction, scope],
  );

  const hide = useCallback(
    (id: string) => {
      const next = hideKpi(catalog, scope, saved, id, pageKpis);
      if (!next) return;
      setSaved(next);
      setDraft(next);
      setNotice({ id: Date.now(), text: "Métrica oculta", before: saved });
      void persist(next, saved);
    },
    [catalog, pageKpis, persist, saved, scope],
  );
  const undo = useCallback(() => {
    if (!notice?.before) return;
    setSaved(notice.before);
    setDraft(notice.before);
    setNotice(null);
    void persist(notice.before, saved);
  }, [notice, persist, saved]);
  const dismiss = useCallback(() => setNotice(null), []);
  const openPanel = useCallback((target?: MetricSection) => {
    if (target) setSection(target);
    setNotice(null);
    setOpen(true);
  }, []);
  const add = useCallback(() => openPanel("kpis"), [openPanel]);
  const edit = useMemo<KpiEdit | undefined>(() => (dashboardId && saveAction ? { hide, add } : undefined), [add, dashboardId, hide, saveAction]);

  const visibility = useMemo<MetricVisibility>(
    () => ({
      kpis: new Set(visibleIds(catalog, "kpis", current?.kpis, { hideSpend })),
      columns: new Set(visibleIds(catalog, "columns", current?.columns, { hideSpend })),
      blockedColumn: (id) => !!hideSpend && !!catalog.find((m) => m.id === id)?.spendDerived,
      edit,
    }),
    [catalog, current, edit, hideSpend],
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
    const value = normalizeScope(catalog, draft[scope], pageKpis);
    const r = await saveAction(dashboardId, scope, value);
    setPending(false);
    if (!r.ok) return setError(r.error.message);
    const next = withScope(draft, scope, value);
    setSaved(next);
    setDraft(next);
    setOpen(false);
  }, [catalog, dashboardId, draft, pageKpis, saveAction, scope]);

  return { open, openPanel, close, save, restore, toggle, pending, error, prefs: current, visibility, section, setSection, edit, notice, undo, dismiss };
}
