"use client";

// Modo personalizar: edita as métricas no próprio dashboard, sem painel lateral. Faixa no
// topo, encaixes na fileira de cards e bandeja embaixo. Mexe só no rascunho de
// useMetricPrefsState; quem decide o que pode e o que grava continua em metric-prefs.ts.

import { Check, ChevronDown, ChevronUp, Eye, Info, LayoutGrid, Pencil, Plus, RotateCcw, Search, Settings2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { TrendSpark } from "@/components/charts/TrendSpark";
import { Modal } from "@/components/ui/kit";
import { Segmented } from "@/components/ui/Segmented";
import { btn } from "@/components/ui/styles";
import { AskInput, AskPlan, useAsk, type AskHost, type AskState } from "./ask/AskBar";
import { DRAG_TYPE, markLeaveGuardSettling, type MetricEditor } from "./metric-edit-context";
import { flipChange } from "./metric-flip";
import { useEditAnchor } from "./useEditAnchor";
import { METRIC_GROUP_LABEL, METRIC_GROUPS, sectionMax, toggleBlock, visibleIds, type CatalogMetric, type MetricGroup, type MetricSection } from "./metric-prefs";
import type { useMetricPrefsState } from "./metric-prefs-context";
import { fold } from "@/lib/text";

/** Entrada do modo edição: em destaque (cor da marca), para ninguém precisar procurar. */
export function CustomizeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tour="personalizar"
      title="Escolher os cards, as colunas das tabelas e a disposição dos blocos"
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold whitespace-nowrap text-on-accent shadow-[0_6px_18px_-8px_var(--accent)] outline-none transition-[transform,filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card active:scale-[0.98] print:hidden"
    >
      <Pencil size={14} aria-hidden /> Editar dashboard
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
        markLeaveGuardSettling(
          new Promise((done) => {
            window.addEventListener(
              "popstate",
              () => {
                window.history.replaceState(window.history.state, "", href);
                done();
              },
              { once: true },
            );
          }),
        );
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
  /** Aba a mais na bandeja (Por plataforma: métricas de cada API e blocos escondidos). */
  extraTab?: { label: string; render: () => ReactNode };
  /** Mover e redimensionar blocos: true no Avançado, false abaixo dele, sem valor onde não existe grade. */
  arrange?: boolean;
  /** Alinhar grade (Avançado, em aba com grade): arruma larguras e alturas sem trocar a ordem. */
  align?: () => void;
  /** Nome, contas, metas e período padrão (a tela de configurações do dashboard). */
  settingsHref?: string;
  /** "Pedir ao Vyz": a pessoa escreve o que quer ver e a aba ganha os blocos (só em aba com grade). */
  ask?: AskHost;
};

export function useMetricEditorState(input: EditorInput) {
  const { metrics, visibleKpis, unavailable } = input;
  const { catalog, prefs, toggle } = metrics;
  const [section, setSection] = useState<MetricSection>("kpis");
  const [collapsed, setCollapsed] = useState(false);
  // "Ver em tela cheia": o dashboard como vai ficar, sem o editor, antes de salvar
  const [previewing, setPreviewing] = useState(false);
  const [wasOpen, setWasOpen] = useState(metrics.open);
  if (wasOpen !== metrics.open) {
    setWasOpen(metrics.open);
    if (!metrics.open) setPreviewing(false);
  }
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
      metrics.open && !previewing
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
            // o card sai da bandeja ao entrar: o dragend dele não chega mais, então o soltar encerra o arraste
            dropKpi: (id) => {
              setDragging(false);
              add("kpis", id);
            },
          }
        : null,
    [add, columns.length, dragging, max, metrics.open, previewing, remove, section, visibleKpis.length],
  );

  const cancel = useCallback(() => {
    flushSync(() => metrics.close());
    setSection("kpis");
    setDragging(false);
    setCollapsed(false);
    setPreviewing(false);
    setAnnouncement("Mudanças descartadas");
  }, [metrics]);

  const guard = useLeaveGuard(metrics.open && metrics.dirty, metrics.close);

  // Esc descarta tudo, como o Cancelar (a janela de sair trata o próprio Esc); na tela cheia, volta ao editor
  useEffect(() => {
    if (!metrics.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || guard.open) return;
      if (previewing) setPreviewing(false);
      else cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cancel, guard.open, metrics.open, previewing]);

  return { input, editor, section, setSection, collapsed, setCollapsed, previewing, setPreviewing, focusTick, setDragging, announcement, max, columns, canAdd, add, cancel, guard };
}

type EditorState = ReturnType<typeof useMetricEditorState>;

// ---- painel do editor ------------------------------------------------------------------------------
//
// No computador (xl), o modo edição é um painel na lateral direita, de cima a baixo, numa cor
// própria (não se confunde com o dashboard). O dashboard não fica por baixo: ele estreita e cabe
// inteiro ao lado (DashboardBody reserva a largura). As partes empilhadas, na mesma ordem: o que
// está sendo editado (Cards, Colunas, Por plataforma) e "Na tela" (com o ✕), "Adicionar" (busca,
// categorias e a lista) e, presos no pé, as ações, "Ver em tela cheia" e Cancelar / Salvar.
// Entre o tablet e o notebook pequeno, a mesma coisa vira uma faixa no rodapé, em três colunas;
// no celular, uma folha que sobe de baixo. Dá para minimizar e ver mais do dashboard.
// "Ver em tela cheia" mostra o dashboard como vai ficar, sem o editor, antes de salvar.

const BAR_BUTTON = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12.5px] font-medium whitespace-nowrap text-fg outline-none transition-colors hover:border-fg-2 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50";
/** A cor do editor: o fundo do dashboard puxado para a cor de destaque, com a borda dela. Fica claro onde acaba o dashboard. */
const PANEL_TONE = "border-accent/45 bg-[color-mix(in_srgb,var(--accent)_13%,var(--bg))]";
const SAVE_BUTTON = "inline-flex items-center justify-center rounded-full bg-accent px-4 font-semibold whitespace-nowrap text-on-accent outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50";

export function MetricTray({ state }: { state: EditorState }) {
  const { input, section, setSection, focusTick, setDragging, canAdd, add, guard, announcement, columns, editor, max, cancel, collapsed, setCollapsed, previewing, setPreviewing } = state;
  const { metrics, visibleKpis, hasData, valueOf, unavailable, kpiNote, kpiPlace, noKpis, goToCards } = input;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<MetricGroup | "todas">("todas");
  const [help, setHelp] = useState<CatalogMetric | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [extraOn, setExtraOn] = useState(false);
  const extraTab = input.extraTab;

  useEffect(() => {
    if (focusTick > 0) searchRef.current?.focus();
  }, [focusTick]);

  const reasons = useMemo(() => new Map(section === "kpis" ? (unavailable ?? []).map((u) => [u.metric.id, u.reason]) : []), [section, unavailable]);
  const all = useMemo(() => [...metrics.catalog, ...(unavailable ?? []).map((u) => u.metric)], [metrics.catalog, unavailable]);
  const list = useMemo(() => {
    const q = fold(query.trim());
    const extra = section === "kpis" ? (unavailable ?? []).map((u) => u.metric) : [];
    return [...metrics.catalog.filter((m) => !reasons.has(m.id)), ...extra].filter((m) => (section === "kpis" ? !!m.kpi : !!m.column) && (!q || fold(`${m.label} ${m.help}`).includes(q)));
  }, [metrics.catalog, query, reasons, section, unavailable]);
  const groups = METRIC_GROUPS.filter((g) => list.some((m) => m.group === g));
  const active = tab === "todas" || groups.includes(tab) ? tab : "todas";
  const visible = section === "kpis" ? visibleKpis : columns;
  // "Adicionar" mostra só o que ainda não está na tela (o que está fica em "Na tela")
  const shown = list.filter((m) => (active === "todas" || m.group === active) && !(!reasons.has(m.id) && visible.includes(m.id)));
  const labelOf = (id: string) => all.find((m) => m.id === id)?.label ?? id;
  // nas cores do visual do dashboard (Fachada claro, Noturno escuro...)
  const anchor = useEditAnchor(metrics.open);
  const onExtra = extraOn && !!extraTab;
  const cardsOff = section === "kpis" && noKpis && !onExtra;
  const hint = onExtra
    ? "Métricas de cada plataforma e os blocos escondidos desta aba."
    : section === "columns"
      ? "Escolha as colunas das tabelas. Também dá para tirar pelo ✕ no cabeçalho da tabela."
      : input.arrange
        ? "Arraste os blocos pela barra de cima para mudar de lugar e pelo canto para mudar o tamanho."
        : input.arrange === false
          ? "Adicione ou tire cards. Mudar os blocos de lugar e de tamanho é do plano Avançado."
          : "Adicione pelo + ou arraste a métrica até a fileira de cards.";

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {metrics.open &&
        createPortal(
          <TrayAsk host={input.ask} kpi={{ add: (id) => add("kpis", id), canAdd: (id) => canAdd("kpis", id), labelOf }} onApplied={() => setCollapsed(true)}>
          {(ask) =>
          previewing ? (
            // tela cheia: o dashboard como vai ficar; o editor volta com tudo como estava
            <div role="region" aria-label="Pré-visualização" style={anchor?.vars} className="fixed inset-x-3 bottom-3 z-[85] flex justify-center print:hidden">
              <div className={`flex max-w-full items-center gap-2 rounded-full border py-1.5 pr-1.5 pl-4 text-fg shadow-[0_18px_50px_-18px_rgb(0_0_0/0.6)] ${PANEL_TONE}`}>
                <Eye size={15} aria-hidden className="shrink-0 text-fg-2" />
                <p className="min-w-0 truncate text-[13px]">
                  <strong className="font-semibold">Pré-visualização</strong>
                  <span className="text-fg-2 max-sm:hidden"> · as mudanças ainda não foram salvas</span>
                </p>
                <button type="button" onClick={() => setPreviewing(false)} className={BAR_BUTTON}>
                  <Pencil size={13} aria-hidden /> Voltar a editar
                </button>
                <button type="button" onClick={() => void metrics.save()} disabled={metrics.pending} className={`${SAVE_BUTTON} h-9 text-[13px]`}>
                  {metrics.pending ? "Salvando…" : "Salvar"}
                </button>
              </div>
            </div>
          ) : (
          <section
            data-metric-tray
            data-collapsed={collapsed ? "" : undefined}
            aria-label="Editar dashboard"
            style={anchor?.vars}
            className={`fixed inset-x-0 bottom-0 z-[85] flex flex-col overflow-hidden rounded-t-[22px] border-t text-fg shadow-[0_-20px_60px_-20px_rgb(0_0_0/0.5)] md:inset-x-3 md:bottom-3 md:rounded-[22px] md:border print:hidden ${PANEL_TONE} ${collapsed ? "xl:left-auto xl:w-[560px]" : `${input.ask ? "h-[82dvh] md:h-[396px]" : "h-[78dvh] md:h-[340px]"} xl:top-3 xl:left-auto xl:h-auto xl:w-[400px] xl:shadow-[-24px_0_60px_-24px_rgb(0_0_0/0.55)]`}`}
          >
            {/* minimizada: só o que está sendo editado e Cancelar / Salvar */}
            {collapsed ? (
              <div data-metric-edit-bar className="flex items-center gap-3 px-4 py-2.5">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden>
                  <Pencil size={14} />
                </span>
                <p className="min-w-0 flex-1 truncate text-[13px]">
                  <strong className="font-semibold">Editando</strong>
                  <span className="text-fg-2"> · {ask.done ?? (section === "columns" ? `${columns.length} colunas` : `${visibleKpis.length} de ${max} cards`)}</span>
                </p>
                <button type="button" onClick={() => setCollapsed(false)} className={BAR_BUTTON}>
                  <ChevronUp size={14} aria-hidden /> Abrir editor
                </button>
                <button type="button" onClick={cancel} disabled={metrics.pending} className={BAR_BUTTON}>
                  Cancelar
                </button>
                <button type="button" onClick={() => void metrics.save()} disabled={metrics.pending} className={`${SAVE_BUTTON} h-9 text-[13px]`}>
                  {metrics.pending ? "Salvando…" : "Salvar"}
                </button>
              </div>
            ) : (
              <>
              <AskInput ask={ask} />
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto [scrollbar-width:thin] md:flex-row md:overflow-hidden xl:flex-col xl:overflow-y-auto">
                {/* 1. o que editar e o que está na tela */}
                <div className="flex shrink-0 flex-col gap-3 border-b border-line p-4 md:w-[350px] md:border-r md:border-b-0 md:overflow-y-auto md:[scrollbar-width:thin] xl:w-auto xl:border-r-0 xl:border-b xl:overflow-visible">
                  <header data-metric-edit-bar className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden>
                      <Pencil size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10.5px] font-medium tracking-[0.06em] text-fg-2 uppercase">Editando</p>
                      <h2 className="text-[14px] leading-tight font-semibold">Personalizar dashboard</h2>
                    </div>
                    {/* no painel lateral, minimizar e fechar ficam no topo */}
                    <div className="hidden shrink-0 items-center gap-1 xl:flex">
                      <button type="button" onClick={() => setCollapsed(true)} aria-label="Minimizar o editor" title="Minimizar o editor" className="inline-flex size-8 items-center justify-center rounded-full text-fg-2 outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
                        <ChevronDown size={16} aria-hidden />
                      </button>
                      <button type="button" onClick={cancel} disabled={metrics.pending} aria-label="Fechar sem salvar" title="Fechar sem salvar" className="inline-flex size-8 items-center justify-center rounded-full text-fg-2 outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
                        <X size={16} aria-hidden />
                      </button>
                    </div>
                  </header>
                  <Segmented<MetricSection | "extra">
                    label="O que personalizar"
                    size="sm"
                    value={onExtra ? "extra" : section}
                    onChange={(v) => {
                      setExtraOn(v === "extra");
                      if (v !== "extra") setSection(v);
                    }}
                    options={[
                      { value: "kpis", label: "Cards" },
                      { value: "columns", label: "Colunas da tabela" },
                      ...(extraTab ? [{ value: "extra" as const, label: extraTab.label }] : []),
                    ]}
                  />
                  <p className="text-[11.5px] leading-snug text-fg-2">{hint}</p>
                  {!onExtra &&
                    (cardsOff ? (
                      <div className="rounded-[12px] border border-dashed border-line p-3 text-center">
                        <p data-metric-counter className="text-[12.5px] font-semibold">
                          Esta aba não tem cards
                        </p>
                        {goToCards && (
                          <button type="button" onClick={goToCards} className={`${BAR_BUTTON} mt-2`}>
                            Ir para a aba com cards
                          </button>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <h3 className="text-[12px] font-semibold">Na tela</h3>
                          <p data-metric-counter className="text-[11.5px] font-semibold text-fg-2 tnum">
                            {section === "columns" ? `${columns.length} ${columns.length === 1 ? "coluna" : "colunas"}` : `${visibleKpis.length} de ${max}${kpiPlace ? ` ${kpiPlace}` : ""}`}
                          </p>
                        </div>
                        {section === "kpis" && (
                          <div className="mb-2 h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]" aria-hidden>
                            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.min(100, (visibleKpis.length / max) * 100)}%` }} />
                          </div>
                        )}
                        <ul className="flex flex-wrap gap-1.5" aria-label="Na tela">
                          {visible.map((id) => {
                            const canRemove = section === "kpis" ? editor?.canRemoveKpi : editor?.canRemoveColumn;
                            return (
                              <li key={id} className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-surface-2 pr-1 pl-2.5 text-[11.5px] font-medium">
                                {labelOf(id)}
                                <button
                                  type="button"
                                  disabled={!canRemove}
                                  onClick={() => (section === "kpis" ? editor?.removeKpi(id) : editor?.removeColumn(id))}
                                  aria-label={`Tirar ${labelOf(id)}`}
                                  title={canRemove ? "Tirar da tela" : "Fica pelo menos um"}
                                  className="inline-flex size-5 items-center justify-center rounded-full text-fg-2 outline-none hover:bg-error-soft hover:text-error-fg focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30"
                                >
                                  <X size={12} aria-hidden />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                </div>

                {/* 2. adicionar (ou a aba Por plataforma) */}
                <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 md:min-h-0 xl:flex-none">
                  {ask.plan || ask.reading ? (
                    <AskPlan ask={ask} />
                  ) : onExtra ? (
                    <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">{extraTab.render()}</div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="mr-1 text-[12px] font-semibold">Adicionar</h3>
                        <label className="flex h-8 min-w-44 flex-1 items-center gap-2 rounded-full border border-line bg-field px-3 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent md:max-w-64 xl:max-w-none">
                          <Search size={13} aria-hidden className="shrink-0 text-fg-2" />
                          <span className="sr-only">Buscar métrica</span>
                          <input ref={searchRef} data-metric-search value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar métrica" className="h-full min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-fg-2/70" />
                        </label>
                        <div role="tablist" aria-label="Categorias de métricas" className="flex flex-wrap gap-1">
                          {(["todas", ...groups] as const).map((g) => (
                            <button key={g} type="button" role="tab" data-tray-tab aria-selected={g === active} onClick={() => setTab(g)} className={`rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent ${g === active ? "bg-fg text-bg" : "text-fg-2 hover:bg-surface-2 hover:text-fg"}`}>
                              {g === "todas" ? "Todas" : METRIC_GROUP_LABEL[g]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="min-h-[1.2em] truncate text-[11.5px] text-fg-2" title={help?.help}>
                        {help ? (
                          <>
                            <strong className="font-medium text-fg">{help.label}:</strong> {help.help}
                          </>
                        ) : (
                          (kpiNote ?? "Toque em ⓘ para ver o que a métrica mede. Arraste uma métrica até a fileira de cards ou use o +.")
                        )}
                      </p>
                      {!list.length && <p className="py-4 text-center text-[13px] text-fg-2">Nenhuma métrica com esse nome.</p>}
                      {list.length > 0 && !shown.length && <p className="py-4 text-center text-[12.5px] text-fg-2">Tudo desta categoria já está na tela.</p>}
                      <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-1.5 overflow-y-auto pr-1 [scrollbar-width:thin] sm:grid-cols-2 xl:grid-cols-1 xl:overflow-visible">
                        {shown.map((m) => {
                          const reason = reasons.get(m.id);
                          const used = !reason && visible.includes(m.id);
                          const noData = !reason && !used && section === "kpis" && !hasData(m.id);
                          const addable = canAdd(section, m.id);
                          const value = valueOf(m.id);
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
                              className={`flex items-center gap-2 rounded-[12px] border border-line/70 bg-bg/60 px-2.5 py-1.5 transition-colors ${addable ? "hover:border-accent/60 md:cursor-grab" : "opacity-55"}`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[12px] leading-tight font-medium text-fg">{m.label}</p>
                                <p className="mt-0.5 truncate text-[11px] text-fg-2">
                                  <span className={`font-semibold tnum ${blank ? "" : "text-fg"}`}>{blank ? "—" : value.text}</span>
                                  {note && <span> · {note}</span>}
                                </p>
                              </div>
                              {!blank && value.spark && (
                                <div className="w-12 shrink-0" aria-hidden>
                                  <TrendSpark values={[...value.spark]} maturing={0} tone="good" line className="h-7" />
                                </div>
                              )}
                              <button type="button" onClick={() => setHelp((h) => (h?.id === m.id ? null : m))} onFocus={(e) => e.currentTarget.matches(":focus-visible") && setHelp(m)} aria-label={`O que é ${m.label}`} className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-fg-2 outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
                                <Info size={14} aria-hidden />
                              </button>
                              {used ? (
                                <span role="img" aria-label={`${m.label} em uso`} className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-fg">
                                  <Check size={14} aria-hidden />
                                </span>
                              ) : (
                                <button type="button" disabled={!addable} onClick={() => add(section, m.id)} aria-label={`Adicionar ${m.label}`} className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:bg-line disabled:text-fg-2">
                                  <Plus size={15} aria-hidden />
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </div>

                {/* 3. ações e salvar */}
                <div className="flex shrink-0 flex-col gap-2 border-t border-line p-4 md:w-[220px] md:border-t-0 md:border-l xl:sticky xl:bottom-0 xl:mt-auto xl:w-auto xl:border-t xl:border-l-0 xl:bg-[color-mix(in_srgb,var(--accent)_13%,var(--bg))]">
                  <div className="flex items-center justify-end gap-1 xl:hidden">
                    <button type="button" onClick={() => setCollapsed(true)} aria-label="Minimizar o editor" title="Minimizar o editor" className="hidden size-8 items-center justify-center rounded-full text-fg-2 outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent md:inline-flex">
                      <ChevronDown size={16} aria-hidden />
                    </button>
                    <button type="button" onClick={cancel} disabled={metrics.pending} aria-label="Fechar sem salvar" title="Fechar sem salvar" className="inline-flex size-8 items-center justify-center rounded-full text-fg-2 outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 md:flex-col xl:flex-row">
                    {input.align && section !== "columns" && !onExtra && (
                      <button type="button" onClick={input.align} disabled={metrics.pending} title="Fecha as fileiras e iguala as alturas, sem trocar a ordem dos blocos" className={`${BAR_BUTTON} md:justify-start`}>
                        <LayoutGrid size={14} aria-hidden /> Alinhar grade
                      </button>
                    )}
                    <button type="button" onClick={metrics.restore} disabled={metrics.pending} className={`${BAR_BUTTON} md:justify-start`}>
                      <RotateCcw size={14} aria-hidden /> Restaurar padrão
                    </button>
                    {input.settingsHref && (
                      <Link href={input.settingsHref} className={`${BAR_BUTTON} md:justify-start`}>
                        <Settings2 size={14} aria-hidden /> Nome, contas e metas
                      </Link>
                    )}
                    <button type="button" onClick={() => setPreviewing(true)} title="O dashboard como vai ficar, sem o editor. As mudanças continuam sem salvar." className={`${BAR_BUTTON} md:justify-start`}>
                      <Eye size={14} aria-hidden /> Ver em tela cheia
                    </button>
                  </div>
                  {metrics.error && (
                    <p role="alert" className="rounded-[10px] bg-error-soft px-3 py-1.5 text-[12px] text-error-fg">
                      {metrics.error}
                    </p>
                  )}
                  <div className="mt-auto flex gap-2 md:flex-col xl:flex-row-reverse">
                    <button type="button" onClick={() => void metrics.save()} disabled={metrics.pending} className={`${SAVE_BUTTON} h-10 flex-1 text-[13.5px] focus-visible:ring-offset-2 focus-visible:ring-offset-card md:flex-none xl:flex-1`}>
                      {metrics.pending ? "Salvando…" : "Salvar"}
                    </button>
                    <button type="button" onClick={cancel} disabled={metrics.pending} className={`${BAR_BUTTON} h-10 flex-1 md:flex-none xl:flex-1`}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
              </>
            )}
          </section>
          )}
          </TrayAsk>,
          document.body,
        )}
      <Modal open={guard.open} onClose={guard.keep} title="Sair sem salvar?">
        <p className="text-[14px] text-fg-2">As mudanças nas métricas ainda não foram salvas. Se sair agora, elas se perdem.</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={guard.keep} className={BAR_BUTTON}>
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

/** O pedido vive enquanto o editor está aberto: fechar ou salvar começa do zero. */
function TrayAsk({ host, kpi, onApplied, children }: { host?: AskHost; kpi: Parameters<typeof useAsk>[1]; onApplied: () => void; children: (ask: AskState) => ReactNode }) {
  return children(useAsk(host, kpi, onApplied));
}
