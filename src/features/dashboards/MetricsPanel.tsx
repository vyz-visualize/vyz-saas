"use client";

// Painel "Personalizar": mostra ou oculta as métricas da plataforma. A partir de
// 1280 px o dashboard encolhe para o lado dele (regra em globals.css); abaixo disso
// fica por cima, e em tela cheia no celular. Radix Dialog: foco preso, Esc fecha.

import { Info, Search, SlidersHorizontal, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { Switch } from "@/components/ui/controls";
import { Segmented } from "@/components/ui/Segmented";
import { btn } from "@/components/ui/styles";
import { METRIC_GROUP_LABEL, METRIC_GROUPS, METRIC_SECTION_LABEL, sectionMax, toggleBlock, visibleIds, type CatalogMetric, type MetricSection, type ScopePrefs } from "./metric-prefs";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CustomizeButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-9 items-center gap-1.5 rounded-control border border-line px-3 text-[13.5px] font-medium outline-none hover:border-accent focus-visible:ring-2 focus-visible:ring-accent print:hidden">
      <SlidersHorizontal size={15} aria-hidden /> Personalizar
    </button>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  catalog: readonly CatalogMetric[];
  prefs: ScopePrefs | undefined;
  hasData: (id: string) => boolean;
  onToggle: (section: MetricSection, id: string) => void;
  onRestore: () => void;
  onSave: () => void;
  pending: boolean;
  error: string | null;
};

export function MetricsPanel({ open, onClose, catalog, prefs, hasData, onToggle, onRestore, onSave, pending, error }: Props) {
  const [section, setSection] = useState<MetricSection>("kpis");
  const [query, setQuery] = useState("");
  const [help, setHelp] = useState<string | null>(null);

  const sectionPrefs = prefs?.[section];
  const visible = useMemo(() => visibleIds(catalog, section, sectionPrefs), [catalog, section, sectionPrefs]);
  const max = sectionMax(catalog, section);
  const list = useMemo(() => {
    const q = fold(query.trim());
    return catalog.filter((m) => (section === "kpis" ? !!m.kpi : !!m.column) && (!q || fold(`${m.label} ${m.help}`).includes(q)));
  }, [catalog, query, section]);

  // o Dialog trava a página; a roda do mouse fora do painel continua rolando o dashboard, para ver as tabelas mudarem
  useEffect(() => {
    if (!open) return;
    const onWheel = (e: WheelEvent) => {
      if (e.target instanceof Element && e.target.closest("[data-metrics-panel]")) return;
      document.querySelector(".shell-content")?.scrollBy({ top: e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY });
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        {/* sem fundo escuro: a página atrás mostra o resultado. Clique fora não descarta a escolha */}
        <Dialog.Content
          data-metrics-panel
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed inset-0 z-[110] flex flex-col bg-card text-fg outline-none sm:inset-y-3 sm:right-3 sm:left-auto sm:w-[400px] sm:rounded-[20px] sm:border sm:border-line xl:rounded-[24px] print:hidden"
        >
          <header className="flex items-start gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-[15px] font-semibold">Personalizar métricas</Dialog.Title>
              <Dialog.Description className="text-[12.5px] text-fg-2">Escolha o que aparece neste dashboard, no link e no PDF.</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Fechar sem salvar" className="inline-flex size-9 shrink-0 items-center justify-center rounded-control text-fg-2 outline-none hover:bg-accent-soft hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
              <X size={18} aria-hidden />
            </Dialog.Close>
          </header>

          <div className="space-y-3 border-b border-line px-4 py-3">
            <Segmented<MetricSection>
              label="O que personalizar"
              size="sm"
              block
              value={section}
              onChange={setSection}
              options={[
                { value: "kpis", label: METRIC_SECTION_LABEL.kpis },
                { value: "columns", label: METRIC_SECTION_LABEL.columns },
              ]}
            />
            <label className="flex h-9 items-center gap-2 rounded-control border border-line bg-field px-2.5 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
              <Search size={15} aria-hidden className="shrink-0 text-fg-2" />
              <span className="sr-only">Buscar métrica</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar métrica" className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-fg-2/70" />
            </label>
            <p role="status" className="text-[12.5px] text-fg-2 tnum">
              {max === null ? `${visible.length} ${visible.length === 1 ? "coluna visível" : "colunas visíveis"}` : `${visible.length} de ${max} cards`} · pelo menos 1
            </p>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {METRIC_GROUPS.map((group) => {
              const items = list.filter((m) => m.group === group);
              if (!items.length) return null;
              return (
                <section key={group} aria-label={METRIC_GROUP_LABEL[group]}>
                  <h3 className="mb-1.5 text-[11.5px] font-medium tracking-[0.06em] text-fg-2 uppercase">{METRIC_GROUP_LABEL[group]}</h3>
                  <ul className="divide-y divide-line/60">
                    {items.map((m) => {
                      const noData = !hasData(m.id);
                      const block = toggleBlock(catalog, section, sectionPrefs, m.id);
                      const on = visible.includes(m.id);
                      return (
                        <li key={m.id} className="py-2" onPointerEnter={(e) => e.pointerType === "mouse" && setHelp(m.id)} onPointerLeave={(e) => e.pointerType === "mouse" && setHelp(null)}>
                          <div className="flex items-center justify-between gap-2">
                            <Switch
                              label={m.label}
                              checked={on}
                              disabled={noData || !!block}
                              onChange={() => onToggle(section, m.id)}
                              hint={noData ? "sem dados nesta conta" : block === "min" ? "É a última visível" : block === "max" ? `Limite de ${max} cards` : undefined}
                            />
                            <button
                              type="button"
                              aria-label={`O que é ${m.label}`}
                              aria-expanded={help === m.id}
                              onClick={() => setHelp((h) => (h === m.id ? null : m.id))}
                              className="inline-flex size-8 shrink-0 items-center justify-center rounded-control text-fg-2 outline-none hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
                            >
                              <Info size={15} aria-hidden />
                            </button>
                          </div>
                          {help === m.id && <p className="mt-1 text-[12.5px] leading-snug text-fg-2">{m.help}</p>}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            {list.length === 0 && <p className="text-[13.5px] text-fg-2">Nenhuma métrica com esse nome.</p>}
          </div>

          <footer className="border-t border-line p-3">
            {error && (
              <p role="alert" className="mb-2 rounded-control bg-error-soft px-3 py-1.5 text-[12.5px] text-error-fg">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onRestore} disabled={pending} className={`${btn.ghost} h-10 flex-1 border border-line`}>
                Restaurar padrão
              </button>
              <button type="button" onClick={onSave} disabled={pending} className={`${btn.small} h-10 flex-1`}>
                {pending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
