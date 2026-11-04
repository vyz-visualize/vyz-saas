"use client";

// Atalho dos cards de KPI para quem pode editar: ocultar pelo próprio card, com
// aviso e Desfazer. Sem o Radix do painel: os cards também aparecem na landing page.

import { EyeOff } from "lucide-react";
import { useEffect, useRef } from "react";
import type { MetricNotice } from "./metric-prefs-context";

const NOTICE_MS = 6000;

export function HideMetricButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ocultar ${label}`}
      title="Ocultar"
      className="pointer-events-none absolute top-1.5 right-1.5 inline-flex size-6 items-center justify-center rounded-[6px] bg-inherit text-current opacity-0 outline-none transition-opacity duration-150 group-hover/kpi:pointer-events-auto group-hover/kpi:opacity-70 hover:!opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent print:hidden"
    >
      <EyeOff size={14} aria-hidden />
    </button>
  );
}

export function MetricNoticeBar({ notice, onUndo, onDismiss }: { notice: MetricNotice | null; onUndo: () => void; onDismiss: () => void }) {
  const undoRef = useRef<HTMLButtonElement>(null);
  const id = notice?.id;

  useEffect(() => {
    if (id === undefined) return;
    // o botão de ocultar sumiu junto com o card: o foco do teclado não fica perdido
    if (document.activeElement === document.body) undoRef.current?.focus({ preventScroll: true });
    const t = window.setTimeout(onDismiss, NOTICE_MS);
    return () => window.clearTimeout(t);
  }, [id, onDismiss]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex justify-center px-4 lg:bottom-8 print:hidden">
      {notice && (
        <p className="pointer-events-auto inline-flex items-center gap-2 rounded-chip bg-fg px-4 py-2 text-[13.5px] font-medium text-bg">
          {notice.text}
          {notice.before && (
            <>
              <span aria-hidden>·</span>
              <button ref={undoRef} type="button" onClick={onUndo} className="rounded-[4px] font-semibold underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-accent">
                Desfazer
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
