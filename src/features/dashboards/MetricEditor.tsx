"use client";

// Modo personalizar: edita as métricas no próprio dashboard, sem painel lateral. Faixa no
// topo, encaixes na fileira de cards e bandeja embaixo. Mexe só no rascunho de
// useMetricPrefsState; quem decide o que pode e o que grava continua em metric-prefs.ts.

import { Check, ChevronDown, ChevronLeft, ChevronRight, Info, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { TrendSpark } from "@/components/charts/TrendSpark";
import { Modal } from "@/components/ui/kit";
import { Segmented } from "@/components/ui/Segmented";
import { btn } from "@/components/ui/styles";
import { DRAG_TYPE, type MetricEditor } from "./metric-edit-context";
import { flipChange } from "./metric-flip";
import { METRIC_GROUP_LABEL, METRIC_GROUPS, sectionMax, toggleBlock, visibleIds, type CatalogMetric, type MetricGroup, type MetricSection } from "./metric-prefs";
import type { useMetricPrefsState } from "./metric-prefs-context";

/** Onde a faixa do modo gruda (top-[60px]). */
const STICKY_TOP = 60;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CustomizeButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-control border border-line px-3 text-[13.5px] font-medium whitespace-nowrap outline-none hover:border-accent focus-visible:ring-2 focus-visible:ring-accent print:hidden">
      <SlidersHorizontal size={15} aria-hidden /> Personalizar métricas
    </button>
  );
}

// ---- sair com mudança não salva ------------------------------------------------------------------

type LeaveTarget = { kind: "link"; anchor: HTMLAnchorElement } | { kind: "back" };

/**
 * Links internos e o voltar do navegador abrem a janela própria. Fechar ou recarregar a
 * aba só tem o aviso nativo do navegador: não existe outra forma.
 */
function useLeaveGuard(active: boolean, onDiscard: () => void) {
  const [target, setTarget] = useState<LeaveTarget | null>(null);
  const passing = useRef(false);
  const guarded = useRef(false);

  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (passing.current) return;
      e.preventDefault();
    };
    const onClick = (e: MouseEvent) => {
      if (passing.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setTarget({ kind: "link", anchor });
    };
    // uma entrada a mais no histórico: o voltar cai nela e a janela abre, em vez de sair
    const onPop = () => {
      if (passing.current) return;
      window.history.pushState(window.history.state, "", window.location.href);
      setTarget({ kind: "back" });
    };
    window.history.pushState(window.history.state, "", window.location.href);
    guarded.current = true;
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
      // salvou ou cancelou: tira a entrada extra, para o voltar não parecer travado
      // (a aba pode ter mudado no modo edição: o endereço de agora fica valendo)
      if (guarded.current && !passing.current) {
        const href = window.location.href;
        window.addEventListener("popstate", () => window.history.replaceState(window.history.state, "", href), { once: true });
        window.history.back();
      }
      guarded.current = false;
    };
  }, [active]);

  const discard = useCallback(() => {
    const t = target;
    setTarget(null);
    passing.current = true;
    flushSync(onDiscard);
    if (t?.kind === "link") t.anchor.click();
    else if (t?.kind === "back") window.history.go(-2);
    passing.current = false;
  }, [onDiscard, target]);

  return { open: !!target, keep: () => setTarget(null), discard };
}

// ---- estado do modo ------------------------------------------------------------------------------

type Metrics = ReturnType<typeof useMetricPrefsState>;

export type MetricValue = { text: string; spark?: readonly (number | null)[] };

export type EditorInput = {
  metrics: Metrics;
  /** Os cards que a tela está desenhando, inclusive com escolhas não salvas: o contador é isto. */
  visibleKpis: readonly string[];
  hasData: (id: string) => boolean;
  valueOf: (id: string) => MetricValue | null;
  /** Cards que existem mas não valem agora: aparecem apagados, com o motivo. */
  unavailable?: readonly { metric: CatalogMetric; reason: string }[];
  /** Onde ficam os cards do contador ("nesta aba", "na Visão geral"). */
  kpiPlace?: string;
  kpiNote?: string;
  /** A aba aberta não tem fileira de cards. */
  noKpis?: boolean;
  /** Vai para uma aba com cards. */
  goToCards?: () => void;
};

export function useMetricEditorState(input: EditorInput) {
  const { metrics, visibleKpis, unavailable } = input;
  const { catalog, prefs, toggle } = metrics;
  const [section, setSection] = useState<MetricSection>("kpis");
  const [collapsed, setCollapsed] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const max = sectionMax(catalog, "kpis") ?? 10;
  const columns = useMemo(() => visibleIds(catalog, "columns", prefs?.columns), [catalog, prefs?.columns]);
  const labelOf = useCallback((id: string) => [...catalog, ...(unavailable ?? []).map((u) => u.metric)].find((m) => m.id === id)?.label ?? id, [catalog, unavailable]);

  const canAdd = useCallback(
    (s: MetricSection, id: string) => {
      if (unavailable?.some((u) => u.metric.id === id) && s === "kpis") return false;
      const visible = s === "kpis" ? visibleKpis : columns;
      if (visible.includes(id) || (s === "kpis" && !input.hasData(id))) return false;
      return !toggleBlock(catalog, s, prefs?.[s], id);
    },
    [catalog, columns, input, prefs, unavailable, visibleKpis],
  );

  const add = useCallback(
    (s: MetricSection, id: string) => {
      if (!canAdd(s, id)) return;
      flipChange(() => toggle(s, id), s === "kpis" ? { added: id } : {});
      setAnnouncement(s === "kpis" ? `${labelOf(id)} adicionada, ${visibleKpis.length + 1} de ${max}` : `Coluna ${labelOf(id)} adicionada`);
    },
    [canAdd, labelOf, max, toggle, visibleKpis.length],
  );

  const remove = useCallback(
    (s: MetricSection, id: string) => {
      if (toggleBlock(catalog, s, prefs?.[s], id)) return;
      flipChange(() => toggle(s, id), s === "kpis" ? { removed: id } : {});
      setAnnouncement(s === "kpis" ? `${labelOf(id)} removida, ${visibleKpis.length - 1} de ${max}` : `Coluna ${labelOf(id)} removida`);
    },
    [catalog, labelOf, max, prefs, toggle, visibleKpis.length],
  );

  const editor = useMemo<MetricEditor | null>(
    () =>
      metrics.open
        ? {
            section,
            slots: max,
            canRemoveKpi: visibleKpis.length > 1,
            canRemoveColumn: columns.length > 1,
            removeKpi: (id) => remove("kpis", id),
            removeColumn: (id) => remove("columns", id),
            openTray: () => {
              setCollapsed(false);
              setSection("kpis");
              setFocusTick((t) => t + 1);
            },
            dragging,
            canDrop: visibleKpis.length < max,
            dropKpi: (id) => add("kpis", id),
          }
        : null,
    [add, columns.length, dragging, max, metrics.open, remove, section, visibleKpis.length],
  );

  const cancel = useCallback(() => {
    flushSync(() => metrics.close());
    setSection("kpis");
    setDragging(false);
    setCollapsed(false);
    setAnnouncement("Mudanças descartadas");
  }, [metrics]);

  const guard = useLeaveGuard(metrics.open && metrics.dirty, metrics.close);

  // ao entrar, a fileira de cards sobe para não ficar atrás da bandeja
  useEffect(() => {
    if (!metrics.open) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const row = document.querySelector("[data-kpi-row]");
    const bar = document.querySelector("[data-metric-edit-bar]");
    if (!row || !bar) return;
    // a faixa fica fixa logo abaixo do topo: a fileira para embaixo dela
    const scroller = document.querySelector(".shell-content");
    const inner = scroller && scroller.scrollHeight > scroller.clientHeight ? scroller : null;
    const stuckBottom = (inner?.getBoundingClientRect().top ?? 0) + STICKY_TOP + bar.getBoundingClientRect().height + 12;
    const distance = row.getBoundingClientRect().top - stuckBottom;
    (inner ?? window).scrollBy?.({ top: distance, behavior: still ? "auto" : "smooth" });
  }, [metrics.open]);

  // Esc descarta tudo, como o Cancelar (a janela de sair trata o próprio Esc)
  useEffect(() => {
    if (!metrics.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && !guard.open) cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cancel, guard.open, metrics.open]);

  return { input, editor, section, setSection, collapsed, setCollapsed, focusTick, setDragging, announcement, max, columns, canAdd, add, cancel, guard };
}

type EditorState = ReturnType<typeof useMetricEditorState>;

// ---- faixa do topo --------------------------------------------------------------------------------

export function MetricEditBar({ state }: { state: EditorState }) {
  const { input, section, max, columns, cancel } = state;
  const { metrics, visibleKpis, kpiPlace, noKpis, goToCards } = input;
  if (!metrics.open) return null;
  const cardsOff = section === "kpis" && noKpis;
  return (
    <div data-metric-edit-bar className="sticky top-[60px] z-30 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-accent/50 bg-card px-3.5 py-2.5 print:hidden">
      <p className="min-w-0 flex-1 basis-64 text-[13px] leading-snug text-fg">
        <strong className="font-semibold">Modo personalizar</strong>
        {section === "columns" ? (
          <span className="text-fg-2"> · toque em + para adicionar uma coluna, ou no ✕ do cabeçalho para tirar</span>
        ) : (
          <>
            <span className="hidden text-fg-2 md:inline"> · arraste da bandeja para um encaixe, ou toque em +</span>
            <span className="text-fg-2 md:hidden"> · toque em +</span>
          </>
        )}
      </p>
      <p data-metric-counter className="text-[13px] font-semibold whitespace-nowrap text-fg tnum">
        {cardsOff ? "Esta aba não tem cards" : section === "columns" ? `${columns.length} ${columns.length === 1 ? "coluna" : "colunas"}` : `${visibleKpis.length} de ${max}${kpiPlace ? ` ${kpiPlace}` : ""}`}
      </p>
      {cardsOff && goToCards && (
        <button type="button" onClick={goToCards} className="text-[13px] font-medium whitespace-nowrap text-fg underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-accent">
          Ir para a aba com cards
        </button>
      )}
      <div className="flex shrink-0 flex-wrap gap-2">
        <button type="button" onClick={metrics.restore} disabled={metrics.pending} className={`${btn.ghost} h-9 border border-line text-[13px] whitespace-nowrap`}>
          Restaurar padrão
        </button>
        <button type="button" onClick={cancel} disabled={metrics.pending} className={`${btn.ghost} h-9 border border-line text-[13px] whitespace-nowrap`}>
          Cancelar
        </button>
        <button type="button" onClick={() => void metrics.save()} disabled={metrics.pending} className={`${btn.small} h-9 whitespace-nowrap`}>
          {metrics.pending ? "Salvando…" : "Salvar"}
        </button>
      </div>
      {metrics.error && (
        <p role="alert" className="w-full rounded-control bg-error-soft px-3 py-1.5 text-[12.5px] text-error-fg">
          {metrics.error}
        </p>
      )}
    </div>
  );
}

// ---- bandeja ------------------------------------------------------------------------------------

/**
 * A fileira de cards no computador: sem barra de rolagem, com setas e degradê só nas pontas
 * onde há mais cards. O mouse também arrasta a fileira, menos em cima de um card que dá para
 * adicionar, porque lá o arrasto leva o card. No celular a lista é grade com rolagem vertical.
 */
function TrayRow({ count, children }: { count: number; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const grab = useRef<{ x: number; left: number } | null>(null);
  const [before, setBefore] = useState(false);
  const [after, setAfter] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setBefore(el.scrollLeft > 1);
    setAfter(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [count, measure]);

  const nudge = (direction: 1 | -1) => {
    const el = ref.current;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el?.scrollBy?.({ left: direction * el.clientWidth * 0.8, behavior: still ? "auto" : "smooth" });
  };

  const onPointerDown = (e: PointerEvent<HTMLUListElement>) => {
    const el = e.currentTarget;
    if (e.pointerType !== "mouse" || e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
    if ((e.target as Element).closest('button, [draggable="true"]')) return;
    grab.current = { x: e.clientX, left: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
  };

  const arrow = "absolute top-1/2 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-card text-fg outline-none hover:border-accent md:inline-flex";
  return (
    <div className="relative min-h-0 flex-1">
      <ul
        ref={ref}
        data-tray-row
        onScroll={measure}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => {
          if (grab.current) e.currentTarget.scrollLeft = grab.current.left - (e.clientX - grab.current.x);
        }}
        onPointerUp={() => (grab.current = null)}
        onPointerCancel={() => (grab.current = null)}
        // a fileira anda sob o ponteiro: sem isto, o card que passa por baixo começaria a ser arrastado
        onDragStartCapture={(e) => {
          if (!grab.current) return;
          e.preventDefault();
          e.stopPropagation();
        }}
        className="grid h-full auto-rows-[124px] grid-cols-2 gap-2 overflow-y-auto md:flex md:overflow-x-auto md:overflow-y-hidden md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
      {/* fora do Tab: o foco já rola até o card, e a seta some ao chegar na ponta */}
      {before && (
        <>
          <div aria-hidden data-tray-fade className="pointer-events-none absolute inset-y-0 left-0 hidden w-14 bg-linear-to-r from-card to-transparent md:block" />
          <button type="button" tabIndex={-1} data-tray-arrow="prev" onClick={() => nudge(-1)} aria-label="Ver métricas anteriores" className={`${arrow} left-1`}>
            <ChevronLeft size={16} aria-hidden />
          </button>
        </>
      )}
      {after && (
        <>
          <div aria-hidden data-tray-fade className="pointer-events-none absolute inset-y-0 right-0 hidden w-14 bg-linear-to-l from-card to-transparent md:block" />
          <button type="button" tabIndex={-1} data-tray-arrow="next" onClick={() => nudge(1)} aria-label="Ver mais métricas" className={`${arrow} right-1`}>
            <ChevronRight size={16} aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}

export function MetricTray({ state }: { state: EditorState }) {
  const { input, section, setSection, collapsed, setCollapsed, focusTick, setDragging, canAdd, add, guard, announcement, columns } = state;
  const { metrics, visibleKpis, hasData, valueOf, unavailable, kpiNote } = input;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<MetricGroup>("gerais");
  const [help, setHelp] = useState<CatalogMetric | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusTick > 0) searchRef.current?.focus();
  }, [focusTick]);

  const reasons = useMemo(() => new Map(section === "kpis" ? (unavailable ?? []).map((u) => [u.metric.id, u.reason]) : []), [section, unavailable]);
  const list = useMemo(() => {
    const q = fold(query.trim());
    const extra = section === "kpis" ? (unavailable ?? []).map((u) => u.metric) : [];
    return [...metrics.catalog.filter((m) => !reasons.has(m.id)), ...extra].filter((m) => (section === "kpis" ? !!m.kpi : !!m.column) && (!q || fold(`${m.label} ${m.help}`).includes(q)));
  }, [metrics.catalog, query, reasons, section, unavailable]);
  const groups = METRIC_GROUPS.filter((g) => list.some((m) => m.group === g));
  const active = groups.includes(tab) ? tab : (groups[0] ?? tab);
  const shown = list.filter((m) => m.group === active);
  const visible = section === "kpis" ? visibleKpis : columns;

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {metrics.open &&
        createPortal(
          <section data-metric-tray aria-label="Bandeja de métricas" className="fixed inset-x-0 bottom-0 z-[85] flex flex-col rounded-t-[20px] border-t border-line bg-card text-fg transition-[left] duration-300 ease-[cubic-bezier(0.32,1.15,0.6,1)] sb-closed:delay-100 md:right-3 md:bottom-3 md:left-[260px] md:rounded-[24px] md:border md:sb-closed:left-[104px] print:hidden">
            <button type="button" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label={collapsed ? "Abrir a bandeja" : "Recolher a bandeja"} className="flex h-6 shrink-0 items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <span className="h-1 w-10 rounded-full bg-line" aria-hidden />
              {collapsed && <ChevronDown size={14} aria-hidden className="ml-1 rotate-180 text-fg-2" />}
            </button>
            {!collapsed && (
              <div className="flex h-[54dvh] flex-col gap-2 px-3 pb-3 md:h-[264px] md:px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented<MetricSection>
                    label="O que personalizar"
                    size="sm"
                    value={section}
                    onChange={setSection}
                    options={[
                      { value: "kpis", label: "Cards" },
                      { value: "columns", label: "Colunas da tabela" },
                    ]}
                  />
                  <label className="flex h-8 min-w-40 flex-1 items-center gap-2 rounded-control border border-line bg-field px-2.5 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent md:max-w-72">
                    <Search size={14} aria-hidden className="shrink-0 text-fg-2" />
                    <span className="sr-only">Buscar métrica</span>
                    <input ref={searchRef} data-metric-search value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar métrica" className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg-2/70" />
                  </label>
                  <div role="tablist" aria-label="Categorias de métricas" className="flex min-w-0 flex-wrap gap-1">
                    {groups.map((g) => (
                      <button key={g} type="button" role="tab" data-tray-tab aria-selected={g === active} onClick={() => setTab(g)} className={`rounded-chip px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent ${g === active ? "bg-accent-soft text-fg" : "text-fg-2 hover:text-fg"}`}>
                        {METRIC_GROUP_LABEL[g]}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="min-h-[1.2em] truncate text-[12px] text-fg-2" title={help?.help}>
                  {help ? (
                    <>
                      <strong className="font-medium text-fg">{help.label}:</strong> {help.help}
                    </>
                  ) : (
                    (kpiNote ?? (
                      <>
                        <span className="md:hidden">Toque em ⓘ para ver a explicação e a fórmula.</span>
                        <span className="hidden md:inline">Passe o mouse num card para ver a explicação e a fórmula.</span>
                      </>
                    ))
                  )}
                </p>
                {!list.length && <p className="py-4 text-center text-[13.5px] text-fg-2">Nenhuma métrica com esse nome.</p>}
                <TrayRow key={`${section}-${active}`} count={shown.length}>
                  {shown.map((m) => {
                      const reason = reasons.get(m.id);
                      const used = !reason && visible.includes(m.id);
                      const noData = !reason && !used && section === "kpis" && !hasData(m.id);
                      const addable = canAdd(section, m.id);
                      const value = valueOf(m.id);
                      // sem número para mostrar: um traço, sem linha de tendência
                      const blank = !!reason || !value || !hasData(m.id);
                      const note = reason ?? (noData ? "sem dados nesta conta" : used ? "em uso" : !addable ? "limite atingido" : null);
                      return (
                        <li
                          key={m.id}
                          data-tray-metric={m.id}
                          draggable={addable && section === "kpis"}
                          onDragStart={(e) => {
                            e.dataTransfer.setData(DRAG_TYPE, m.id);
                            e.dataTransfer.effectAllowed = "copy";
                            setDragging(true);
                          }}
                          onDragEnd={() => setDragging(false)}
                          onPointerEnter={(e) => e.pointerType === "mouse" && setHelp(m)}
                          onPointerLeave={(e) => e.pointerType === "mouse" && setHelp(null)}
                          className={`relative flex min-w-0 flex-col rounded-[10px] border border-line bg-bg p-2.5 md:h-full md:w-44 md:shrink-0 ${addable ? "md:cursor-grab" : "opacity-55"}`}
                        >
                          <p className="line-clamp-2 pr-6 text-[11.5px] leading-tight font-medium text-fg">{m.label}</p>
                          <p className={`mt-1 truncate text-[15px] leading-none font-bold tnum ${blank ? "text-fg-2" : ""}`}>{blank ? "—" : value.text}</p>
                          {!blank && value.spark && <TrendSpark values={[...value.spark]} maturing={0} tone="good" line className="mt-1 h-6 shrink-0 md:h-10" />}
                          <div className="mt-auto flex items-center justify-between gap-1 pt-1">
                            <span className="min-w-0 text-[10.5px] leading-tight text-fg-2">
                              {note}
                            </span>
                            <span className="flex shrink-0 items-center gap-1">
                              <button type="button" onClick={() => setHelp((h) => (h?.id === m.id ? null : m))} onFocus={() => setHelp(m)} aria-label={`O que é ${m.label}`} className="inline-flex size-6 items-center justify-center rounded-full text-fg-2 outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
                                <Info size={13} aria-hidden />
                              </button>
                              {used ? (
                                <span role="img" aria-label={`${m.label} em uso`} className="inline-flex size-6 items-center justify-center rounded-full bg-accent-soft text-fg">
                                  <Check size={13} aria-hidden />
                                </span>
                              ) : (
                                <button type="button" disabled={!addable} onClick={() => add(section, m.id)} aria-label={`Adicionar ${m.label}`} className="inline-flex size-6 items-center justify-center rounded-full bg-accent text-on-accent outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:bg-line disabled:text-fg-2">
                                  <Plus size={14} aria-hidden />
                                </button>
                              )}
                            </span>
                          </div>
                        </li>
                      );
                  })}
                </TrayRow>
              </div>
            )}
          </section>,
          document.body,
        )}
      <Modal open={guard.open} onClose={guard.keep} title="Sair sem salvar?">
        <p className="text-[14px] text-fg-2">As mudanças nas métricas ainda não foram salvas. Se sair agora, elas se perdem.</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={guard.keep} className={`${btn.ghost} h-9 border border-line text-[13px] whitespace-nowrap`}>
            Continuar editando
          </button>
          <button type="button" onClick={guard.discard} className={`${btn.small} h-9 whitespace-nowrap`}>
            Descartar e sair
          </button>
        </div>
      </Modal>
    </>
  );
}
