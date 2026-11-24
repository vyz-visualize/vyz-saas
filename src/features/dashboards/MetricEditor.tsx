"use client";

// Modo edição do dashboard: o painel (na lateral no computador, folha embaixo no resto) com o
// resumo da aba na ordem da tela (cards, gráficos e tabelas, colunas) e as listas de
// adicionar. Mexe só nos rascunhos (useMetricPrefsState e a disposição da grade); quem decide
// o que pode e o que grava continua em metric-prefs.ts e layout/model.ts.

import { ArrowLeft, ChartColumn, Check, ChevronDown, ChevronRight, ChevronUp, Columns3, Eye, EyeOff, Hash, Info, LayoutGrid, Monitor, MonitorCheck, Pencil, Plus, RotateCcw, Search, Settings2, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { TrendSpark } from "@/components/charts/TrendSpark";
import { Modal } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { AskInput, AskPlan, useAsk, type AskHost, type AskState } from "./ask/AskBar";
import { KPIS_ID, kindOf, widthLabel } from "./layout/model";
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

/** Um bloco da aba no painel: o nome, a largura e se foi somado pela pessoa (sai de vez) ou é do modelo (fica oculto). */
export type BlockRow = { id: string; label: string; w: number; added: boolean };

/** Os gráficos e tabelas da aba aberta (só nas abas com grade). */
export type EditorBlocks = {
  /** Na ordem de leitura, sem a fileira de cards (ela tem a seção dela). */
  shown: readonly BlockRow[];
  /** Blocos do modelo ocultos nesta aba. */
  hidden: readonly { id: string; label: string }[];
  /** A fileira de cards: na aba, oculta ou sem fileira (visual próprio). */
  kpiStrip: "shown" | "hidden" | "none";
  hide: (id: string) => void;
  show: (id: string) => void;
  /** A aba precisa de pelo menos um bloco. */
  canHide: boolean;
  /** Cards por plataforma: a lista para somar e quantos a aba já tem. */
  platform?: { count: number; max: number; render: () => ReactNode };
  /** Blocos pedidos ao Vyz nesta aba e o limite. */
  custom: { count: number; max: number };
};

export type EditorInput = {
  metrics: Metrics;
  /** Os cards que a tela está desenhando, inclusive com escolhas não salvas: o contador é isto. */
  visibleKpis: readonly string[];
  hasData: (id: string) => boolean;
  valueOf: (id: string) => MetricValue | null;
  /** Cards que existem mas não valem agora: aparecem apagados, com o motivo. */
  unavailable?: readonly { metric: CatalogMetric; reason: string }[];
  /** Nome da aba aberta: o título do painel. */
  pageName?: string;
  /** Onde ficam os cards do contador ("nesta aba", "na Visão geral"). */
  kpiPlace?: string;
  kpiNote?: string;
  /** A aba aberta não tem fileira de cards. */
  noKpis?: boolean;
  /** Vai para uma aba com cards. */
  goToCards?: () => void;
  /** Gráficos e tabelas da aba (abas com grade): ocultar, mostrar, remover e adicionar. */
  blocks?: EditorBlocks;
  /** Mover e redimensionar blocos: true no Avançado, false abaixo dele, sem valor onde não existe grade. */
  arrange?: boolean;
  /** Arrumar a grade (Avançado, em aba com grade): fecha as fileiras e iguala as alturas, sem trocar a ordem. */
  align?: () => void;
  /** Nome, contas, metas e período padrão (a tela de configurações do dashboard). */
  settingsHref?: string;
  /** "Pedir ao Vyz": a pessoa escreve o que quer ver e a aba ganha os blocos (só em aba com grade). */
  ask?: AskHost;
};

/** O que o painel mostra: o resumo da aba ou uma das listas de adicionar. */
type View = "home" | "cards" | "columns" | "blocks";

export function useMetricEditorState(input: EditorInput) {
  const { metrics, visibleKpis, unavailable } = input;
  const { catalog, prefs, toggle } = metrics;
  const [view, setView] = useState<View>("home");
  // o ✕ nos cards ou nos cabeçalhos das tabelas: segue o que o painel está mostrando
  const section: MetricSection = view === "columns" ? "columns" : "kpis";
  const [collapsed, setCollapsed] = useState(false);
  // "Ver como fica": o dashboard como vai ficar, sem o editor, antes de salvar
  const [previewing, setPreviewing] = useState(false);
  const [wasOpen, setWasOpen] = useState(metrics.open);
  if (wasOpen !== metrics.open) {
    setWasOpen(metrics.open);
    if (!metrics.open) {
      setPreviewing(false);
      setView("home");
    }
  }
  const [focusTick, setFocusTick] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [screens, setScreens] = useState<number | null>(null);
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

  /** Abre uma lista de adicionar com o foco na busca (ou no pedido ao Vyz). */
  const open = useCallback((v: View) => {
    setCollapsed(false);
    setView(v);
    setFocusTick((t) => t + 1);
  }, []);

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
            openTray: () => open("cards"),
            dragging,
            canDrop: visibleKpis.length < max,
            // o card sai da bandeja ao entrar: o dragend dele não chega mais, então o soltar encerra o arraste
            dropKpi: (id) => {
              setDragging(false);
              add("kpis", id);
            },
            highlight,
            setHighlight,
            setScreens,
          }
        : null,
    [add, columns.length, dragging, highlight, max, metrics.open, open, previewing, remove, section, visibleKpis.length],
  );

  const cancel = useCallback(() => {
    flushSync(() => metrics.close());
    setView("home");
    setDragging(false);
    setCollapsed(false);
    setPreviewing(false);
    setHighlight(null);
    setAnnouncement("Mudanças descartadas");
  }, [metrics]);

  const guard = useLeaveGuard(metrics.open && metrics.dirty, metrics.close);

  // Esc: na tela cheia, volta ao editor; numa lista de adicionar, volta ao resumo; no resumo, descarta tudo, como o Cancelar (a janela de sair trata o próprio Esc)
  useEffect(() => {
    if (!metrics.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || guard.open) return;
      if (previewing) setPreviewing(false);
      else if (view !== "home") setView("home");
      else cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cancel, guard.open, metrics.open, previewing, view]);

  return { input, editor, view, setView, open, section, collapsed, setCollapsed, previewing, setPreviewing, focusTick, setDragging, announcement, max, columns, canAdd, add, cancel, guard, highlight, setHighlight, screens, labelOf };
}

type EditorState = ReturnType<typeof useMetricEditorState>;

// ---- painel do editor ------------------------------------------------------------------------------
//
// No computador (xl), o modo edição é um painel na lateral direita, de cima a baixo, numa cor
// própria (não se confunde com o dashboard). O dashboard não fica por baixo: ele estreita e cabe
// inteiro ao lado (EDITING_PAD). Abaixo disso, o mesmo painel vira uma folha que sobe de baixo.
//
// Uma regra visual só, para bater o olho e saber o que fazer:
//   - o resumo da aba segue a ordem da tela: Cards, Gráficos e tabelas, Colunas das tabelas;
//   - cada seção tem o título à esquerda e o contador (o limite) à direita;
//   - cada linha tem uma ação só, sempre no mesmo lugar: Ocultar, Remover ou Mostrar;
//   - cada seção termina no "+ Adicionar", que abre a lista dela (com Voltar no topo);
//   - Salvar é o único botão cheio; Cancelar e "Ver como fica" ficam no pé.
// Apontar um bloco no painel acende o mesmo bloco na grade (e vice-versa). No alto, quantas
// telas a aba vira (o dashboard não rola), com a linha tracejada na grade onde cada tela começa.

/** Respiro do dashboard com o editor aberto: no computador ele fica ao lado; no resto, a folha de baixo. */
export const EDITING_PAD = "pb-[74dvh] md:pb-[484px] xl:pr-[412px] xl:pb-4";
export const EDITING_PAD_COLLAPSED = "pb-24";

const BAR_BUTTON = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-line bg-card px-3 text-[12.5px] font-medium whitespace-nowrap text-fg outline-none transition-colors hover:border-fg-2 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50";
/** A cor do editor: o fundo do dashboard puxado para a cor de destaque, com a borda dela. Fica claro onde acaba o dashboard. */
const PANEL_TONE = "border-accent/45 bg-[color-mix(in_srgb,var(--accent)_13%,var(--bg))]";
const SAVE_BUTTON = "inline-flex items-center justify-center rounded-full bg-accent px-4 font-semibold whitespace-nowrap text-on-accent outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50";
const ICON_BUTTON = "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-fg-2 outline-none hover:bg-surface-2 hover:text-fg focus-visible:ring-2 focus-visible:ring-accent";
/** A ação de cada linha (Ocultar, Remover, Mostrar): mesmo tamanho e mesmo lugar em todas. */
const ROW_ACTION = "inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-35";
const ROW_OFF = `${ROW_ACTION} text-fg-2 hover:bg-error-soft hover:text-error-fg`;
const ROW_ON = `${ROW_ACTION} bg-accent-soft text-fg hover:bg-accent hover:text-on-accent`;

export function MetricTray({ state }: { state: EditorState }) {
  const { input, view, setView, setCollapsed, guard, announcement, cancel, collapsed, previewing, setPreviewing, columns, max } = state;
  const { metrics } = input;
  // nas cores do visual do dashboard (Fachada claro, Noturno escuro...)
  const anchor = useEditAnchor(metrics.open);

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {metrics.open &&
        createPortal(
          <TrayAsk
            host={input.ask}
            kpi={{ add: (id) => state.add("kpis", id), canAdd: (id) => state.canAdd("kpis", id), labelOf: state.labelOf }}
            onApplied={() => {
              // os blocos novos aparecem no resumo; no estreito, a folha desce para mostrar o dashboard
              setView("home");
              if (!window.matchMedia("(min-width: 1280px)").matches) setCollapsed(true);
            }}
          >
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
                  className={`fixed inset-x-0 bottom-0 z-[85] flex flex-col overflow-hidden rounded-t-[22px] border-t text-fg shadow-[0_-20px_60px_-20px_rgb(0_0_0/0.5)] md:inset-x-3 md:bottom-3 md:mx-auto md:max-w-[640px] md:rounded-[22px] md:border xl:right-3 xl:mx-0 print:hidden ${PANEL_TONE} ${collapsed ? "xl:left-auto xl:w-[560px] xl:max-w-none" : "h-[72dvh] md:h-[468px] xl:top-3 xl:left-auto xl:h-auto xl:w-[400px] xl:max-w-none xl:shadow-[-24px_0_60px_-24px_rgb(0_0_0/0.55)]"}`}
                >
                  {collapsed ? (
                    // minimizada: o que está sendo editado e Cancelar / Salvar
                    <div data-metric-edit-bar className="flex items-center gap-3 px-4 py-2.5">
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden>
                        <Pencil size={14} />
                      </span>
                      <p className="min-w-0 flex-1 truncate text-[13px]">
                        <strong className="font-semibold">Editando</strong>
                        <span className="text-fg-2"> · {ask.done ?? (view === "columns" ? `${columns.length} colunas` : `${input.visibleKpis.length} de ${max} cards`)}</span>
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
                      <header data-metric-edit-bar className="flex shrink-0 items-center gap-2.5 border-b border-line px-4 py-3">
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent" aria-hidden>
                          <Pencil size={14} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10.5px] font-medium tracking-[0.06em] text-fg-2 uppercase">Editando</p>
                          <h2 className="truncate text-[15px] leading-tight font-semibold">{input.pageName ?? "Dashboard"}</h2>
                        </div>
                        <button type="button" onClick={() => setCollapsed(true)} aria-label="Minimizar o editor" title="Minimizar o editor" className={ICON_BUTTON}>
                          <ChevronDown size={16} aria-hidden />
                        </button>
                        <button type="button" onClick={cancel} disabled={metrics.pending} aria-label="Fechar sem salvar" title="Fechar sem salvar" className={ICON_BUTTON}>
                          <X size={16} aria-hidden />
                        </button>
                      </header>
                      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
                        {view === "cards" ? (
                          <MetricsView state={state} section="kpis" />
                        ) : view === "columns" ? (
                          <MetricsView state={state} section="columns" />
                        ) : view === "blocks" && input.blocks ? (
                          <BlocksView state={state} blocks={input.blocks} ask={ask} />
                        ) : (
                          <HomeView state={state} ask={ask} />
                        )}
                      </div>
                      <footer className="flex shrink-0 flex-col gap-2 border-t border-line px-4 pt-2.5 pb-3">
                        {metrics.error && (
                          <p role="alert" className="rounded-[10px] bg-error-soft px-3 py-1.5 text-[12px] text-error-fg">
                            {metrics.error}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <p data-dirty={metrics.dirty ? "" : undefined} className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[12px] text-fg-2">
                            {metrics.dirty && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />}
                            {metrics.dirty ? "Mudanças ainda não salvas" : "Nenhuma mudança ainda"}
                          </p>
                          <button type="button" onClick={() => setPreviewing(true)} title="O dashboard como vai ficar, sem o editor. As mudanças continuam sem salvar." className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium text-fg outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent">
                            <Eye size={14} aria-hidden /> Ver como fica
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={cancel} disabled={metrics.pending} className={`${BAR_BUTTON} h-10 flex-1`}>
                            Cancelar
                          </button>
                          <button type="button" onClick={() => void metrics.save()} disabled={metrics.pending} className={`${SAVE_BUTTON} h-10 flex-1 text-[13.5px] focus-visible:ring-offset-2 focus-visible:ring-offset-card`}>
                            {metrics.pending ? "Salvando…" : "Salvar"}
                          </button>
                        </div>
                      </footer>
                    </>
                  )}
                </section>
              )
            }
          </TrayAsk>,
          document.body,
        )}
      <Modal open={guard.open} onClose={guard.keep} title="Sair sem salvar?">
        <p className="text-[14px] text-fg-2">As mudanças do dashboard ainda não foram salvas. Se sair agora, elas se perdem.</p>
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

// ---- partes do painel ------------------------------------------------------------------------------

/** Uma seção do resumo: título à esquerda, contador (o limite) à direita, uma frase curta embaixo. */
function Section({ title, meta, counter, note, action, children }: { title: string; meta?: ReactNode; counter?: boolean; note?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 px-4 py-4">
      <div className="flex min-h-7 items-center gap-2">
        <h3 className="text-[13.5px] font-semibold">{title}</h3>
        {action}
        {meta != null && (
          <span data-metric-counter={counter ? "" : undefined} className="ml-auto text-[12px] font-medium text-fg-2 tnum">
            {meta}
          </span>
        )}
      </div>
      {note && <p className="-mt-1.5 text-[11.5px] leading-snug text-fg-2">{note}</p>}
      {children}
    </section>
  );
}

/** Topo das listas de adicionar: Voltar, o título e o contador. */
function ViewHead({ title, meta, counter, onBack }: { title: string; meta?: string; counter?: boolean; onBack: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onBack} aria-label="Voltar ao resumo" title="Voltar" className={`${ICON_BUTTON} -ml-1.5`}>
        <ArrowLeft size={16} aria-hidden />
      </button>
      <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold">{title}</h3>
      {meta && (
        <span data-metric-counter={counter ? "" : undefined} className="shrink-0 text-[12px] font-medium text-fg-2 tnum">
          {meta}
        </span>
      )}
    </div>
  );
}

/** O fim de cada seção: abre a lista de adicionar dela. */
function AddButton({ children, disabled, onClick, ...rest }: { children: ReactNode; disabled?: boolean; onClick: () => void; "data-add"?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      {...rest}
      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] border border-dashed border-accent/60 text-[13px] font-semibold text-fg outline-none transition-colors hover:border-accent hover:bg-accent-soft/40 focus-visible:ring-2 focus-visible:ring-accent disabled:border-line disabled:text-fg-2 disabled:hover:bg-transparent"
    >
      <Plus size={15} aria-hidden /> {children}
    </button>
  );
}

/** O ícone diz o que o bloco é: gráfico ou tabela do modelo, card de plataforma ou bloco pedido ao Vyz. */
function BlockIcon({ id }: { id: string }) {
  const kind = kindOf(id);
  const cls = "shrink-0 text-fg-2";
  return kind === "metric" ? <Hash size={15} aria-hidden className={cls} /> : kind === "custom" ? <Sparkles size={15} aria-hidden className={cls} /> : <ChartColumn size={15} aria-hidden className={cls} />;
}

/** Uma linha de bloco: apontar acende o bloco na grade; clicar no nome leva até ele. */
function BlockLine({ id, label, meta, state, muted, children }: { id: string; label: string; meta?: string; state: EditorState; muted?: boolean; children: ReactNode }) {
  const lit = state.highlight === id;
  const reveal = () => {
    const el = document.querySelector<HTMLElement>(`[data-block="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    state.setHighlight(id);
  };
  return (
    <li
      data-block-row={id}
      onPointerEnter={() => state.setHighlight(id)}
      onPointerLeave={() => state.setHighlight(null)}
      className={`flex h-11 items-center gap-2 rounded-[10px] pr-1 pl-2 transition-colors ${lit ? "bg-accent-soft" : "hover:bg-[color-mix(in_srgb,var(--fg)_5%,transparent)]"}`}
    >
      <button type="button" onClick={muted ? undefined : reveal} disabled={muted} title={muted ? undefined : "Mostrar no dashboard"} className="flex min-w-0 flex-1 items-center gap-2 rounded-[8px] text-left outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default">
        <BlockIcon id={id} />
        <span className={`min-w-0 truncate text-[13px] font-medium ${muted ? "text-fg-2" : ""}`}>{label}</span>
      </button>
      {meta && <span className="shrink-0 text-[11.5px] text-fg-2">{meta}</span>}
      {children}
    </li>
  );
}

/** Os blocos do modelo ocultos, cada um com Mostrar. */
function HiddenList({ blocks, state }: { blocks: EditorBlocks; state: EditorState }) {
  return (
    <ul className="flex flex-col gap-0.5" aria-label="Ocultos">
      {blocks.hidden.map((b) => (
        <BlockLine key={b.id} id={b.id} label={b.label} state={state} muted>
          <button type="button" onClick={() => blocks.show(b.id)} aria-label={`Mostrar ${b.label}`} className={ROW_ON}>
            <Eye size={13} aria-hidden /> Mostrar
          </button>
        </BlockLine>
      ))}
    </ul>
  );
}

/** Quantas telas a aba vira no dashboard (ele não rola): a grade marca onde cada tela começa. */
function ScreenStatus({ screens, arrange }: { screens: number; arrange?: boolean }) {
  const one = screens <= 1;
  return (
    <div data-screen-status className="flex items-start gap-2.5 px-4 py-3">
      <span className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full ${one ? "bg-accent-soft" : "bg-[color-mix(in_srgb,#d9a23b_24%,transparent)]"}`} aria-hidden>
        {one ? <MonitorCheck size={15} /> : <Monitor size={15} />}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold">{one ? "Tudo cabe numa tela" : `Esta aba ocupa ${screens} telas`}</p>
        <p className="text-[11.5px] leading-snug text-fg-2">
          {one ? "Quem abrir vê a aba inteira, sem rolar." : `A linha tracejada na grade marca onde cada tela começa. Para caber numa só, oculte um bloco${arrange ? " ou diminua a altura" : ""}.`}
        </p>
      </div>
    </div>
  );
}

/** O resumo da aba, na ordem da tela. */
function HomeView({ state, ask }: { state: EditorState; ask: AskState }) {
  const { input, editor, max, columns, open, screens, labelOf, setView } = state;
  const { metrics, visibleKpis, noKpis, goToCards, kpiNote, kpiPlace, blocks, arrange, align, settingsHref } = input;
  const stripHidden = blocks?.kpiStrip === "hidden";
  const full = visibleKpis.length >= max;
  const hasColumns = metrics.catalog.some((m) => !!m.column);

  return (
    <div className="divide-y divide-line">
      {blocks && screens != null && <ScreenStatus screens={screens} arrange={arrange} />}

      <Section title="Cards" meta={noKpis || stripHidden ? undefined : `${visibleKpis.length} de ${max}${kpiPlace ? ` ${kpiPlace}` : ""}`} counter note={noKpis || stripHidden ? undefined : kpiNote}>
        {noKpis ? (
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
        ) : stripHidden && blocks ? (
          <div className="flex items-center gap-2 rounded-[12px] border border-dashed border-line py-2 pr-1.5 pl-3">
            <p className="min-w-0 flex-1 text-[12.5px] text-fg-2">A fileira de cards está oculta nesta aba.</p>
            <button type="button" onClick={() => blocks.show(KPIS_ID)} className={ROW_ON}>
              <Eye size={13} aria-hidden /> Mostrar
            </button>
          </div>
        ) : (
          <>
            <div className="h-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]" aria-hidden>
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.min(100, (visibleKpis.length / max) * 100)}%` }} />
            </div>
            <ul className="flex flex-wrap gap-1.5" aria-label="Na tela">
              {visibleKpis.map((id) => (
                <li key={id} className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card pr-1 pl-3 text-[12px] font-medium">
                  {labelOf(id)}
                  <button
                    type="button"
                    disabled={!editor?.canRemoveKpi}
                    onClick={() => editor?.removeKpi(id)}
                    aria-label={`Tirar ${labelOf(id)}`}
                    title={editor?.canRemoveKpi ? "Tirar da tela" : "Fica pelo menos um"}
                    className="inline-flex size-6 items-center justify-center rounded-full text-fg-2 outline-none hover:bg-error-soft hover:text-error-fg focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30"
                  >
                    <X size={12} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            {full && <p className="text-[11.5px] leading-snug text-fg-2">Chegou ao limite de {max} cards: tire um para pôr outro.</p>}
            <AddButton data-add="cards" onClick={() => open("cards")}>
              Adicionar card
            </AddButton>
          </>
        )}
      </Section>

      {blocks && (
        <Section
          title="Gráficos e tabelas"
          meta={`${blocks.shown.length} na aba`}
          note={arrange ? "Arraste um bloco pelo título para mudar de lugar e pelo canto para mudar o tamanho." : arrange === false ? "Mudar de lugar e de tamanho é do plano Avançado." : undefined}
          action={
            align ? (
              <button type="button" onClick={align} disabled={metrics.pending} title="Fecha os buracos e iguala as alturas, sem trocar a ordem dos blocos" className="inline-flex h-7 items-center gap-1 rounded-full border border-line px-2.5 text-[11.5px] font-medium text-fg outline-none hover:border-fg-2 focus-visible:ring-2 focus-visible:ring-accent">
                <LayoutGrid size={12} aria-hidden /> Arrumar grade
              </button>
            ) : undefined
          }
        >
          {ask.done && (
            <p role="status" className="flex items-start gap-1.5 rounded-[10px] bg-accent-soft px-2.5 py-1.5 text-[12px] font-medium">
              <Check size={13} aria-hidden className="mt-px shrink-0" /> {ask.done}
            </p>
          )}
          <ul className="flex flex-col gap-0.5" aria-label="Na aba">
            {blocks.shown.map((b) => (
              <BlockLine key={b.id} id={b.id} label={b.label} meta={widthLabel(b.w)} state={state}>
                <button type="button" disabled={!blocks.canHide} onClick={() => blocks.hide(b.id)} aria-label={`${b.added ? "Remover" : "Ocultar"} ${b.label}`} title={blocks.canHide ? (b.added ? "Tirar da aba" : "Ocultar (volta por aqui)") : "A aba precisa de pelo menos um bloco"} className={ROW_OFF}>
                  {b.added ? <X size={13} aria-hidden /> : <EyeOff size={13} aria-hidden />} {b.added ? "Remover" : "Ocultar"}
                </button>
              </BlockLine>
            ))}
          </ul>
          {blocks.hidden.length > 0 && (
            <div className="flex flex-col gap-1">
              <h4 className="pt-1 text-[11px] font-semibold tracking-[0.05em] text-fg-2 uppercase">Ocultos ({blocks.hidden.length})</h4>
              <HiddenList blocks={blocks} state={state} />
            </div>
          )}
          <AddButton data-add="blocks" onClick={() => open("blocks")}>
            Adicionar gráfico
          </AddButton>
        </Section>
      )}

      {hasColumns && (
        <button type="button" data-columns-row onClick={() => setView("columns")} className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left outline-none hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset">
          <Columns3 size={15} aria-hidden className="shrink-0 text-fg-2" />
          <span className="flex-1 text-[13.5px] font-semibold">Colunas das tabelas</span>
          <span className="text-[12px] font-medium text-fg-2 tnum">
            {columns.length} {columns.length === 1 ? "coluna" : "colunas"}
          </span>
          <ChevronRight size={16} aria-hidden className="text-fg-2" />
        </button>
      )}

      <div className="flex flex-wrap gap-2 px-4 py-3.5">
        <button type="button" onClick={metrics.restore} disabled={metrics.pending} title="Volta os cards, as colunas e a disposição do modelo (vale depois do Salvar)" className={BAR_BUTTON}>
          <RotateCcw size={14} aria-hidden /> Restaurar padrão
        </button>
        {settingsHref && (
          <Link href={settingsHref} className={BAR_BUTTON}>
            <Settings2 size={14} aria-hidden /> Nome, contas e metas
          </Link>
        )}
      </div>
    </div>
  );
}

/** Adicionar gráfico: o pedido ao Vyz, os blocos do modelo ocultos e os cards de cada plataforma. */
function BlocksView({ state, blocks, ask }: { state: EditorState; blocks: EditorBlocks; ask: AskState }) {
  const { setView, focusTick, input } = state;
  useEffect(() => {
    if (focusTick > 0) ask.inputRef.current?.focus();
  }, [ask.inputRef, focusTick]);
  const asking = !!(ask.plan || ask.reading);
  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <ViewHead title="Adicionar gráfico" onBack={() => setView("home")} />
      {ask.host && <AskInput ask={ask} />}
      {asking ? (
        <AskPlan ask={ask} />
      ) : (
        <>
          {ask.host && (
            <p className="-mt-2 text-[11.5px] text-fg-2 tnum">
              Pedidos nesta aba: {blocks.custom.count} de {blocks.custom.max}
            </p>
          )}
          {blocks.hidden.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <h4 className="text-[13px] font-semibold">Do modelo, ocultos</h4>
                <span className="ml-auto text-[12px] text-fg-2 tnum">{blocks.hidden.length}</span>
              </div>
              <HiddenList blocks={blocks} state={state} />
            </div>
          )}
          {blocks.platform && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <h4 className="text-[13px] font-semibold">Cards por plataforma</h4>
                <span className="ml-auto text-[12px] text-fg-2 tnum">
                  {blocks.platform.count} de {blocks.platform.max}
                </span>
              </div>
              <p className="text-[11.5px] leading-snug text-fg-2">{input.arrange ? "Toque em + ou arraste até a grade, no lugar que quiser." : "Toque em + e o card entra no primeiro espaço livre da aba."}</p>
              {blocks.platform.render()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Adicionar card ou escolher as colunas: busca, categorias e a lista (com o valor de cada métrica). */
function MetricsView({ state, section }: { state: EditorState; section: MetricSection }) {
  const { input, focusTick, setDragging, canAdd, add, columns, editor, max, setView, labelOf } = state;
  const { metrics, visibleKpis, hasData, valueOf, unavailable, kpiNote } = input;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<MetricGroup | "todas">("todas");
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
  const active = tab === "todas" || groups.includes(tab) ? tab : "todas";
  const visible = section === "kpis" ? visibleKpis : columns;
  // a lista mostra só o que ainda não está na tela (o que está fica no resumo, com o ✕)
  const shown = list.filter((m) => (active === "todas" || m.group === active) && !(!reasons.has(m.id) && visible.includes(m.id)));

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {section === "kpis" ? (
        <ViewHead title="Adicionar card" meta={`${visibleKpis.length} de ${max}`} counter onBack={() => setView("home")} />
      ) : (
        <>
          <ViewHead title="Colunas das tabelas" meta={`${columns.length} ${columns.length === 1 ? "coluna" : "colunas"}`} onBack={() => setView("home")} />
          <p className="-mt-1.5 text-[11.5px] leading-snug text-fg-2">Valem para todas as tabelas do dashboard. Também dá para tirar pelo ✕ no cabeçalho da tabela.</p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Na tabela">
            {columns.map((id) => (
              <li key={id} className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-card pr-1 pl-3 text-[12px] font-medium">
                {labelOf(id)}
                <button
                  type="button"
                  disabled={!editor?.canRemoveColumn}
                  onClick={() => editor?.removeColumn(id)}
                  aria-label={`Tirar ${labelOf(id)}`}
                  title={editor?.canRemoveColumn ? "Tirar da tabela" : "Fica pelo menos uma"}
                  className="inline-flex size-6 items-center justify-center rounded-full text-fg-2 outline-none hover:bg-error-soft hover:text-error-fg focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30"
                >
                  <X size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <label className="flex h-9 items-center gap-2 rounded-full border border-line bg-field px-3 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
        <Search size={14} aria-hidden className="shrink-0 text-fg-2" />
        <span className="sr-only">Buscar métrica</span>
        <input ref={searchRef} data-metric-search value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar métrica" className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg-2/70" />
      </label>
      <div role="tablist" aria-label="Categorias de métricas" className="flex flex-wrap gap-1">
        {(["todas", ...groups] as const).map((g) => (
          <button key={g} type="button" role="tab" data-tray-tab aria-selected={g === active} onClick={() => setTab(g)} className={`rounded-full px-2.5 py-1 text-[12px] font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-accent ${g === active ? "bg-fg text-bg" : "text-fg-2 hover:bg-surface-2 hover:text-fg"}`}>
            {g === "todas" ? "Todas" : METRIC_GROUP_LABEL[g]}
          </button>
        ))}
      </div>
      <p data-metric-help className="min-h-[1.2em] truncate text-[11.5px] text-fg-2" title={help?.help}>
        {help ? (
          <>
            <strong className="font-medium text-fg">{help.label}:</strong> {help.help}
          </>
        ) : (
          (kpiNote ?? (section === "kpis" ? "Toque em ⓘ para ver o que a métrica mede, ou arraste até a fileira de cards." : "Toque em ⓘ para ver o que a métrica mede."))
        )}
      </p>
      {!list.length && <p className="py-4 text-center text-[13px] text-fg-2">Nenhuma métrica com esse nome.</p>}
      {list.length > 0 && !shown.length && <p className="py-4 text-center text-[12.5px] text-fg-2">Tudo desta categoria já está na tela.</p>}
      <ul className="flex flex-col gap-1.5">
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
                <p className="truncate text-[12.5px] leading-tight font-medium text-fg">{m.label}</p>
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
    </div>
  );
}

/** O pedido vive enquanto o editor está aberto: fechar ou salvar começa do zero. */
function TrayAsk({ host, kpi, onApplied, children }: { host?: AskHost; kpi: Parameters<typeof useAsk>[1]; onApplied: () => void; children: (ask: AskState) => ReactNode }) {
  return children(useAsk(host, kpi, onApplied));
}
