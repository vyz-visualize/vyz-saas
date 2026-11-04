"use client";

// Página Projetos: cada cliente ou marca é um projeto, com as contas e os
// dashboards dele. O plano limita os projetos ativos; arquivar libera espaço.

import { Archive, FolderKanban, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { EmptyState, Modal, PageHeader, TextField } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { useToast } from "@/components/ui/Toast";
import { UsageBar } from "@/features/accounts/AccountsPage";
import { archiveProject, createProject, renameProject } from "@/server/projects/actions";
import type { ProjectDTO, ProjectsState } from "./types";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Editing = { mode: "new" } | { mode: "rename"; project: ProjectDTO } | null;

export function ProjectsPage({ state }: { state: ProjectsState }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const [archiving, setArchiving] = useState<ProjectDTO | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const full = state.projects.length >= state.quantity;

  function open(next: Editing) {
    setError(null);
    setName(next?.mode === "rename" ? next.project.name : "");
    setEditing(next);
  }

  function save() {
    if (!editing) return;
    start(async () => {
      const res = editing.mode === "new" ? await createProject(name) : await renameProject(editing.project.id, name);
      if (!res.ok) {
        setError(res.error.fields?.name ?? res.error.message);
        return;
      }
      toast.show(editing.mode === "new" ? "Projeto criado." : "Nome atualizado.");
      setEditing(null);
    });
  }

  function archive() {
    if (!archiving) return;
    start(async () => {
      const res = await archiveProject(archiving.id);
      if (!res.ok) {
        toast.show(res.error.message);
        return;
      }
      toast.show(`"${archiving.name}" arquivado.`);
      setArchiving(null);
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Projetos"
        text="Cada cliente ou marca é um projeto, com as contas e os dashboards dele. O plano conta os projetos ativos."
        actions={
          state.canEdit && (
            <button type="button" onClick={() => open({ mode: "new" })} disabled={full} className={btn.small}>
              <Plus size={16} aria-hidden />
              Novo projeto
            </button>
          )
        }
      />

      <section className="flex flex-col gap-4 rounded-card border border-line bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <UsageBar used={state.projects.length} limit={state.quantity} label="Projetos do plano" />
        <p className="text-[13px] text-fg-2 sm:max-w-sm sm:text-right">
          {full ? (
            <>
              Todos os projetos do plano estão em uso.{" "}
              <Link href="/painel/plano#h-trocar" className="font-semibold text-accent underline-offset-4 hover:underline">
                Contratar mais projetos
              </Link>
            </>
          ) : (
            `Até ${plural(state.maxAccountsPerPlatform, "conta", "contas")} de cada plataforma em cada projeto.`
          )}
        </p>
      </section>

      {state.projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto ainda"
          text="Crie um projeto para cada cliente ou marca. Ao ligar uma conta em Contas, ela entra no projeto escolhido."
          action={
            state.canEdit && (
              <button type="button" onClick={() => open({ mode: "new" })} className={btn.small}>
                <Plus size={16} aria-hidden />
                Criar o primeiro projeto
              </button>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {state.projects.map((p) => (
            <li key={p.id} className="flex flex-col gap-4 rounded-card border border-line bg-card p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                  <FolderKanban size={19} aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className="title text-[17px] break-words text-fg">{p.name}</h2>
                  <p className="mt-0.5 text-[13px] text-fg-2">
                    {plural(p.enabledAccounts, "conta ativa", "contas ativas")} · {plural(p.dashboards, "dashboard", "dashboards")}
                  </p>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Link href="/painel/contas" className={`${btn.ghost} h-9`}>
                  Contas
                </Link>
                {state.canEdit && (
                  <button type="button" onClick={() => open({ mode: "rename", project: p })} className={`${btn.ghost} h-9`} aria-label={`Renomear ${p.name}`}>
                    <Pencil size={14} aria-hidden />
                    Renomear
                  </button>
                )}
                {state.canArchive && (
                  <button type="button" onClick={() => setArchiving(p)} className={`${btn.ghost} h-9`} aria-label={`Arquivar ${p.name}`}>
                    <Archive size={14} aria-hidden />
                    Arquivar
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.mode === "rename" ? "Renomear projeto" : "Novo projeto"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="space-y-4"
        >
          <TextField label="Nome do cliente ou marca" value={name} onChange={setName} placeholder="Ex.: Loja Aurora" error={error} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className={`${btn.ghost} h-10`}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btn.small}>
              {pending ? "Salvando…" : editing?.mode === "rename" ? "Salvar" : "Criar projeto"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!archiving} onClose={() => setArchiving(null)} title="Arquivar projeto">
        <div className="space-y-4">
          <p className="text-[14.5px] text-fg">
            As contas de <strong>{archiving?.name}</strong> saem do ar e o projeto libera espaço no plano. Os dashboards e os dados já importados ficam.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setArchiving(null)} className={`${btn.ghost} h-10`}>
              Cancelar
            </button>
            <button type="button" onClick={archive} disabled={pending} className={btn.small}>
              {pending ? "Arquivando…" : "Arquivar"}
            </button>
          </div>
        </div>
      </Modal>
      {toast.node}
    </div>
  );
}
