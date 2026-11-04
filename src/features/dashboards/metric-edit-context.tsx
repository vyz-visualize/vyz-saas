"use client";

// O modo personalizar visto de dentro das fileiras de cards e das tabelas: o ✕, os
// encaixes vazios e a fileira que recebe o card arrastado. Arquivo leve, sem a bandeja:
// os cards também aparecem na landing page, onde este contexto fica vazio.

import { Plus, X } from "lucide-react";
import { createContext, useContext, useState, type DragEvent, type ReactNode } from "react";
import type { MetricSection } from "./metric-prefs";

export type MetricEditor = {
  section: MetricSection;
  /** Quantos encaixes a fileira tem. */
  slots: number;
  canRemoveKpi: boolean;
  canRemoveColumn: boolean;
  removeKpi: (id: string) => void;
  removeColumn: (id: string) => void;
  /** Encaixe vazio: abre a bandeja com o foco na busca. */
  openTray: () => void;
  dragging: boolean;
  /** A fileira ainda aceita um card. */
  canDrop: boolean;
  dropKpi: (id: string) => void;
};

const Ctx = createContext<MetricEditor | null>(null);

export const MetricEditProvider = ({ value, children }: { value: MetricEditor | null; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useMetricEditor = () => useContext(Ctx);

export const DRAG_TYPE = "application/x-vyz-metric";

export function RemoveMetricButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remover ${label}`}
      title="Remover"
      className="absolute top-1.5 right-1.5 z-10 inline-flex size-6 items-center justify-center rounded-full border border-line bg-card text-fg outline-none hover:border-error hover:text-error-fg focus-visible:ring-2 focus-visible:ring-accent print:hidden"
    >
      <X size={13} aria-hidden />
    </button>
  );
}

export function RemoveColumnButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={`Remover coluna ${label}`} title="Remover coluna" className="ml-1 inline-flex size-4 items-center justify-center rounded-full border border-line align-[-2px] text-fg outline-none hover:border-error hover:text-error-fg focus-visible:ring-2 focus-visible:ring-accent print:hidden">
      <X size={10} aria-hidden />
    </button>
  );
}

/**
 * Os vazios ficam numa fileira só, baixa, abaixo dos cards. Com muitos num espaço estreito,
 * cada um mostra só o +: quem decide é a largura do próprio encaixe.
 */
export function EmptySlots({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null;
  return (
    <div data-empty-row className="col-span-full flex gap-2 print:hidden">
      {Array.from({ length: count }, (_, i) => (
        <button key={i} type="button" onClick={onClick} data-empty-slot aria-label="Encaixe vazio: abrir a bandeja" className="@container h-14 max-w-60 min-w-0 flex-1 rounded-card border border-dashed border-line text-[12.5px] font-medium text-fg-2 outline-none hover:border-accent hover:text-fg focus-visible:ring-2 focus-visible:ring-accent">
          <span className="flex items-center justify-center gap-1">
            <Plus size={14} aria-hidden /> <span className="hidden @[84px]:inline">encaixe</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * A fileira inteira recebe o card: a ordem segue o padrão, então destacar um encaixe
 * prometeria uma posição que o card não vai ocupar.
 */
export function useKpiDropRow() {
  const editor = useMetricEditor();
  const [over, setOver] = useState(false);
  if (!editor || editor.section !== "kpis") return { props: {}, overlay: null as ReactNode };
  const accepts = (e: DragEvent) => editor.canDrop && e.dataTransfer.types.includes(DRAG_TYPE);
  return {
    props: {
      onDragOver: (e: DragEvent) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      },
      onDragLeave: (e: DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      },
      onDrop: (e: DragEvent) => {
        setOver(false);
        const id = e.dataTransfer.getData(DRAG_TYPE);
        if (!id || !accepts(e)) return;
        e.preventDefault();
        editor.dropKpi(id);
      },
    },
    overlay: editor.dragging ? (
      <div aria-hidden className={`pointer-events-none absolute -inset-1 z-20 flex items-center justify-center rounded-card border-2 border-dashed transition-colors duration-150 ${!editor.canDrop ? "border-line bg-card/70" : over ? "border-accent bg-accent-soft/70" : "border-accent/60 bg-accent-soft/30"}`}>
        <span className="rounded-chip bg-fg px-3 py-1 text-[13px] font-medium text-bg">{editor.canDrop ? "Solte para adicionar" : "Limite de cards atingido"}</span>
      </div>
    ) : null,
  };
}
