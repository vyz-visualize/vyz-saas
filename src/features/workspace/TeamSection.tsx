"use client";

// Equipe em Configurações: membros com papel, convite por e-mail (com o link
// para copiar), convites pendentes, troca de papel e remoção.

import { Check, Copy, Trash2, Users, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Checkbox } from "@/components/ui/controls";
import { Badge, Modal, ModalActions, TextField } from "@/components/ui/kit";
import { Select } from "@/components/ui/Select";
import { btn } from "@/components/ui/styles";
import { shortDate } from "@/features/integrations/sync-label";
import { changeMemberRole, inviteMember, removeMember, revokeInvitation, type InviteResult } from "@/server/workspace/team";
import type { SettingsData, TeamMember } from "./dto";
import { hasRole, ROLE_LABEL, type MemberRole } from "./session";
import { assignableRoles, canRemoveMember, INVITE_ROLES, ROLE_HINT, type InviteRole } from "./team";

type Notify = (msg: string) => void;

const roleOptions = (roles: readonly MemberRole[]) => roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }));

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input readOnly value={link} aria-label="Link do convite" onFocus={(e) => e.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-control border border-line bg-field px-3 text-[13px] text-fg tnum" />
      <button type="button" className={`${btn.small} shrink-0`} onClick={copy}>
        {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "Copiado" : "Copiar link"}
      </button>
    </div>
  );
}

function InviteForm({ notify, projects }: { notify: Notify; projects: { id: string; name: string }[] }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("member");
  // editor e leitor só veem os workspaces escolhidos; admin vê todos
  const [picked, setPicked] = useState<string[]>(() => projects.map((p) => p.id));
  const [sendEmail, setSendEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(InviteResult & { email: string }) | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      const r = await inviteMember({ email, role, sendEmail, projectIds: role === "admin" ? [] : picked });
      if (!r.ok) return setError(r.error.fields?.email ?? r.error.message);
      setError(null);
      setResult({ ...r.data, email });
      setEmail("");
      notify("Convite criado.");
    });
  return (
    <div className="space-y-3 rounded-[calc(var(--r-card)-4px)] border border-line bg-surface-2/50 p-4">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextField label="Convidar por e-mail" type="email" inputMode="email" value={email} onChange={setEmail} placeholder="nome@empresa.com.br" error={error} />
        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium text-fg" htmlFor="invite-role">
            Papel
          </label>
          <Select id="invite-role" value={role} onChange={(v) => setRole(v as InviteRole)} options={roleOptions(INVITE_ROLES)} />
        </div>
        <button type="submit" className={`${btn.small} h-10 max-sm:h-11`} disabled={pending || !email.trim()}>
          {pending ? "Convidando…" : "Convidar"}
        </button>
      </form>
      <p className="text-[12.5px] text-fg-2">{ROLE_HINT[role]}</p>
      {role !== "admin" && projects.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-[13px] font-medium">Workspaces que a pessoa acessa</legend>
          <div className="flex flex-wrap gap-1.5">
            {projects.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((cur) => (on ? cur.filter((id) => id !== p.id) : [...cur, p.id]))}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-chip border px-3 text-[13px] font-medium transition-colors ${on ? "border-accent bg-accent-soft text-fg" : "border-line text-fg-2 hover:text-fg"}`}
                >
                  {on && <Check size={13} aria-hidden className="text-accent" />}
                  {p.name}
                </button>
              );
            })}
          </div>
          {!picked.length && <p className="text-[12px] text-error-fg">Sem nenhum workspace, a pessoa entra mas não vê nada até um admin pôr ela em algum.</p>}
        </fieldset>
      )}
      {role === "admin" && <p className="text-[12.5px] text-fg-2">Admins acessam todos os workspaces.</p>}
      <Checkbox
        label="Enviar também por e-mail"
        hint="Só para quem ainda não tem conta no VYZ. O envio de e-mails tem limite: mande o link por WhatsApp se não chegar."
        checked={sendEmail}
        onChange={setSendEmail}
      />
      {result && (
        <div className="space-y-2 border-t border-line pt-3" role="status">
          <p className="text-[13.5px]">
            Convite para <strong>{result.email}</strong> {result.emailed ? "enviado por e-mail." : "criado."} Copie o link e mande para a pessoa: ele vale até{" "}
            {shortDate(result.expiresAt)} e só funciona com este e-mail. O link aparece só agora.
          </p>
          <CopyLink link={result.link} />
        </div>
      )}
    </div>
  );
}

function MemberRow({ m, actor, owners, onRemove, notify }: { m: TeamMember; actor: MemberRole; owners: number; onRemove: (m: TeamMember) => void; notify: Notify }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const roles = m.isYou ? [] : assignableRoles(actor, m.role);
  const removable = canRemoveMember({ actor, target: m.role, isSelf: m.isYou, owners });
  const change = (role: string) =>
    start(async () => {
      const r = await changeMemberRole({ userId: m.userId, role: role as MemberRole });
      if (!r.ok) return setError(r.error.message);
      setError(null);
      notify(`${m.name} agora é ${ROLE_LABEL[role as MemberRole].toLowerCase()}.`);
    });
  return (
    <li className="py-3 text-[14px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12.5px] font-bold text-accent" aria-hidden>
            {(m.name[0] ?? "?").toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {m.name}
              {m.isYou && <span className="font-normal text-fg-2"> (você)</span>}
            </span>
            <span className="block truncate text-[12.5px] text-fg-2">{m.email}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {roles.length ? (
            <Select ariaLabel={`Papel de ${m.name}`} size="sm" className="w-32" value={m.role} onChange={change} options={roleOptions(roles)} disabled={pending} />
          ) : (
            <Badge tone={m.role === "owner" ? "accent" : "outline"}>{ROLE_LABEL[m.role]}</Badge>
          )}
          {removable && (
            <button type="button" className="inline-flex size-9 items-center justify-center rounded-control text-fg-2 transition-colors hover:bg-error-soft hover:text-error-fg" aria-label={`Remover ${m.name}`} onClick={() => onRemove(m)}>
              <Trash2 size={15} aria-hidden />
            </button>
          )}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-[13px] text-error-fg">
          {error}
        </p>
      )}
    </li>
  );
}

export function TeamSection({ data, role, timeZone, notify }: { data: SettingsData; role: MemberRole; timeZone: string; notify: Notify }) {
  const admin = hasRole(role, "admin");
  const owners = data.team.filter((m) => m.role === "owner").length;
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const confirmRemove = () =>
    start(async () => {
      if (!removing) return;
      const r = await removeMember(removing.userId);
      if (!r.ok) return setError(r.error.message);
      notify(`${removing.name} saiu da equipe.`);
      setRemoving(null);
      setError(null);
    });
  const revoke = (id: string) =>
    start(async () => {
      const r = await revokeInvitation(id);
      notify(r.ok ? "Convite cancelado." : r.error.message);
    });

  return (
    <>
      {admin ? <InviteForm notify={notify} projects={data.projects ?? []} /> : <p className="text-[14px] text-fg-2">Só administradores convidam e mudam papéis.</p>}
      <ul className="divide-y divide-line">
        {data.team.map((m) => (
          <MemberRow key={m.userId} m={m} actor={role} owners={owners} onRemove={setRemoving} notify={notify} />
        ))}
      </ul>
      {admin && data.invitations.length > 0 && (
        <div className="space-y-2 border-t border-line pt-4">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Users size={14} aria-hidden /> Convites pendentes
          </p>
          <ul className="divide-y divide-line text-[13.5px]">
            {data.invitations.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-fg-2">
                  <span className="text-fg">{i.email}</span> · {ROLE_LABEL[i.role]} · vence em {shortDate(i.expiresAt, timeZone)}
                </span>
                <button type="button" className={`${btn.quiet} h-8 shrink-0 text-[13px]`} disabled={pending} onClick={() => revoke(i.id)} aria-label={`Cancelar convite de ${i.email}`}>
                  <X size={14} aria-hidden /> Cancelar
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[12.5px] text-fg-2">Perdeu o link? Convide o mesmo e-mail de novo: o convite anterior é cancelado e sai um link novo.</p>
        </div>
      )}
      <Modal open={!!removing} onClose={() => !pending && setRemoving(null)} title="Remover da equipe?">
        {removing && (
          <div className="space-y-4">
            <p className="text-[14px] text-fg-2">
              <strong className="text-fg">{removing.name}</strong> perde o acesso a esta organização na hora. Os dashboards e páginas que a pessoa criou continuam aqui. Para voltar, só com um convite novo.
            </p>
            {error && (
              <p role="alert" className="text-[13px] text-error-fg">
                {error}
              </p>
            )}
            <ModalActions>
              <button type="button" className={`${btn.quiet} max-sm:h-11`} disabled={pending} onClick={() => setRemoving(null)}>
                Cancelar
              </button>
              <button type="button" className={`${btn.danger} max-sm:h-11`} disabled={pending} onClick={confirmRemove}>
                {pending ? "Removendo…" : "Remover"}
              </button>
            </ModalActions>
          </div>
        )}
      </Modal>
    </>
  );
}
