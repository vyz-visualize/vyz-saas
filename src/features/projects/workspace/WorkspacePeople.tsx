"use client";

// Aba Pessoas de um workspace: quem acessa (com o papel, que dá para trocar), quem está na
// organização e ainda não entrou aqui (pôr em um clique, sem gastar vaga), o convite por e-mail
// já para este workspace (gasta vaga do plano), os convites pendentes e o que cada papel faz.
// Dono e admin da organização acessam todos os workspaces; editor e leitor só os seus.

import { Check, Copy, Crown, Eye, PenLine, ShieldCheck, UserMinus, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge, Modal, ModalActions, PageHeader, SectionHeader, TextField } from "@/components/ui/kit";
import { Select } from "@/components/ui/Select";
import { btn } from "@/components/ui/styles";
import { useToast } from "@/components/ui/Toast";
import { shortDate } from "@/features/integrations/sync-label";
import { ROLE_LABEL, type MemberRole } from "@/features/workspace/session";
import { initials } from "@/features/workspace/Sidebar";
import { assignableRoles, ROLE_HINT } from "@/features/workspace/team";
import { addProjectMember, removeProjectMember } from "@/server/projects/actions";
import { changeMemberRole, inviteMember, revokeInvitation, type InviteResult } from "@/server/workspace/team";
import type { ProjectPeopleData, ProjectPerson } from "../types";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const ROLES: { role: MemberRole; icon: typeof Eye; access: string }[] = [
  { role: "viewer", icon: Eye, access: "Só os workspaces onde está" },
  { role: "member", icon: PenLine, access: "Só os workspaces onde está" },
  { role: "admin", icon: ShieldCheck, access: "Todos os workspaces" },
  { role: "owner", icon: Crown, access: "Todos os workspaces" },
];

function Person({ p, actor, canManage, pending, onRole, onRemove }: { p: ProjectPerson; actor: MemberRole; canManage: boolean; pending: boolean; onRole: (p: ProjectPerson, role: MemberRole) => void; onRemove: (p: ProjectPerson) => void }) {
  const roles = p.isYou ? [] : assignableRoles(actor, p.role);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-5">
      <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent">
        {initials(p.name)}
      </span>
      {/* no celular, o nome ocupa a linha e o papel desce para a de baixo */}
      <span className="min-w-0 flex-1 max-sm:basis-[calc(100%-52px)]">
        <span className="block truncate text-[14px] font-semibold">
          {p.name}
          {p.isYou && <span className="font-normal text-fg-2"> (você)</span>}
        </span>
        <span className="block truncate text-[12.5px] text-fg-2">{p.email}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2 max-sm:ml-[52px]">
        {p.allAccess && (
          <Badge tone="neutral" className="max-md:hidden" title="Dono e admin acessam todos os workspaces">
            Todos os workspaces
          </Badge>
        )}
        {roles.length ? (
          <Select ariaLabel={`Papel de ${p.name}`} size="sm" className="w-32" value={p.role} disabled={pending} onChange={(v) => onRole(p, v as MemberRole)} options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
        ) : (
          <Badge tone={p.role === "owner" ? "accent" : "outline"}>{ROLE_LABEL[p.role]}</Badge>
        )}
        {canManage && !p.allAccess && (
          <button type="button" disabled={pending} onClick={() => onRemove(p)} aria-label={`Tirar ${p.name} deste workspace`} title="Tirar deste workspace" className={`${btn.icon} hover:!bg-error-soft hover:!text-error-fg`}>
            <UserMinus size={16} aria-hidden />
          </button>
        )}
      </span>
    </li>
  );
}

/** Convite por e-mail já para este workspace. */
function Invite({ projectId, projectName, seats, onClose, notify }: { projectId: string; projectName: string; seats: ProjectPeopleData["seats"]; onClose: () => void; notify: (m: string) => void }) {
  const full = seats.used >= seats.limit;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "viewer">("member");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(InviteResult & { email: string }) | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const invite = () =>
    start(async () => {
      const r = await inviteMember({ email, role, sendEmail: true, projectIds: [projectId] });
      if (!r.ok) return setError(r.error.fields?.email ?? r.error.message);
      setError(null);
      setResult({ ...r.data, email });
      notify("Convite criado.");
    });

  if (result)
    return (
      <div className="space-y-4" role="status">
        <p className="text-[14px] leading-relaxed">
          Convite para <strong>{result.email}</strong> {result.emailed ? "enviado por e-mail." : "criado."} Ao aceitar, a pessoa entra na organização e acessa só <strong>{projectName}</strong>. O link vale até {shortDate(result.expiresAt)} e aparece só agora.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly value={result.link} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-control border border-line bg-field px-3 text-[13px]" />
          <button
            type="button"
            className={btn.small}
            onClick={async () => {
              await navigator.clipboard.writeText(result.link).catch(() => {});
              setCopied(true);
            }}
          >
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "Copiado" : "Copiar link"}
          </button>
        </div>
        <ModalActions>
          <button type="button" onClick={onClose} className={`${btn.subtle} max-sm:h-11`}>
            Pronto
          </button>
        </ModalActions>
      </div>
    );

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        invite();
      }}
    >
      <p className={`rounded-control px-3.5 py-2.5 text-[13px] ${full ? "bg-error-soft text-error-fg" : "bg-surface-2/70 text-fg-2"}`}>
        {full ? `As ${seats.limit} vagas de usuário do plano estão em uso (convites pendentes contam). Suba de plano para convidar mais gente.` : `Gasta 1 vaga do plano: ${seats.used} de ${seats.limit} em uso.`}
      </p>
      <TextField label="E-mail" type="email" inputMode="email" value={email} onChange={setEmail} placeholder="nome@empresa.com.br" error={error} disabled={full} />
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium">Papel</p>
        <Select ariaLabel="Papel" value={role} onChange={(v) => setRole(v as "member" | "viewer")} options={(["member", "viewer"] as const).map((r) => ({ value: r, label: ROLE_LABEL[r] }))} disabled={full} />
        <p className="text-[12px] text-fg-2">{ROLE_HINT[role]} Acessa só {projectName}. Admins acessam todos os workspaces: convide em Configurações.</p>
      </div>
      <ModalActions>
        <button type="button" onClick={onClose} className={`${btn.quiet} max-sm:h-11`}>
          Cancelar
        </button>
        {full ? (
          <Link href="/painel/plano#h-trocar" className={`${btn.small} max-sm:h-11`}>
            Ver planos
          </Link>
        ) : (
          <button type="submit" disabled={pending || !email.trim()} className={`${btn.small} max-sm:h-11`}>
            {pending ? "Convidando…" : "Convidar"}
          </button>
        )}
      </ModalActions>
    </form>
  );
}

export function WorkspacePeople({ data, projectId, projectName }: { data: ProjectPeopleData; projectId: string; projectName: string }) {
  const toast = useToast();
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<ProjectPerson | null>(null);
  const [pending, start] = useTransition();
  const team = data.people.filter((p) => p.inProject);
  const outside = data.people.filter((p) => !p.inProject);
  const ratio = Math.min(1, data.seats.used / Math.max(1, data.seats.limit));
  const free = Math.max(0, data.seats.limit - data.seats.used);

  const act = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, done: string) =>
    start(async () => {
      const r = await fn();
      toast.show(r.ok ? done : (r.error?.message ?? "Não deu certo. Tente de novo."), r.ok ? "ok" : "blocked");
    });

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        title="Pessoas"
        text={`${plural(team.length, "pessoa acessa", "pessoas acessam")} ${projectName}. Editores e leitores só veem os workspaces onde estão.`}
        actions={
          data.canManage ? (
            <button type="button" onClick={() => setInviting(true)} className={btn.small}>
              <UserPlus size={16} aria-hidden /> Convidar por e-mail
            </button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5 lg:space-y-6">
          <section aria-label="Quem acessa" className="overflow-hidden rounded-card border border-line bg-card shadow-card">
            <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <h3 className="text-[15px] font-semibold">Quem acessa</h3>
              <span className="text-[12.5px] text-fg-2 tnum">{team.length}</span>
            </header>
            <ul className="divide-y divide-line">
              {team.map((p) => (
                <Person key={p.userId} p={p} actor={data.actorRole} canManage={data.canManage} pending={pending} onRole={(x, role) => act(() => changeMemberRole({ userId: x.userId, role }), `${x.name} agora é ${ROLE_LABEL[role].toLowerCase()}.`)} onRemove={setRemoving} />
              ))}
            </ul>
          </section>

          {outside.length > 0 && (
            <section aria-label="Na organização, fora deste workspace" className="overflow-hidden rounded-card border border-line bg-card shadow-card">
              <header className="border-b border-line px-4 py-3 sm:px-5">
                <h3 className="text-[15px] font-semibold">Na organização, fora deste workspace</h3>
                <p className="text-[12.5px] text-fg-2">Pôr aqui não gasta vaga do plano.</p>
              </header>
              <ul className="divide-y divide-line">
                {outside.map((p) => (
                  <li key={p.userId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-bold text-fg-2">
                      {initials(p.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{p.name}</span>
                      <span className="block truncate text-[12.5px] text-fg-2">
                        {ROLE_LABEL[p.role]} · {p.email}
                      </span>
                    </span>
                    {data.canManage && (
                      <button type="button" disabled={pending} onClick={() => act(() => addProjectMember(projectId, p.userId), `${p.name} agora acessa ${projectName}.`)} className={btn.subtle}>
                        <UserPlus size={15} aria-hidden /> Pôr aqui
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.invitations.length > 0 && (
            <section aria-label="Convites pendentes" className="overflow-hidden rounded-card border border-line bg-card shadow-card">
              <header className="border-b border-line px-4 py-3 sm:px-5">
                <h3 className="text-[15px] font-semibold">Convites pendentes</h3>
              </header>
              <ul className="divide-y divide-line">
                {data.invitations.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3 text-[13.5px] sm:px-5">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{i.email}</span>
                      <span className="block text-[12.5px] text-fg-2">
                        {ROLE_LABEL[i.role]} · vence em {shortDate(i.expiresAt)}
                      </span>
                    </span>
                    <button type="button" disabled={pending} onClick={() => act(() => revokeInvitation(i.id), "Convite cancelado.")} aria-label={`Cancelar convite de ${i.email}`} className={`${btn.quiet} h-8 shrink-0`}>
                      <X size={14} aria-hidden /> Cancelar
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-5 lg:space-y-6">
          <section aria-labelledby="h-vagas" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
            <SectionHeader id="h-vagas" title="Vagas do plano" text="Usuários da organização inteira; convites pendentes contam." />
            <p className="mt-4 flex items-baseline gap-1.5">
              <span className="text-[28px] leading-none font-bold tracking-[-0.03em] tnum">{data.seats.used}</span>
              <span className="text-[13px] text-fg-2 tnum">de {plural(data.seats.limit, "usuário", "usuários")}</span>
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full ${ratio >= 1 ? "bg-error" : ratio >= 0.8 ? "bg-warning" : "bg-accent"}`} style={{ width: `${Math.max(3, ratio * 100)}%` }} />
            </div>
            <p className="mt-3 text-[13px] text-fg-2">
              {free > 0 ? `Ainda ${free === 1 ? "cabe 1 pessoa" : `cabem ${free} pessoas`}.` : "Todas as vagas em uso. Pôr aqui quem já está na organização não gasta vaga."}{" "}
              <Link href="/painel/plano" className="font-semibold text-accent underline-offset-4 hover:underline">
                {free > 0 ? "Ver plano" : "Aumentar o plano"}
              </Link>
            </p>
          </section>

          <section aria-labelledby="h-papeis" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
            <SectionHeader id="h-papeis" title="O que cada papel faz" text="O papel vale para a organização inteira." />
            <ul className="mt-3 space-y-3">
              {ROLES.map(({ role, icon: I, access }) => (
                <li key={role} className="flex gap-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-2 text-fg-2">
                    <I size={15} aria-hidden />
                  </span>
                  <span className="min-w-0 text-[13px]">
                    <span className="block font-semibold">
                      {ROLE_LABEL[role]} <span className="font-normal text-fg-2">· {access}</span>
                    </span>
                    <span className="block text-fg-2">{ROLE_HINT[role]}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <Modal open={inviting} onClose={() => setInviting(false)} title={`Convidar para ${projectName}`}>
        {inviting && <Invite projectId={projectId} projectName={projectName} seats={data.seats} onClose={() => setInviting(false)} notify={toast.show} />}
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Tirar do workspace">
        {removing && (
          <div className="space-y-5">
            <p className="text-[14.5px] leading-relaxed">
              <strong>{removing.name}</strong> deixa de ver as contas e os dashboards de <strong>{projectName}</strong>. Continua na organização e nos outros workspaces dela.
            </p>
            <ModalActions>
              <button type="button" onClick={() => setRemoving(null)} className={`${btn.quiet} max-sm:h-11`}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const p = removing;
                  setRemoving(null);
                  act(() => removeProjectMember(projectId, p.userId), `${p.name} não acessa mais ${projectName}.`);
                }}
                className={`${btn.danger} max-sm:h-11`}
              >
                Tirar do workspace
              </button>
            </ModalActions>
          </div>
        )}
      </Modal>
      {toast.node}
    </div>
  );
}
