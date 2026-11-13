"use client";

import { ExternalLink, Inbox, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { EmptyState, Modal, PageHeader } from "@/components/ui/kit";
import { ScaledPreview } from "@/components/ui/ScaledPreview";
import { btn } from "@/components/ui/styles";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { UsageBar } from "@/features/accounts/AccountsPage";
import { LP_TEAM_PRICE } from "@/features/pricing/pricing";
import { landingTemplate } from "@/features/templates/landing-pages";
import type { LandingDraft } from "@/features/workspace/types";
import { brl } from "@/lib/format";
import { useDoc } from "@/lib/store/hooks";
import { MSG_LP_TEAM, waLink } from "@/lib/whatsapp";
import { deleteLandingPage } from "@/server/landing-pages/actions";
import { LandingRenderer } from "./LandingRenderer";
import { useWorkspaceSession } from "@/features/workspace/WorkspaceProvider";
import { LANDING_STATUS_LABEL, type LandingPageDTO } from "./model";

function TeamCard() {
  return (
    <li className="flex flex-col justify-between gap-4 rounded-card bg-accent p-5 text-on-accent">
      <div>
        <p className="title text-lg">Prefere que o time faça?</p>
        <p className="mt-1 text-[14px]">Landing page feita pelo time · {brl(LP_TEAM_PRICE, { decimals: false })}, já com o GTM configurado.</p>
      </div>
      <a
        href={waLink(MSG_LP_TEAM)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-10 w-fit items-center gap-2 rounded-control bg-on-accent px-4 text-[14px] font-semibold text-accent"
      >
        <WhatsAppIcon size={16} /> Falar com o time
      </a>
    </li>
  );
}

function StatusChip({ p }: { p: LandingPageDTO }) {
  const live = p.status === "published";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-chip px-2 py-0.5 text-[11.5px] font-semibold ${live ? "bg-accent-soft text-fg" : "border border-line text-fg-2"}`}>
      {live && <span className="size-1.5 rounded-full bg-accent" aria-hidden />}
      {LANDING_STATUS_LABEL[p.status]}
      {live && p.hasUnpublishedChanges && <span className="font-normal text-fg-2">· alterações não publicadas</span>}
    </span>
  );
}

type Props = { pages: LandingPageDTO[]; published: number; limit: number; canEdit: boolean };

export function LandingList({ pages, published, limit, canEdit }: Props) {
  // no produto de landing pages o time já faz as páginas do plano
  const lpProduct = useWorkspaceSession().workspace.product === "lp";
  const draft = useDoc<LandingDraft>("draft:landing");
  const [removing, setRemoving] = useState<LandingPageDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const confirmRemove = () =>
    start(async () => {
      if (!removing) return;
      const r = await deleteLandingPage(removing.id);
      if (!r.ok) setError(r.error.message);
      else setRemoving(null);
    });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Landing pages"
        title="Landing pages"
        text="Monte a partir de um template, cole o rastreamento e publique."
        actions={
          <>
            <Link href="/painel/landing-pages/leads" className={`${btn.ghost} h-9`}>
              <Inbox size={16} aria-hidden /> Leads
            </Link>
            {canEdit && (
              <>
                {draft?.templateId && (
                  <Link href="/painel/landing-pages/novo" className={`${btn.ghost} h-9`}>
                    Continuar rascunho
                  </Link>
                )}
                <Link href="/painel/landing-pages/novo?novo=1" className={btn.small}>
                  <Plus size={16} aria-hidden /> Nova landing page
                </Link>
              </>
            )}
          </>
        }
      />
      <div className="rounded-card border border-line bg-card p-4">
        <UsageBar used={published} limit={limit} label="Landing pages publicadas × limite do plano" />
      </div>
      {pages.length === 0 && (
        <EmptyState
          title="Nenhuma landing page ainda"
          text="Escolha um template, troque os textos e a cor, cole o GTM e veja a prévia no desktop e no celular."
          action={
            canEdit ? (
              <Link href="/painel/landing-pages/novo?novo=1" className={btn.small}>
                <Plus size={16} aria-hidden /> Nova landing page
              </Link>
            ) : undefined
          }
        />
      )}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map((p) => {
          const t = landingTemplate(p.templateId);
          if (!t) return null;
          return (
            <li key={p.id} className="group relative overflow-hidden rounded-card border border-line bg-card transition-colors hover:border-accent">
              <Link href={`/painel/landing-pages/${p.id}`} className="block">
                <div className="border-b border-line">
                  <ScaledPreview height={170} width={900}>
                    <LandingRenderer template={t} content={p.content} />
                  </ScaledPreview>
                </div>
                <div className="space-y-1.5 p-4">
                  <p className="truncate font-semibold">{p.content.brand || p.name || "Sem nome"}</p>
                  <p className="truncate text-[13px] text-fg-2">
                    {t.name} · <span className="tnum">/p/{p.slug}</span>
                  </p>
                  <StatusChip p={p} />
                </div>
              </Link>
              <div className="absolute top-2 right-2 flex gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                {p.status === "published" && (
                  <a
                    href={`/p/${p.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir ${p.content.brand} no ar`}
                    className="inline-flex size-8 items-center justify-center rounded-control border border-line bg-card"
                  >
                    <ExternalLink size={14} aria-hidden />
                  </a>
                )}
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Apagar ${p.content.brand}`}
                    onClick={() => {
                      setError(null);
                      setRemoving(p);
                    }}
                    className="inline-flex size-8 items-center justify-center rounded-control border border-line bg-card"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                )}
              </div>
            </li>
          );
        })}
        {!lpProduct && <TeamCard />}
      </ul>
      <Modal open={!!removing} onClose={() => !pending && setRemoving(null)} title="Apagar landing page?">
        {removing && (
          <div className="space-y-4">
            <p className="text-[14px] text-fg-2">
              <strong className="text-fg">{removing.content.brand || removing.name}</strong> sai do ar (se estiver publicada) e some junto com as versões. O endereço{" "}
              <span className="tnum">/p/{removing.slug}</span> fica reservado para esta organização por 180 dias.
            </p>
            <p role="note" className="rounded-control border border-error/40 bg-error/5 p-3 text-[13.5px] text-fg">
              <strong>Os leads desta página também são apagados</strong> e não dá para recuperar. Se precisar deles,{" "}
              <Link href={`/painel/landing-pages/leads?lp=${removing.id}&periodo=tudo`} className="font-medium text-accent underline underline-offset-2">
                exporte o CSV antes
              </Link>{" "}
              (só administradores).
            </p>
            {error && (
              <p role="alert" className="text-[13px] text-error-fg">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={`${btn.ghost} h-9`} disabled={pending} onClick={() => setRemoving(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-control bg-error px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                disabled={pending}
                onClick={confirmRemove}
              >
                {pending ? "Apagando…" : "Apagar"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
