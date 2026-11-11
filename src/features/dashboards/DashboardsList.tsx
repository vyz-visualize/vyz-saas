"use client";

import { Plus, Radio, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { EmptyState, Modal, PageHeader } from "@/components/ui/kit";
import { ScaledPreview } from "@/components/ui/ScaledPreview";
import { btn } from "@/components/ui/styles";
import { UsageBar } from "@/features/accounts/AccountsPage";
import { PLATFORMS } from "@/features/accounts/platforms";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { anyDashboardTemplate } from "@/features/templates/live";
import { deleteDashboard } from "@/server/dashboards/actions";
import { datasetFor, pageLayout } from "./data";
import type { DashboardListItem } from "./model";
import { SkinView } from "./skins";
import { PageView } from "./widgets/PageView";
import { makeContext } from "./widgets/Widgets";

/** Miniatura dos templates de exemplo (dados de amostra, mesmos números do dashboard). */
export function DashboardThumb({ d }: { d: Pick<DashboardListItem, "templateId" | "name" | "client" | "pages" | "settings"> }) {
  const t = dashboardTemplate(d.templateId);
  if (!t) return null;
  const ds = datasetFor(d, 30);
  const first = d.pages[0] ?? t.pages[0];
  // modelo com visual próprio: a miniatura é o próprio visual (a primeira aba dele), não os blocos padrão
  if (t.skin && first === t.pages[0]) {
    return (
      <ScaledPreview height={150} width={1100}>
        <div inert>
          <SkinView skin={t.skin} ctx={makeContext(ds)} name={d.name} client={d.client} pages={d.pages.length ? d.pages : t.pages} active={first} periodLabel="Últimos 30 dias" />
        </div>
      </ScaledPreview>
    );
  }
  return (
    <ScaledPreview height={150} width={760}>
      <div className="bg-bg p-3">
        <PageView layout={pageLayout(t, d.pages[0] ?? t.pages[0])} ctx={makeContext(ds)} variant="compact" />
      </div>
    </ScaledPreview>
  );
}

/** Miniatura dos dashboards com dados reais: as contas que alimentam, sem consultar nada. */
function LiveThumb({ d }: { d: DashboardListItem }) {
  const enabled = d.sources.filter((s) => s.isEnabled);
  return (
    <div className="relative flex h-[150px] flex-col justify-between overflow-hidden bg-bg p-4">
      <svg viewBox="0 0 300 80" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-20 w-full text-accent" aria-hidden>
        <path d="M0 62 C40 58 60 40 100 44 S170 20 210 28 S270 12 300 8 L300 80 L0 80 Z" fill="currentColor" opacity="0.1" />
        <path d="M0 62 C40 58 60 40 100 44 S170 20 210 28 S270 12 300 8" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-chip bg-accent-soft px-2 py-0.5 text-[11.5px] font-medium text-fg">
        <Radio size={12} aria-hidden /> Dados reais
      </span>
      <p className="relative line-clamp-2 text-[12.5px] text-fg-2">{enabled.length ? enabled.map((s) => s.name).join(" · ") : "Nenhuma conta ativa ligada"}</p>
    </div>
  );
}

type Props = {
  items: DashboardListItem[];
  /** Limite do plano (dashboards). */
  limit: number;
  planLabel: string;
  /** viewer só olha. */
  canEdit: boolean;
};

export function DashboardsList({ items, limit, planLabel, canEdit }: Props) {
  const [removing, setRemoving] = useState<DashboardListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const atLimit = items.length >= limit;

  function remove() {
    if (!removing) return;
    setError(null);
    start(async () => {
      const r = await deleteDashboard(removing.id);
      if (r.ok) setRemoving(null);
      else setError(r.error.message);
    });
  }

  const newButton = canEdit && (
    <Link href="/painel/dashboards/novo?novo=1" className={btn.small}>
      <Plus size={16} aria-hidden /> Novo dashboard
    </Link>
  );

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Dashboards" title="Meus dashboards" text="Cada dashboard parte de um template e lê as contas que você ligou a ele." actions={newButton} />
      <div className="rounded-card border border-line bg-card p-4">
        <UsageBar used={items.length} limit={limit} label={`Dashboards × limite do ${planLabel}`} />
        {atLimit && canEdit && <p className="mt-2 text-[13px] text-fg-2">Você chegou ao limite do plano. Apague um dashboard ou troque de plano em Plano.</p>}
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="Nenhum dashboard ainda"
          text={canEdit ? "Escolha um template, ligue as contas e mande o link para o cliente. Leva poucos minutos." : "Quando alguém da equipe criar um dashboard, ele aparece aqui."}
          action={newButton || undefined}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((d) => {
            const t = anyDashboardTemplate(d.templateId);
            return (
              <li key={d.id} className="group relative overflow-hidden rounded-card border border-line bg-card transition-colors hover:border-accent">
                <Link href={`/painel/dashboards/${d.id}`} className="block rounded-card outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <div className="border-b border-line">{d.live ? <LiveThumb d={d} /> : <DashboardThumb d={d} />}</div>
                  <div className="p-4">
                    <p className="truncate font-semibold">{d.name}</p>
                    <p className="truncate text-[13px] text-fg-2">
                      {[d.client, t?.name].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-2 flex flex-wrap gap-1">
                      {(t?.sources ?? []).map((s) => (
                        <span key={s} className="rounded-chip border border-line px-2 py-0.5 text-[11px] text-fg-2">
                          {PLATFORMS[s].short}
                        </span>
                      ))}
                      {!d.live && <span className="rounded-chip border border-dashed border-line px-2 py-0.5 text-[11px] text-fg-2">Amostra</span>}
                    </p>
                  </div>
                </Link>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Apagar ${d.name}`}
                    onClick={() => {
                      setError(null);
                      setRemoving(d);
                    }}
                    className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-control border border-line bg-card opacity-100 transition-opacity hover:border-error focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <DeleteDashboardModal dashboard={removing} pending={pending} error={error} onConfirm={remove} onClose={() => setRemoving(null)} />
    </div>
  );
}

/** Confirmação de apagar (lista e tela do dashboard). */
export function DeleteDashboardModal({
  dashboard,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  dashboard: { name: string } | null;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={!!dashboard} onClose={onClose} title="Apagar dashboard">
      {dashboard && (
        <div className="space-y-4 text-[14px]">
          <p>
            Apagar <strong>{dashboard.name}</strong>? Os links compartilhados param de abrir e os relatórios agendados dele são cancelados. O histórico de exportações fica.
          </p>
          {error && (
            <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-[13px] text-error-fg">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${btn.small} bg-error`} onClick={onConfirm} disabled={pending}>
              {pending ? "Apagando…" : "Apagar"}
            </button>
            <button type="button" className={`${btn.ghost} h-9`} onClick={onClose} disabled={pending}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
