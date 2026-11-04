"use client";

// Dashboard interativo na tela: o estado dos filtros, a barra "Filtros ativos", o selo
// "não filtrado por" e os avisos. Sem este contexto (landing page, prévias, miniaturas)
// nada é clicável e tudo fica como sempre foi.

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { afterLeaveGuard } from "@/features/dashboards/metric-edit-context";
import {
  comparedDays,
  DIM_LABEL,
  filterSearch,
  filtersKey,
  hasFilters,
  NO_FILTERS,
  notFilteredDims,
  notFilteredText,
  rangeLabel,
  removeFilter,
  toggleDays,
  toggleFilter,
  type DashFilters,
  type DayRange,
  type FilterDim,
  type FilterLabels,
  type FilterSection,
} from "./filters";

export type FilterModifiers = { metaKey?: boolean; ctrlKey?: boolean };

export type FilterApi = {
  filters: DashFilters;
  labels: FilterLabels;
  /** Trecho comparado, para o rótulo "vs 10–15/09". */
  compared: DayRange | null;
  /** Desligado no modo personalizar. */
  interactive: boolean;
  /** Esperando o servidor refazer a conta. */
  pending: boolean;
  announcement: string;
  toggle: (dim: FilterDim, id: string, name: string, e?: FilterModifiers) => void;
  selectDays: (days: DayRange | null) => void;
  remove: (dim: FilterDim | "days", id?: string) => void;
  clear: () => void;
};

const Ctx = createContext<FilterApi | null>(null);

export const FilterProvider = ({ value, children }: { value: FilterApi | null; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useDashFilters = () => useContext(Ctx);

type StateInput = {
  /** O que a URL ou o servidor trouxe. */
  initial: DashFilters;
  labels?: FilterLabels;
  /** Dias do período, para achar o trecho comparado. */
  periodDays: number;
  /** Os números dependem do servidor: troca a URL navegando. Sem isso, só atualiza o endereço. */
  navigate?: (search: string) => void;
  /** Modo personalizar: suspende os filtros e devolve ao sair. */
  suspended?: boolean;
};

export function useFilterState({ initial, labels = {}, periodDays, navigate, suspended = false }: StateInput): FilterApi {
  const [filters, setFilters] = useState(initial);
  const [announcement, setAnnouncement] = useState("");
  const [pending, start] = useTransition();
  // o nome de quem foi clicado, até o servidor devolver o dele
  const [names, setNames] = useState<FilterLabels>({});

  // o servidor pode descartar o que não vale (item de outra conta, dia fora do período)
  const key = filtersKey(initial);
  const [seen, setSeen] = useState(key);
  if (key !== seen && !pending) {
    setSeen(key);
    setFilters(initial);
  }

  // quem monta pode passar uma função nova a cada desenho: o que vale é a mais recente
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  const apply = useCallback((next: DashFilters, message?: string) => {
    setFilters(next);
    if (message) setAnnouncement(message);
    const search = filterSearch(window.location.search, next);
    const go = navigateRef.current;
    if (go) start(() => go(search));
    else window.history.replaceState(null, "", `${window.location.pathname}${search}`);
  }, []);

  // modo personalizar: os números voltam ao total; ao sair, os filtros voltam
  const saved = useRef<DashFilters | null>(null);
  const current = useRef(filters);
  useEffect(() => {
    current.current = filters;
  });
  useEffect(() => {
    if (suspended) {
      saved.current = current.current;
      if (hasFilters(current.current)) apply(NO_FILTERS);
      return;
    }
    const back = saved.current;
    saved.current = null;
    if (back && hasFilters(back)) afterLeaveGuard(() => apply(back));
  }, [apply, suspended]);

  const merged = useMemo<FilterLabels>(
    () => ({
      campaigns: { ...names.campaigns, ...labels.campaigns },
      ads: { ...names.ads, ...labels.ads },
      platforms: { ...names.platforms, ...labels.platforms },
    }),
    [labels, names],
  );

  const toggle = useCallback(
    (dim: FilterDim, id: string, name: string, e?: FilterModifiers) => {
      setNames((n) => ({ ...n, [dim]: { ...n[dim], [id]: name } }));
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

  const remove = useCallback(
    (dim: FilterDim | "days", id?: string) => {
      const name = dim === "days" ? "" : (merged[dim]?.[id ?? ""] ?? "");
      apply(removeFilter(filters, dim, id), `Filtro removido: ${DIM_LABEL[dim]} ${name}`.trim());
    },
    [apply, filters, merged],
  );

  const clear = useCallback(() => apply(NO_FILTERS, "Filtros limpos"), [apply]);

  return {
    filters,
    labels: merged,
    compared: filters.days ? comparedDays(filters.days, periodDays) : null,
    interactive: !suspended,
    pending,
    announcement,
    toggle,
    selectDays,
    remove,
    clear,
  };
}

/** Destaque de um item na visualização: o escolhido em evidência, os outros esmaecidos. */
export function filterTone(api: FilterApi | null, dim: FilterDim, id: string): "selected" | "dimmed" | null {
  if (!api?.filters[dim].length) return null;
  return api.filters[dim].includes(id) ? "selected" : "dimmed";
}

const WORD: Record<FilterDim, string> = { campaigns: "campanha", ads: "anúncio", platforms: "plataforma" };

export const filterAria = (dim: FilterDim, name: string) => `Filtrar por ${WORD[dim]} ${name}`;

/** O que chips, PDF e assistente mostram. */
export function chipsOf(f: DashFilters, labels: FilterLabels, compared: DayRange | null): { dim: FilterDim | "days"; id?: string; text: string; name: string }[] {
  const chips: { dim: FilterDim | "days"; id?: string; text: string; name: string }[] = [];
  for (const dim of ["campaigns", "ads", "platforms"] as const) {
    for (const id of f[dim]) {
      const name = labels[dim]?.[id] ?? id;
      chips.push({ dim, id, name, text: `${DIM_LABEL[dim]}: ${name}` });
    }
  }
  if (f.days) {
    const text = rangeLabel(f.days);
    chips.push({ dim: "days", name: text, text: `Dias: ${text}${compared ? ` · vs ${rangeLabel(compared)}` : ""}` });
  }
  return chips;
}

/** Barra logo abaixo do período: um chip por filtro. Some quando não há filtro. */
export function FilterBar({ compare = true }: { compare?: boolean }) {
  const api = useDashFilters();
  if (!api) return null;
  const { filters, labels, compared, interactive, remove, clear, pending, announcement } = api;
  const chips = interactive ? chipsOf(filters, labels, compare ? compared : null) : [];
  return (
    <>
      <p aria-live="polite" className="sr-only print:hidden">
        {announcement}
      </p>
      {chips.length > 0 && (
        <div data-filter-bar role="group" aria-label="Filtros ativos" aria-busy={pending} className="flex flex-wrap items-center gap-1.5 rounded-card border border-line bg-card px-3 py-2">
          <span className="mr-1 text-[12.5px] font-semibold whitespace-nowrap text-fg">Filtros ativos</span>
          {chips.map((c) => (
            <span key={`${c.dim}:${c.id ?? ""}`} data-filter-chip className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-chip bg-accent-soft py-0.5 pr-1 pl-2.5 text-[12.5px] text-fg">
              <span className="min-w-0 truncate" title={c.text}>
                {c.text}
              </span>
              <button type="button" onClick={() => remove(c.dim, c.id)} aria-label={`Remover filtro ${c.text}`} className="inline-flex size-5 shrink-0 items-center justify-center rounded-full outline-none hover:bg-fg/10 focus-visible:ring-2 focus-visible:ring-accent print:hidden">
                <X size={12} aria-hidden />
              </button>
            </span>
          ))}
          <button type="button" onClick={clear} className="ml-auto rounded-[4px] px-1 text-[12.5px] font-medium whitespace-nowrap text-fg-2 underline underline-offset-2 outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent print:hidden">
            Limpar tudo
          </button>
        </div>
      )}
    </>
  );
}

/** Selo discreto: esta visualização continua no total, porque os dados não têm a dimensão. */
export function NotFilteredBadge({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <span data-not-filtered className="inline-block rounded-chip border border-dashed border-line px-1.5 py-px text-[10.5px] leading-snug font-normal text-fg-2">
      {text}
    </span>
  );
}

/** O selo de uma parte do dashboard com dados reais. */
export function SectionBadge({ section }: { section: FilterSection }) {
  const api = useDashFilters();
  return api ? <NotFilteredBadge text={notFilteredText(notFilteredDims(section, api.filters))} /> : null;
}
