"use client";

import { Copy, MoreHorizontal, Pencil, Plus, Radio, Shuffle, Trash2 } from "lucide-react";
import { ChangeTemplateModal, type ChangeTemplateTarget } from "./ChangeTemplateModal";
import { NewDashboardDialog } from "./NewDashboardDialog";
import type { SourceOption } from "./model";
import type { Tier } from "@/features/pricing/entitlements";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge, EmptyState, Modal, ModalActions, PageHeader } from "@/components/ui/kit";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { ScaledPreview } from "@/components/ui/ScaledPreview";
import { btn } from "@/components/ui/styles";
import { PLATFORMS } from "@/features/accounts/platforms";
import { dashboardTemplate } from "@/features/templates/dashboards";
import { anyDashboardTemplate } from "@/features/templates/live";
import { deleteDashboard, duplicateDashboard } from "@/server/dashboards/actions";
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
  // a miniatura é só ilustração dentro do link (o nome do dashboard vem no texto do cartão)
  if (t.skin && first === t.pages[0]) {
    return (
      <ScaledPreview height={150} width={1100}>
        <div inert aria-hidden className="tokens-brand text-fg">
          <SkinView skin={t.skin} ctx={makeContext(ds)} name={d.name} client={d.client} pages={d.pages.length ? d.pages : t.pages} active={first} periodLabel="Últimos 30 dias" />
        </div>
      </ScaledPreview>
    );
  }
  return (
    <ScaledPreview height={150} width={760}>
      <div inert aria-hidden className="tokens-brand bg-bg p-3 text-fg">
        <PageView layout={pageLayout(t, d.pages[0] ?? t.pages[0])} ctx={makeContext(ds)} variant="compact" />
      </div>
    </ScaledPreview>
  );
}

/** Miniatura dos dashboards com dados reais: as contas que alimentam, sem consultar nada. */
function LiveThumb({ d }: { d: DashboardListItem }) {
  const enabled = d.sources.filter((s) => s.isEnabled);
  return (
    <div className="relative flex h-[150px] flex-col justify-between overflow-hidden bg-surface-2/60 p-4">
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
  /** Para o popup de novo dashboard. */
  sources: SourceOption[];
  tier: Tier;
  pagesTier: Tier;
  /** Abre o popup já ao carregar (?novo=1). */
  openNew?: boolean;
  brand: { color: string; logoUrl: string | null; canEdit: boolean };
  hasProject: boolean;
  /** Dentro de um workspace: o nome dele (cabeçalho da aba) e o total da organização (o limite do plano conta todos). */
  workspaceName?: string;
  used?: number;
};

export function DashboardsList({ items, limit, planLabel, canEdit, sources, tier, pagesTier, openNew = false, brand, hasProject, workspaceName, used = items.length }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(openNew && canEdit && used < limit);
  const [removing, setRemoving] = useState<DashboardListItem | null>(null);
  const [switching, setSwitching] = useState<ChangeTemplateTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const atLimit = used >= limit;

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
    <button type="button" className={btn.small} onClick={() => setCreating(true)} disabled={atLimit} title={atLimit ? "Limite do plano atingido" : undefined}>
      <Plus size={16} aria-hidden /> Novo dashboard
    </button>
  );

  const ratio = Math.min(1, used / Math.max(1, limit));
  const duplicate = (d: DashboardListItem) =>
    start(async () => {
      setError(null);
      const r = await duplicateDashboard(d.id);
      if (r && !r.ok) setError(r.error.message);
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboards"
        text={workspaceName ? `Os dashboards de ${workspaceName}: cada um usa as contas deste workspace, e o novo nasce aqui.` : "Todos os dashboards da organização, de todos os workspaces. Cada um tem um visual, um objetivo e as contas ligadas a ele."}
        actions={newButton}
      />

      {/* uso do plano, numa linha */}
      <div className="flex flex-col gap-2 rounded-card border border-line bg-card p-4 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] sm:shrink-0">
          <span className="font-medium text-fg-2">Dashboards do {planLabel}{workspaceName ? " na organização" : ""}</span>
          <span className={`font-semibold whitespace-nowrap tnum ${atLimit ? "text-error-fg" : "text-fg"}`}>
            {used} de {limit}
          </span>
          {/* os outros contam no limite: dá para ver (e apagar) todos, inclusive os de workspaces arquivados */}
          {workspaceName && used > items.length && (
            <Link href="/painel/dashboards?todos=1" className="font-semibold whitespace-nowrap text-accent underline-offset-4 hover:underline">
              Ver todos
            </Link>
          )}
        </p>
        <div className="h-1.5 w-full min-w-0 overflow-hidden rounded-full bg-surface-2 sm:flex-1" role="img" aria-label={`${used} de ${limit} dashboards`}>
          <div className={`h-full rounded-full transition-[width] duration-500 ease-brand ${atLimit ? "bg-error" : ratio >= 0.8 ? "bg-warning" : "bg-accent"}`} style={{ width: `${Math.max(used ? 3 : 0, ratio * 100)}%` }} />
        </div>
        {atLimit && canEdit && (
          <p className="text-[13px] text-fg-2">
            Limite do plano atingido.{" "}
            <Link href="/painel/plano#h-trocar" className="font-semibold text-accent underline-offset-4 hover:underline">
              Trocar de plano
            </Link>
          </p>
        )}
      </div>

      {error && !removing && (
        <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-[13px] text-error-fg">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Nenhum dashboard ainda"
          text={canEdit ? "Escolha um template, ligue as contas e mande o link para o cliente. Leva poucos minutos." : "Quando alguém da equipe criar um dashboard, ele aparece aqui."}
          action={newButton || undefined}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4">
          {items.map((d) => {
            const t = anyDashboardTemplate(d.templateId);
            const enabled = d.sources.filter((s) => s.isEnabled);
            return (
              <li key={d.id} className="group relative flex flex-col overflow-hidden rounded-card border border-line bg-card transition-[border-color,box-shadow] duration-200 hover:border-fg-2/40 hover:shadow-pop">
                <Link href={`/painel/dashboards/${d.id}`} className="flex flex-1 flex-col rounded-card outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset">
                  <div className="relative overflow-hidden border-b border-line">
                    {d.live ? <LiveThumb d={d} /> : <DashboardThumb d={d} />}
                    {!d.live && (
                      <span className="absolute bottom-2 left-2">
                        {enabled.length ? (
                          <Badge tone="ok" className="shadow-card ring-1 ring-line" title={enabled.map((s) => s.name).join(" · ")}>
                            <Radio size={11} aria-hidden /> Dados reais · {enabled.length} {enabled.length === 1 ? "conta" : "contas"}
                          </Badge>
                        ) : (
                          <Badge tone="neutral" className="bg-card ring-1 ring-line">
                            Amostra
                          </Badge>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-4 pr-12">
                    <p className="truncate text-[15px] font-semibold">{d.name}</p>
                    <p className="mt-0.5 truncate text-[13px] text-fg-2">{[d.client, t?.name].filter(Boolean).join(" · ")}</p>
                    {(t?.sources ?? []).length > 0 && (
                      <p className="mt-3 flex flex-wrap gap-1">
                        {(t?.sources ?? []).map((s) => (
                          <Badge key={s} tone="outline">
                            {PLATFORMS[s].short}
                          </Badge>
                        ))}
                      </p>
                    )}
                  </div>
                </Link>
                {canEdit && (
                  <Menu>
                    <MenuTrigger aria-label={`Mais ações de ${d.name}`} className={`${btn.icon} absolute right-2 bottom-3 outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-surface-2 data-[state=open]:text-fg`}>
                      <MoreHorizontal size={18} aria-hidden />
                    </MenuTrigger>
                    <MenuContent align="end">
                      <MenuItem icon={<Pencil size={15} />} onSelect={() => router.push(`/painel/dashboards/${d.id}/editar`)}>
                        Editar
                      </MenuItem>
                      <MenuItem icon={<Copy size={15} />} disabled={atLimit} onSelect={() => duplicate(d)}>
                        Duplicar
                      </MenuItem>
                      {t?.composed && (
                        <>
                          <MenuItem
                            icon={<Shuffle size={15} />}
                            data-change-template-open
                            onSelect={() => setSwitching({ id: d.id, name: d.name, visual: t.composed!.visual as ChangeTemplateTarget["visual"], objective: t.composed!.objective as ChangeTemplateTarget["objective"] })}
                          >
                            Trocar modelo
                          </MenuItem>
                          <MenuSeparator />
                        </>
                      )}
                      <MenuItem
                        icon={<Trash2 size={15} />}
                        className="text-error-fg"
                        onSelect={() => {
                          setError(null);
                          setRemoving(d);
                        }}
                      >
                        Apagar
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && <NewDashboardDialog open={creating} onClose={() => setCreating(false)} sources={sources} tier={tier} pagesTier={pagesTier} brand={brand} hasProject={hasProject} />}
      <ChangeTemplateModal dashboard={switching} tier={tier} onClose={() => setSwitching(null)} />
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
          <ModalActions>
            <button type="button" className={`${btn.quiet} max-sm:h-11`} onClick={onClose} disabled={pending}>
              Cancelar
            </button>
            <button type="button" className={`${btn.danger} max-sm:h-11`} onClick={onConfirm} disabled={pending}>
              {pending ? "Apagando…" : "Apagar"}
            </button>
          </ModalActions>
        </div>
      )}
    </Modal>
  );
}
