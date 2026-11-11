"use client";

// Disposição das abas do dashboard: a salva e os rascunhos do modo Personalizar (um
// por aba mexida). Vai junto com as métricas: o Personalizar salva, cancela e
// restaura as duas coisas de uma vez (ver companion em useMetricPrefsState).

import { useCallback, useMemo, useState } from "react";
import type { PageId, PageLayout } from "@/features/templates/types";
import { compact, defaultGrid, firstFree, kindOf, limitsOf, normalizeGrid, place, sameGrid, type DashboardLayout, type PageGrid } from "./model";

export type SaveLayout = (page: PageId, items: PageGrid | null) => Promise<{ ok: true } | { ok: false; error: { message: string } }>;

type Input = {
  initial?: DashboardLayout;
  pages: readonly PageId[];
  templateOf: (p: PageId) => PageLayout;
  accept: (p: PageId) => (id: string) => boolean;
  /** Disposição do template na aba (sem isso, a da linha de KPIs e widgets). */
  baseOf?: (p: PageId) => PageGrid;
  save?: SaveLayout;
  /** Pode mover e redimensionar (Avançado). Sem isso, métricas entram no próximo espaço livre. */
  arrange?: boolean;
};

export function useDashboardLayout({ initial, pages, templateOf, accept, baseOf, save, arrange = true }: Input) {
  const [saved, setSaved] = useState<DashboardLayout>(initial ?? {});
  const [drafts, setDrafts] = useState<Partial<Record<PageId, PageGrid>>>({});

  const base = useCallback((p: PageId) => (baseOf ? baseOf(p) : defaultGrid(templateOf(p))), [baseOf, templateOf]);
  const current = useCallback(
    (p: PageId) => {
      const g = normalizeGrid(saved[p], accept(p), templateOf(p).kpis.length);
      return g.length ? g : base(p);
    },
    [accept, base, saved, templateOf],
  );
  const items = useCallback((p: PageId) => drafts[p] ?? current(p), [current, drafts]);
  const update = useCallback((p: PageId, f: (g: PageGrid) => PageGrid) => setDrafts((d) => ({ ...d, [p]: f(d[p] ?? current(p)) })), [current]);

  const changed = useMemo(() => (Object.entries(drafts) as [PageId, PageGrid][]).filter(([p, g]) => !sameGrid(g, current(p))), [current, drafts]);

  return {
    items,
    base,
    isDefault: (p: PageId) => sameGrid(items(p), base(p)),
    /** A aba aceita este bloco (do modelo, do visual ou métrica de uma plataforma dela)? */
    accepts: (p: PageId, id: string) => accept(p)(id),
    change: (p: PageId, g: PageGrid) => update(p, () => g),
    hide: (p: PageId, id: string) => update(p, (g) => (arrange ? compact(g.filter((i) => i.id !== id)) : g.filter((i) => i.id !== id))),
    add: (p: PageId, id: string, at?: { x: number; y: number }, kpiCount = 4) =>
      update(p, (g) => {
        if (g.some((i) => i.id === id)) return g;
        const size = kindOf(id) === "metric" ? { w: 3, h: 4 } : (base(p).find((b) => b.id === id) ?? { w: 6, h: limitsOf(id, kpiCount).minH });
        if (!arrange) return [...g, { id, ...firstFree(g, size.w, size.h), w: size.w, h: size.h }];
        return compact(place(g, { id, ...(at ?? firstFree(g, size.w, size.h)), w: size.w, h: size.h }));
      }),
    /** O que o Personalizar usa junto com as métricas. */
    companion: {
      dirty: changed.length > 0,
      reset: () => setDrafts({}),
      restore: () => setDrafts(Object.fromEntries(pages.map((p) => [p, base(p)]))),
      /** Grava as abas mexidas; devolve a mensagem de erro, se houver. */
      save: async (): Promise<string | null> => {
        if (!save || changed.length === 0) return null;
        const next = { ...saved };
        for (const [p, g] of changed) {
          const value = sameGrid(g, base(p)) ? null : g;
          const r = await save(p, value);
          if (!r.ok) return r.error.message;
          if (value) next[p] = value;
          else delete next[p];
        }
        setSaved(next);
        setDrafts({});
        return null;
      },
    },
  };
}

export type DashboardLayoutState = ReturnType<typeof useDashboardLayout>;
