"use client";

// O modo personalizar visto de dentro do dashboard: o ✕ dos cards e das colunas, o "+ card"
// no fim da fileira, a fileira que recebe o card arrastado, o bloco apontado (acende na
// grade e no painel ao mesmo tempo) e quantas telas a aba vira. Arquivo leve, sem a bandeja:
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
  /** Encaixe vazio ou "+ card": abre a lista de cards do painel com o foco na busca. */
  openTray: () => void;
  dragging: boolean;
  /** A fileira ainda aceita um card. */
  canDrop: boolean;
  dropKpi: (id: string) => void;
  /** Bloco apontado no painel ou na grade: os dois acendem juntos. */
  highlight: string | null;
  setHighlight: (id: string | null) => void;
  /** A grade avisa em quantas telas a aba vai aparecer (null: não mede, como no celular). */
  setScreens: (n: number | null) => void;
};

const Ctx = createContext<MetricEditor | null>(null);

export const MetricEditProvider = ({ value, children }: { value: MetricEditor | null; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
export const useMetricEditor = () => useContext(Ctx);

export const DRAG_TYPE = "application/x-vyz-metric";

// A guarda de saída desfaz uma entrada do histórico, e isso leva um instante. Quem precisa
// trocar o endereço ao sair do modo espera aqui, senão a troca se perde.
let settling: Promise<void> | null = null;
export const markLeaveGuardSettling = (p: Promise<void>) => {
  settling = p.finally(() => {
    settling = null;
  });
};
export const afterLeaveGuard = (run: () => void) => {
  if (settling) void settling.then(run);
  else run();
};

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

/** Fileira única (a da grade): no fim dela, um "+ card" enquanto houver vaga. */
export function AddCardTile({ free, onClick, className = "" }: { free: number; onClick: () => void; className?: string }) {
  if (free <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      data-add-card
      data-free={free}
      aria-label={`Adicionar card (${free} ${free === 1 ? "vaga" : "vagas"})`}
      title={`${free} ${free === 1 ? "vaga" : "vagas"} na fileira`}
      className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-card border border-dashed border-accent/60 px-3 text-[12.5px] font-semibold text-fg outline-none hover:border-accent hover:bg-accent-soft/40 focus-visible:ring-2 focus-visible:ring-accent print:hidden ${className}`}
    >
      <span className="flex items-center gap-1">
        <Plus size={14} aria-hidden /> Card
      </span>
      <span className="text-[11px] font-medium text-fg-2 tnum">
        {free} {free === 1 ? "vaga" : "vagas"}
      </span>
    </button>
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
