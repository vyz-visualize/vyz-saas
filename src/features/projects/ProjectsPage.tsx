"use client";

// Página Projetos: cada cliente ou marca é um projeto, com as contas e os
// dashboards dele. O plano limita os projetos ativos; arquivar libera espaço.

import {
  Archive,
  BarChart3,
  MoreHorizontal,
  Pencil,
  Plug,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  EmptyState,
  Modal,
  ModalActions,
  PageHeader,
  TextField,
} from "@/components/ui/kit";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/Menu";
import { btn } from "@/components/ui/styles";
import { useToast } from "@/components/ui/Toast";
import { shortDate } from "@/features/integrations/sync-label";
import { projectHref, rememberProject } from "@/features/workspace/nav";
import { useWorkspaceSession } from "@/features/workspace/WorkspaceProvider";
import {
  archiveProject,
  createProject,
  renameProject,
} from "@/server/projects/actions";
import type { ProjectDTO, ProjectsState } from "./types";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "P";

type Editing = { mode: "new" } | { mode: "rename"; project: ProjectDTO } | null;

/** Um número do projeto (contas, dashboards) que leva à tela que cuida dele. */
function Metric({
  href,
  icon,
  value,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="group/metric flex items-center gap-2.5 rounded-control bg-surface-2/70 px-3 py-2.5 outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="text-fg-2 transition-colors group-hover/metric:text-accent">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[17px] leading-none font-bold tnum">
          {value}
        </span>
        <span className="mt-1 block truncate text-[11.5px] text-fg-2">
          {label}
        </span>
      </span>
    </Link>
  );
}

export function ProjectsPage({ state, openNew = false }: { state: ProjectsState; /** Abre o "Novo workspace" (?novo=1, do seletor da sidebar). */ openNew?: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const { workspace } = useWorkspaceSession();
  const [editing, setEditing] = useState<Editing>(openNew && state.canEdit && state.projects.length < state.quantity ? { mode: "new" } : null);
  const [q, setQ] = useState("");
  const [archiving, setArchiving] = useState<ProjectDTO | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const used = state.projects.length;
  const full = used >= state.quantity;
  const ratio = Math.min(1, used / Math.max(1, state.quantity));

  function open(next: Editing) {
    setError(null);
    setName(next?.mode === "rename" ? next.project.name : "");
    setEditing(next);
  }

  function save() {
    if (!editing) return;
    start(async () => {
      const res =
        editing.mode === "new"
          ? await createProject(name)
          : await renameProject(editing.project.id, name);
      if (!res.ok) {
        setError(res.error.fields?.name ?? res.error.message);
        return;
      }
      // workspace novo: entra nele (é lá que se ligam as contas e se criam os dashboards)
      if (editing.mode === "new" && res.data && "id" in res.data) {
        rememberProject(res.data.id);
        // fecha antes de sair: a página fica guardada (Activity) e, ao voltar, o modal não reaparece
        setEditing(null);
        router.push(projectHref(res.data.id, "contas"));
        return;
      }
      toast.show("Nome atualizado.");
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
    <div className="space-y-6">
      <PageHeader
        title="Workspaces"
        text="Cada cliente ou marca é um workspace, com as contas, os dashboards e a equipe dele. Abra um workspace para ver tudo o que tem lá."
        actions={
          state.canEdit && (
            <button
              type="button"
              onClick={() => open({ mode: "new" })}
              disabled={full}
              title={
                full ? "Todos os workspaces do plano estão em uso" : undefined
              }
              className={btn.small}
            >
              <Plus size={16} aria-hidden />
              Novo workspace
            </button>
          )
        }
      />

      {/* uso do plano: o que já foi e o que cabe em cada projeto */}
      <section
        aria-label="Workspaces do plano"
        className="flex flex-col gap-3 rounded-card border border-line bg-card p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="font-medium text-fg-2">Workspaces do plano</span>
            <span
              className={`font-semibold tnum ${full ? "text-error-fg" : "text-fg"}`}
            >
              {used} de {state.quantity}
            </span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-brand ${full ? "bg-error" : ratio >= 0.8 ? "bg-warning" : "bg-accent"}`}
              style={{ width: `${Math.max(used ? 3 : 0, ratio * 100)}%` }}
            />
          </div>
        </div>
        <p className="text-[13px] leading-snug text-fg-2 sm:max-w-xs sm:text-right">
          {full ? (
            <>
              Todos os workspaces do plano estão em uso.{" "}
              <Link
                href="/painel/plano#h-trocar"
                className="font-semibold text-accent underline-offset-4 hover:underline"
              >
                Contratar mais workspaces
              </Link>
            </>
          ) : (
            `Até ${plural(state.maxAccountsPerPlatform, "conta", "contas")} de cada plataforma em cada workspace.`
          )}
        </p>
      </section>

      {state.projects.length === 0 ? (
        <EmptyState
          title="Nenhum workspace ainda"
          text="Crie um workspace para cada cliente ou marca. Ao ligar uma conta em Contas, ela entra no workspace escolhido."
          action={
            state.canEdit && (
              <button
                type="button"
                onClick={() => open({ mode: "new" })}
                className={btn.small}
              >
                <Plus size={16} aria-hidden />
                Criar o primeiro workspace
              </button>
            )
          }
        />
      ) : (
        <>
        {state.projects.length > 8 && (
          <label className="relative block sm:max-w-sm">
            <span className="sr-only">Buscar workspace</span>
            <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-2" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Buscar entre ${state.projects.length} workspaces`}
              className="h-10 w-full rounded-control border border-line bg-field pr-3 pl-9 text-[14px] outline-none transition-colors hover:border-fg-2/50 focus:border-accent focus:ring-1 focus:ring-accent max-sm:h-11 max-sm:text-[16px]"
            />
          </label>
        )}
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4">
          {state.projects
            .filter((p) => !q.trim() || p.name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().includes(q.trim().normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()))
            .map((p) => (
            <li
              key={p.id}
              className="relative flex flex-col rounded-card border border-line bg-card p-4 transition-colors hover:border-fg-2/40 sm:p-5"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-[13px] font-bold text-accent"
                >
                  {initials(p.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15.5px] leading-snug font-semibold break-words text-fg">
                    {/* o cartão inteiro abre o workspace (o link estica por cima dele; menu e números ficam acima) */}
                    <Link
                      href={`/painel/workspaces/${p.id}`}
                      className="outline-none after:absolute after:inset-0 after:rounded-card after:content-[''] hover:text-accent focus-visible:after:ring-2 focus-visible:after:ring-accent"
                    >
                      {p.name}
                    </Link>
                  </h2>
                  <p className="mt-0.5 text-[12.5px] text-fg-2">
                    Criado em {shortDate(p.createdAt, workspace.timezone)}
                  </p>
                </div>
                {(state.canEdit || state.canArchive) && (
                  <div className="relative z-10">
                    <Menu>
                      <MenuTrigger
                        aria-label={`Mais ações de ${p.name}`}
                        className={`${btn.icon} -mt-1 -mr-1.5 outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-surface-2 data-[state=open]:text-fg`}
                      >
                        <MoreHorizontal size={18} aria-hidden />
                      </MenuTrigger>
                      <MenuContent align="end">
                        {state.canEdit && (
                          <MenuItem
                            icon={<Pencil size={15} />}
                            onSelect={() =>
                              open({ mode: "rename", project: p })
                            }
                          >
                            Renomear
                          </MenuItem>
                        )}
                        {state.canArchive && (
                          <MenuItem
                            icon={<Archive size={15} />}
                            onSelect={() => setArchiving(p)}
                          >
                            Arquivar
                          </MenuItem>
                        )}
                      </MenuContent>
                    </Menu>
                  </div>
                )}
              </div>
              <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
                <Metric
                  href={projectHref(p.id, "contas")}
                  icon={<Plug size={16} aria-hidden />}
                  value={p.enabledAccounts}
                  label={
                    p.enabledAccounts === 1 ? "conta ativa" : "contas ativas"
                  }
                />
                <Metric
                  href={projectHref(p.id, "dashboards")}
                  icon={<BarChart3 size={16} aria-hidden />}
                  value={p.dashboards}
                  label={p.dashboards === 1 ? "dashboard" : "dashboards"}
                />
              </div>
            </li>
          ))}
        </ul>
        </>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={
          editing?.mode === "rename" ? "Renomear workspace" : "Novo workspace"
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="space-y-5"
        >
          <TextField
            label="Nome do cliente ou marca"
            value={name}
            onChange={setName}
            placeholder="Ex.: Loja Aurora"
            error={error}
          />
          <ModalActions>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className={`${btn.quiet} max-sm:h-11`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className={`${btn.small} max-sm:h-11`}
            >
              {pending
                ? "Salvando…"
                : editing?.mode === "rename"
                  ? "Salvar"
                  : "Criar workspace"}
            </button>
          </ModalActions>
        </form>
      </Modal>

      <Modal
        open={!!archiving}
        onClose={() => setArchiving(null)}
        title="Arquivar workspace"
      >
        <div className="space-y-5">
          <p className="text-[14.5px] leading-relaxed text-fg">
            As contas de <strong>{archiving?.name}</strong> saem do ar e o
            workspace libera espaço no plano. Os dashboards e os dados já
            importados ficam.
          </p>
          <ModalActions>
            <button
              type="button"
              onClick={() => setArchiving(null)}
              className={`${btn.quiet} max-sm:h-11`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={archive}
              disabled={pending}
              className={`${btn.small} max-sm:h-11`}
            >
              {pending ? "Arquivando…" : "Arquivar"}
            </button>
          </ModalActions>
        </div>
      </Modal>
      {toast.node}
    </div>
  );
}
