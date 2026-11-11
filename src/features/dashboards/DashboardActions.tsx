"use client";

// Botões do topo do dashboard no painel: editar, compartilhar e exportar PDF à
// vista; duplicar, agendar relatório e excluir no menu. Os botões nunca quebram
// linha: se faltar espaço, vão para o menu, a partir do último.

import { CalendarClock, Copy, FileDown, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FIT_HIDDEN, useFitItems } from "@/components/ui/fit-items";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { ReportModal } from "@/features/share/ReportModal";
import { ShareModal } from "@/features/share/ShareModal";
import { deleteDashboard, duplicateDashboard, recordExport } from "@/server/dashboards/actions";
import { DeleteDashboardModal } from "./DashboardsList";

const action =
  "inline-flex h-9 items-center gap-1.5 rounded-control border border-line px-3 text-[13.5px] font-medium outline-none hover:border-accent focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50 shrink-0 whitespace-nowrap";

const GAP = 8;
const TITLE_GAP = 16;

type Props = {
  dashboard: { id: string; name: string; live: boolean };
  /** Período aberto e páginas (vão para o histórico da exportação). */
  period: string;
  pages: number;
  /** Exportação própria (dashboards de exemplo imprimem todas as páginas); padrão: imprime a tela. */
  onExport?: () => void;
};

/** Registra a exportação no servidor e abre a impressão (Salvar como PDF). */
export function useExport(input: { dashboardId: string; period: string; pages: number }, print: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () => {
    setError(null);
    start(async () => {
      const r = await recordExport(input);
      if (!r.ok) return setError(r.error.message);
      print();
    });
  };
  return { run, pending, error };
}

export function DashboardActions({ dashboard, period, pages, onExport }: Props) {
  const router = useRouter();
  const [share, setShare] = useState(false);
  const [report, setReport] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const exporter = useExport({ dashboardId: dashboard.id, period, pages }, onExport ?? (() => window.print()));

  // a mensagem de erro some sozinha
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 6000);
    return () => window.clearTimeout(t);
  }, [error]);

  function duplicate() {
    setError(null);
    start(async () => {
      const r = await duplicateDashboard(dashboard.id);
      if (r && !r.ok) setError(r.error.message);
    });
  }

  function remove() {
    setError(null);
    start(async () => {
      const r = await deleteDashboard(dashboard.id);
      if (!r.ok) return setError(r.error.message);
      setRemoving(false);
      router.push("/painel/dashboards");
    });
  }

  const editHref = `/painel/dashboards/${dashboard.id}/editar`;
  const exportLabel = exporter.pending ? "Preparando…" : "Exportar PDF";
  // logo e título ficam com pelo menos metade da linha (até 360 px); na barra do topo da tela
  // cheia ([data-actions-slot]) o espaço medido já é só o das ações
  const { rootRef, moreRef, itemRef, visible } = useFitItems({
    count: 3,
    gap: GAP,
    always: true,
    measureParent: true,
    available: (width, box) => (box.hasAttribute("data-actions-slot") ? width : width - TITLE_GAP - Math.min(360, width / 2)),
    deps: [exporter.pending],
  });
  const show = (i: number) => (visible.includes(i) ? "" : FIT_HIDDEN);

  const shown = error ?? exporter.error;
  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center print:hidden" style={{ gap: GAP }}>
      <Link ref={itemRef(0)} href={editHref} className={`${action} ${show(0)}`}>
        <Pencil size={15} aria-hidden /> Editar
      </Link>
      <button ref={itemRef(1)} type="button" onClick={() => setShare(true)} className={`${action} ${show(1)}`}>
        <Share2 size={15} aria-hidden /> Compartilhar
      </button>
      <button ref={itemRef(2)} type="button" onClick={exporter.run} disabled={exporter.pending} className={`${action} ${show(2)}`}>
        <FileDown size={15} aria-hidden /> {exportLabel}
      </button>
      <Menu modal={false}>
        <MenuTrigger ref={moreRef as React.Ref<HTMLButtonElement>} aria-label="Mais ações" className={`${action} px-2.5`}>
          <MoreHorizontal size={15} aria-hidden />
        </MenuTrigger>
        <MenuContent align="end">
          {!visible.includes(0) && (
            <MenuItem icon={<Pencil size={15} />} onSelect={() => router.push(editHref)}>
              Editar
            </MenuItem>
          )}
          {!visible.includes(1) && (
            <MenuItem icon={<Share2 size={15} />} onSelect={() => setShare(true)}>
              Compartilhar
            </MenuItem>
          )}
          {!visible.includes(2) && (
            <MenuItem icon={<FileDown size={15} />} disabled={exporter.pending} onSelect={exporter.run}>
              {exportLabel}
            </MenuItem>
          )}
          {visible.length < 3 && <MenuSeparator />}
          <MenuItem icon={<Copy size={15} />} disabled={pending} onSelect={duplicate}>
            {pending && !removing ? "Duplicando…" : "Duplicar"}
          </MenuItem>
          <MenuItem icon={<CalendarClock size={15} />} onSelect={() => setReport(true)}>
            Agendar relatório
          </MenuItem>
          <MenuItem icon={<Trash2 size={15} />} className="text-error-fg" onSelect={() => setRemoving(true)}>
            Excluir
          </MenuItem>
        </MenuContent>
      </Menu>
      {shown && (
        <p role="alert" className="absolute top-full right-0 z-10 mt-1 w-max max-w-[320px] rounded-control bg-error-soft px-3 py-2 text-[13px] text-error-fg">
          {shown}
        </p>
      )}
      <ShareModal open={share} onClose={() => setShare(false)} dashboard={dashboard} />
      <ReportModal open={report} onClose={() => setReport(false)} dashboard={dashboard} />
      <DeleteDashboardModal dashboard={removing ? dashboard : null} pending={pending} error={removing ? error : null} onConfirm={remove} onClose={() => setRemoving(false)} />
    </div>
  );
}
