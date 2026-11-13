"use client";

// Página de um workspace (cliente ou marca): as contas e os dashboards dele e quem acessa.
// Dono e admin da organização acessam todos os workspaces; member e viewer só os que estão
// aqui. Pôr alguém da organização não gasta vaga; convidar alguém novo gasta (limite do plano).

import {
  Archive,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  Copy,
  MoreHorizontal,
  Pencil,
  Plug,
  Plus,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PlatformIcon } from "@/components/brand/PlatformIcon";
import {
  Badge,
  EmptyState,
  Modal,
  ModalActions,
  SectionHeader,
  StatTile,
  TextField,
} from "@/components/ui/kit";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/Menu";
import { Select } from "@/components/ui/Select";
import { btn } from "@/components/ui/styles";
import { useToast } from "@/components/ui/Toast";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { relativeTime, shortDate } from "@/features/integrations/sync-label";
import { anyDashboardTemplate } from "@/features/templates/live";
import { ROLE_LABEL } from "@/features/workspace/session";
import { ROLE_HINT } from "@/features/workspace/team";
import { useWorkspaceSession } from "@/features/workspace/WorkspaceProvider";
import {
  addProjectMember,
  archiveProject,
  removeProjectMember,
  renameProject,
} from "@/server/projects/actions";
import {
  inviteMember,
  revokeInvitation,
  type InviteResult,
} from "@/server/workspace/team";
import type { ProjectDetail, ProjectPerson } from "./types";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

function PersonRow({
  p,
  canManage,
  pending,
  onRemove,
}: {
  p: ProjectPerson;
  canManage: boolean;
  pending: boolean;
  onRemove: (p: ProjectPerson) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        aria-hidden
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12.5px] font-bold text-accent"
      >
        {initials(p.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">
          {p.name}
          {p.isYou && <span className="font-normal text-fg-2"> (você)</span>}
        </span>
        <span className="block truncate text-[12.5px] text-fg-2">
          {p.email}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Badge tone={p.role === "owner" ? "accent" : "outline"}>
          {ROLE_LABEL[p.role]}
        </Badge>
        {p.allAccess ? (
          <Badge
            tone="neutral"
            className="max-sm:hidden"
            title="Dono e admin acessam todos os workspaces"
          >
            Todos os workspaces
          </Badge>
        ) : (
          canManage && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onRemove(p)}
              aria-label={`Tirar ${p.name} deste workspace`}
              className={`${btn.icon} hover:!bg-error-soft hover:!text-error-fg`}
            >
              <UserMinus size={16} aria-hidden />
            </button>
          )
        )}
      </span>
    </li>
  );
}

/** Adicionar: alguém da organização (sem gastar vaga) ou um convite novo por e-mail (gasta vaga). */
function AddPeople({
  detail,
  onClose,
  notify,
}: {
  detail: ProjectDetail;
  onClose: () => void;
  notify: (m: string) => void;
}) {
  const outside = detail.people.filter((p) => !p.inProject);
  const full = detail.seats.used >= detail.seats.limit;
  const [mode, setMode] = useState<"team" | "invite">(
    outside.length ? "team" : "invite",
  );
  const [pick, setPick] = useState(outside[0]?.userId ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "viewer">("member");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<
    (InviteResult & { email: string }) | null
  >(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      const r = await addProjectMember(detail.id, pick);
      if (!r.ok) return setError(r.error.message);
      notify(
        `${outside.find((p) => p.userId === pick)?.name ?? "A pessoa"} agora acessa ${detail.name}.`,
      );
      onClose();
    });
  const invite = () =>
    start(async () => {
      const r = await inviteMember({
        email,
        role,
        sendEmail: true,
        projectIds: [detail.id],
      });
      if (!r.ok) return setError(r.error.fields?.email ?? r.error.message);
      setError(null);
      setResult({ ...r.data, email });
      notify("Convite criado.");
    });

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Como adicionar"
        className="inline-flex gap-1 rounded-[calc(var(--r-control)+4px)] bg-surface-2 p-1"
      >
        {(
          [
            ["team", "Da organização"],
            ["invite", "Convidar por e-mail"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={mode === v}
            onClick={() => {
              setMode(v);
              setError(null);
            }}
            className={`h-9 rounded-control px-3.5 text-[13.5px] font-medium transition-colors ${mode === v ? "bg-card text-fg shadow-card" : "text-fg-2 hover:text-fg"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {mode === "team" ? (
        outside.length ? (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <p className="text-[13.5px] text-fg-2">
              Quem já está na organização. Não gasta vaga do plano.
            </p>
            <Select
              ariaLabel="Pessoa"
              value={pick}
              onChange={setPick}
              options={outside.map((p) => ({
                value: p.userId,
                label: `${p.name} · ${ROLE_LABEL[p.role]}`,
              }))}
            />
            {error && (
              <p role="alert" className="text-[13px] text-error-fg">
                {error}
              </p>
            )}
            <ModalActions>
              <button
                type="button"
                onClick={onClose}
                className={`${btn.quiet} max-sm:h-11`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending || !pick}
                className={`${btn.small} max-sm:h-11`}
              >
                {pending ? "Adicionando…" : "Adicionar ao workspace"}
              </button>
            </ModalActions>
          </form>
        ) : (
          <p className="rounded-control bg-surface-2/70 px-3.5 py-3 text-[13.5px] text-fg-2">
            Todo mundo da organização já acessa este workspace. Convide alguém
            novo por e-mail.
          </p>
        )
      ) : result ? (
        <div className="space-y-3" role="status">
          <p className="text-[14px]">
            Convite para <strong>{result.email}</strong>{" "}
            {result.emailed ? "enviado por e-mail." : "criado."} Ao aceitar, a
            pessoa entra na organização e acessa só{" "}
            <strong>{detail.name}</strong>. O link vale até{" "}
            {shortDate(result.expiresAt)} e aparece só agora.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              readOnly
              value={result.link}
              aria-label="Link do convite"
              onFocus={(e) => e.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-control border border-line bg-field px-3 text-[13px]"
            />
            <button
              type="button"
              className={btn.small}
              onClick={async () => {
                await navigator.clipboard
                  .writeText(result.link)
                  .catch(() => {});
                setCopied(true);
              }}
            >
              {copied ? (
                <Check size={15} aria-hidden />
              ) : (
                <Copy size={15} aria-hidden />
              )}{" "}
              {copied ? "Copiado" : "Copiar link"}
            </button>
          </div>
          <ModalActions>
            <button
              type="button"
              onClick={onClose}
              className={`${btn.subtle} max-sm:h-11`}
            >
              Pronto
            </button>
          </ModalActions>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            invite();
          }}
        >
          <p
            className={`rounded-control px-3.5 py-2.5 text-[13px] ${full ? "bg-error-soft text-error-fg" : "bg-surface-2/70 text-fg-2"}`}
          >
            {full
              ? `As ${detail.seats.limit} vagas de usuário do plano estão em uso (convites pendentes contam). Suba de plano em Plano para convidar mais gente.`
              : `Gasta 1 vaga do plano: ${detail.seats.used} de ${detail.seats.limit} em uso.`}
          </p>
          <TextField
            label="E-mail"
            type="email"
            inputMode="email"
            value={email}
            onChange={setEmail}
            placeholder="nome@empresa.com.br"
            error={error}
            disabled={full}
          />
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">Papel</p>
            <Select
              ariaLabel="Papel"
              value={role}
              onChange={(v) => setRole(v as "member" | "viewer")}
              options={(["member", "viewer"] as const).map((r) => ({
                value: r,
                label: ROLE_LABEL[r],
              }))}
              disabled={full}
            />
            <p className="text-[12px] text-fg-2">{ROLE_HINT[role]}</p>
          </div>
          <ModalActions>
            <button
              type="button"
              onClick={onClose}
              className={`${btn.quiet} max-sm:h-11`}
            >
              Cancelar
            </button>
            {full ? (
              <Link
                href="/painel/plano#h-trocar"
                className={`${btn.small} max-sm:h-11`}
              >
                Ver planos
              </Link>
            ) : (
              <button
                type="submit"
                disabled={pending || !email.trim()}
                className={`${btn.small} max-sm:h-11`}
              >
                {pending ? "Convidando…" : "Convidar"}
              </button>
            )}
          </ModalActions>
        </form>
      )}
    </div>
  );
}

export function ProjectDetailPage({ detail }: { detail: ProjectDetail }) {
  const toast = useToast();
  const router = useRouter();
  const { workspace } = useWorkspaceSession();
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [removing, setRemoving] = useState<ProjectPerson | null>(null);
  const [name, setName] = useState(detail.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const team = detail.people.filter((p) => p.inProject);
  const enabled = detail.accounts.filter((a) => a.isEnabled);

  const rename = () =>
    start(async () => {
      const r = await renameProject(detail.id, name);
      if (!r.ok) return setError(r.error.fields?.name ?? r.error.message);
      toast.show("Nome atualizado.");
      setRenaming(false);
    });
  const archive = () =>
    start(async () => {
      const r = await archiveProject(detail.id);
      if (!r.ok) return toast.show(r.error.message, "blocked");
      router.push("/painel/workspaces");
    });
  const remove = () =>
    start(async () => {
      if (!removing) return;
      const r = await removeProjectMember(detail.id, removing.userId);
      if (!r.ok) return toast.show(r.error.message, "blocked");
      toast.show(`${removing.name} não acessa mais ${detail.name}.`);
      setRemoving(null);
    });
  const revoke = (id: string) =>
    start(async () => {
      const r = await revokeInvitation(id);
      toast.show(
        r.ok ? "Convite cancelado." : r.error.message,
        r.ok ? "ok" : "blocked",
      );
    });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/painel/workspaces" className={`${btn.quiet} -ml-3`}>
          <ArrowLeft size={15} aria-hidden /> Workspaces
        </Link>
        <header className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span
              aria-hidden
              className="inline-flex size-14 shrink-0 items-center justify-center rounded-[16px] bg-accent text-[18px] font-bold text-on-accent"
            >
              {initials(detail.name)}
            </span>
            <div className="min-w-0">
              <h1 className="text-[26px] leading-[1.12] font-bold tracking-[-0.028em] break-words sm:text-[30px]">
                {detail.name}
              </h1>
              <p className="mt-1 text-[13.5px] text-fg-2">
                Workspace de {workspace.name} · criado em{" "}
                {shortDate(detail.createdAt, workspace.timezone)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {detail.canManage && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className={`${btn.small} max-sm:flex-1`}
              >
                <UserPlus size={16} aria-hidden /> Adicionar pessoa
              </button>
            )}
            {(detail.canEdit || detail.canManage) && (
              <Menu>
                <MenuTrigger
                  aria-label="Mais ações do workspace"
                  className={`${btn.icon} border border-line bg-card outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-surface-2`}
                >
                  <MoreHorizontal size={18} aria-hidden />
                </MenuTrigger>
                <MenuContent align="end">
                  {detail.canEdit && (
                    <MenuItem
                      icon={<Pencil size={15} />}
                      onSelect={() => {
                        setError(null);
                        setName(detail.name);
                        setRenaming(true);
                      }}
                    >
                      Renomear
                    </MenuItem>
                  )}
                  {detail.canManage && (
                    <>
                      <MenuSeparator />
                      <MenuItem
                        icon={<Archive size={15} />}
                        onSelect={() => setArchiving(true)}
                      >
                        Arquivar
                      </MenuItem>
                    </>
                  )}
                </MenuContent>
              </Menu>
            )}
          </div>
        </header>
      </div>

      <section
        aria-label="Números do workspace"
        className="grid grid-cols-3 gap-3 sm:gap-4"
      >
        <StatTile
          label="Contas ativas"
          value={enabled.length}
          icon={<Plug size={16} aria-hidden />}
          hint={`Até ${plural(detail.maxAccountsPerPlatform, "conta", "contas")} por plataforma`}
        />
        <StatTile
          label="Dashboards"
          value={detail.dashboards.length}
          icon={<BarChart3 size={16} aria-hidden />}
          hint={
            detail.dashboards.length
              ? "Ligados às contas daqui"
              : "Nenhum ainda"
          }
        />
        <StatTile
          label="Pessoas"
          value={team.length}
          icon={<Users size={16} aria-hidden />}
          hint="Com acesso a este workspace"
        />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2 lg:gap-6">
        <section
          aria-labelledby="h-contas"
          className="rounded-card border border-line bg-card p-5 sm:p-6"
        >
          <SectionHeader
            id="h-contas"
            title="Contas"
            text="As contas de anúncio e de analytics deste cliente."
            action={
              <Link
                href="/painel/contas"
                className="text-[13.5px] font-semibold text-accent underline-offset-4 hover:underline"
              >
                Gerenciar
              </Link>
            }
          />
          {detail.accounts.length ? (
            <ul className="mt-2 divide-y divide-line">
              {detail.accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-3">
                  <PlatformIcon
                    id={a.platformId}
                    size={34}
                    className={a.isEnabled ? "" : "opacity-50 grayscale"}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">
                      {a.name}
                    </span>
                    <span className="block truncate text-[12.5px] text-fg-2">
                      {PLATFORMS[a.platformId as PlatformId]?.name ??
                        a.platformId}
                      {a.lastSyncedAt
                        ? ` · sincronizada ${relativeTime(a.lastSyncedAt, new Date().toISOString(), workspace.timezone)}`
                        : ""}
                    </span>
                  </span>
                  <Badge tone={a.isEnabled ? "ok" : "neutral"}>
                    {a.isEnabled ? "Ativa" : "Desligada"}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-[calc(var(--r-card)-4px)] border border-dashed border-line p-5 text-[14px] text-fg-2">
              Nenhuma conta neste workspace. Em Contas, ao ligar uma conta,
              escolha {detail.name}.
              <Link
                href="/painel/contas"
                className="mt-3 flex items-center gap-1.5 font-semibold text-accent"
              >
                Abrir Contas <ArrowUpRight size={15} aria-hidden />
              </Link>
            </div>
          )}
        </section>

        <section
          aria-labelledby="h-dashboards"
          className="rounded-card border border-line bg-card p-5 sm:p-6"
        >
          <SectionHeader
            id="h-dashboards"
            title="Dashboards"
            text="Os dashboards feitos com as contas daqui."
            action={
              detail.canEdit && (
                <Link
                  href="/painel/dashboards/novo?novo=1"
                  className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-accent underline-offset-4 hover:underline"
                >
                  <Plus size={15} aria-hidden /> Novo
                </Link>
              )
            }
          />
          {detail.dashboards.length ? (
            <ul className="mt-2 divide-y divide-line">
              {detail.dashboards.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/painel/dashboards/${d.id}`}
                    className="group -mx-2 flex items-center gap-3 rounded-control px-2 py-3 transition-colors hover:bg-surface-2"
                  >
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 text-fg-2 group-hover:bg-accent-soft group-hover:text-accent">
                      <BarChart3 size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">
                        {d.name}
                      </span>
                      <span className="block truncate text-[12.5px] text-fg-2">
                        {anyDashboardTemplate(d.templateId)?.name ??
                          "Dashboard"}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px] text-fg-2 tnum">
                      {relativeTime(
                        d.updatedAt,
                        new Date().toISOString(),
                        workspace.timezone,
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-[calc(var(--r-card)-4px)] border border-dashed border-line p-5 text-[14px] text-fg-2">
              Nenhum dashboard ainda. Ligue as contas e crie o primeiro.
            </p>
          )}
        </section>
      </div>

      <section
        aria-labelledby="h-equipe"
        className="rounded-card border border-line bg-card p-5 sm:p-6"
      >
        <SectionHeader
          id="h-equipe"
          title="Quem acessa"
          text={`Dono e admin da organização acessam todos os workspaces. Editores e leitores só veem os workspaces onde estão. Vagas do plano: ${detail.seats.used} de ${detail.seats.limit}.`}
          action={
            detail.canManage && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className={btn.subtle}
              >
                <UserPlus size={15} aria-hidden /> Adicionar
              </button>
            )
          }
        />
        <ul className="mt-2 divide-y divide-line">
          {team.map((p) => (
            <PersonRow
              key={p.userId}
              p={p}
              canManage={detail.canManage}
              pending={pending}
              onRemove={setRemoving}
            />
          ))}
        </ul>
        {detail.invitations.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-line pt-4">
            <p className="text-[13px] font-semibold">Convites pendentes</p>
            <ul className="divide-y divide-line">
              {detail.invitations.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]"
                >
                  <span className="min-w-0 truncate text-fg-2">
                    <span className="text-fg">{i.email}</span> ·{" "}
                    {ROLE_LABEL[i.role]} · vence em{" "}
                    {shortDate(i.expiresAt, workspace.timezone)}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => revoke(i.id)}
                    aria-label={`Cancelar convite de ${i.email}`}
                    className={`${btn.quiet} h-8 shrink-0`}
                  >
                    <X size={14} aria-hidden /> Cancelar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {!detail.canManage && (
          <p className="mt-3 text-[13px] text-fg-2">
            Só o dono e os admins da organização põem e tiram gente.
          </p>
        )}
      </section>

      {team.length === 0 &&
        detail.accounts.length === 0 &&
        detail.dashboards.length === 0 && (
          <EmptyState
            title="Workspace novo"
            text="Ligue as contas deste cliente em Contas e crie o primeiro dashboard."
          />
        )}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={`Adicionar a ${detail.name}`}
      >
        {adding && (
          <AddPeople
            detail={detail}
            onClose={() => setAdding(false)}
            notify={toast.show}
          />
        )}
      </Modal>

      <Modal
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Renomear workspace"
      >
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            rename();
          }}
        >
          <TextField
            label="Nome do cliente ou marca"
            value={name}
            onChange={setName}
            error={error}
          />
          <ModalActions>
            <button
              type="button"
              onClick={() => setRenaming(false)}
              className={`${btn.quiet} max-sm:h-11`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className={`${btn.small} max-sm:h-11`}
            >
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </ModalActions>
        </form>
      </Modal>

      <Modal
        open={archiving}
        onClose={() => setArchiving(false)}
        title="Arquivar workspace"
      >
        <div className="space-y-5">
          <p className="text-[14.5px] leading-relaxed">
            As contas de <strong>{detail.name}</strong> saem do ar e o workspace
            libera espaço no plano. Os dashboards e os dados já importados
            ficam.
          </p>
          <ModalActions>
            <button
              type="button"
              onClick={() => setArchiving(false)}
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

      <Modal
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Tirar do workspace"
      >
        {removing && (
          <div className="space-y-5">
            <p className="text-[14.5px] leading-relaxed">
              <strong>{removing.name}</strong> deixa de ver as contas e os
              dashboards de <strong>{detail.name}</strong>. Continua na
              organização e nos outros workspaces dela.
            </p>
            <ModalActions>
              <button
                type="button"
                onClick={() => setRemoving(null)}
                className={`${btn.quiet} max-sm:h-11`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className={`${btn.danger} max-sm:h-11`}
              >
                {pending ? "Tirando…" : "Tirar do workspace"}
              </button>
            </ModalActions>
          </div>
        )}
      </Modal>
      {toast.node}
    </div>
  );
}
