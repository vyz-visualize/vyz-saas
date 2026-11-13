"use client";

// Aba Ajustes de um workspace: o nome (member), o que é dele e a zona de perigo (arquivar,
// admin): as contas saem do ar e o workspace libera espaço no plano; dashboards e dados ficam.

import { Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal, ModalActions, PageHeader, SectionHeader, TextField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { useToast } from "@/components/ui/Toast";
import { shortDate } from "@/features/integrations/sync-label";
import { archiveProject, renameProject } from "@/server/projects/actions";
import type { ProjectSummary } from "../types";

export function WorkspaceSettings({ summary, timeZone }: { summary: ProjectSummary; timeZone: string }) {
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState(summary.name);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [pending, start] = useTransition();

  const rename = () =>
    start(async () => {
      const r = await renameProject(summary.id, name);
      if (!r.ok) return setError(r.error.fields?.name ?? r.error.message);
      setError(null);
      toast.show("Nome atualizado.");
    });
  const archive = () =>
    start(async () => {
      const r = await archiveProject(summary.id);
      if (!r.ok) return toast.show(r.error.message, "blocked");
      router.push("/painel/workspaces");
    });

  return (
    <div className="max-w-3xl space-y-5 lg:space-y-6">
      <PageHeader title="Ajustes" text={`O nome de ${summary.name} e o que fazer quando o cliente sair.`} />
      <section aria-labelledby="h-nome-ws" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
        <SectionHeader id="h-nome-ws" title="Nome" text="O cliente ou a marca. Aparece no menu, nos convites e nos dashboards daqui." />
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            rename();
          }}
        >
          <div className="max-w-md">
            <TextField label="Nome do workspace" value={name} onChange={setName} error={error} disabled={!summary.canEdit} hint={summary.canEdit ? `Criado em ${shortDate(summary.createdAt, timeZone)}.` : "Só editores e admins mudam o nome."} />
          </div>
          {summary.canEdit && (
            <button type="submit" disabled={pending || !name.trim() || name.trim() === summary.name} className={`${btn.small} max-sm:h-11 max-sm:w-full`}>
              {pending ? "Salvando…" : "Salvar nome"}
            </button>
          )}
        </form>
      </section>

      {summary.canManage && (
        <section aria-labelledby="h-perigo" className="rounded-card border border-error/40 bg-card p-5 shadow-card sm:p-6">
          <SectionHeader id="h-perigo" title="Arquivar workspace" text="As contas daqui saem do ar e o workspace libera espaço no plano. Os dashboards e os dados já importados ficam guardados." />
          <button type="button" onClick={() => setArchiving(true)} className={`${btn.subtle} mt-5 hover:!border-error hover:!text-error-fg`}>
            <Archive size={15} aria-hidden /> Arquivar {summary.name}
          </button>
        </section>
      )}

      <Modal open={archiving} onClose={() => setArchiving(false)} title="Arquivar workspace">
        <div className="space-y-5">
          <p className="text-[14.5px] leading-relaxed">
            As contas de <strong>{summary.name}</strong> saem do ar e o workspace libera espaço no plano. Os dashboards e os dados já importados ficam.
          </p>
          <ModalActions>
            <button type="button" onClick={() => setArchiving(false)} className={`${btn.quiet} max-sm:h-11`}>
              Cancelar
            </button>
            <button type="button" onClick={archive} disabled={pending} className={`${btn.danger} max-sm:h-11`}>
              {pending ? "Arquivando…" : "Arquivar"}
            </button>
          </ModalActions>
        </div>
      </Modal>
      {toast.node}
    </div>
  );
}
