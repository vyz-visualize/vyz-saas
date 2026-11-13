"use client";

// Gerenciador de usuários (aba Interno, só admins): lista, busca, filtros e ações.
// No computador é uma tabela; abaixo de lg, cada pessoa vira um cartão (sem rolagem de lado).
// A ação mais usada (Dar plano) fica à vista; as outras moram no menu de cada linha.

import { ArrowLeft, Ban, Gift, MoreHorizontal, RotateCcw, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Badge, Modal, ModalActions, PageHeader, TextField, type BadgeTone } from "@/components/ui/kit";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { Select } from "@/components/ui/Select";
import { btn } from "@/components/ui/styles";
import { applyDeletionAction, grantPlanAction, previewDeletionAction, removePlanAction, setInactiveAction } from "@/server/admin/user-actions";
import { GRANT_LABEL, GRANT_MONTHS, GRANT_TIERS, matchesUser, STATUS_LABEL, statusOf, type ActionResult, type AdminUserRow, type GrantTier, type UserStatus } from "./users";

const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "nunca");
const ago = (iso: string | null) => {
  if (!iso) return "nunca entrou";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`;
};
const planLabel = (id: string) => GRANT_LABEL[id.replace(/^lp_/, "") as GrantTier] ?? id;
const TONE: Record<UserStatus, BadgeTone> = { ativo: "ok", inativado: "error", sem_plano: "neutral", parou_no_pagamento: "warn" };
const FILTERS = ["todos", "ativo", "parou_no_pagamento", "sem_plano", "inativado"] as const;

const initials = (u: AdminUserRow) =>
  (u.name ?? u.email)
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const subline = (u: AdminUserRow) => [u.name, u.workspace?.name && `${u.workspace.name}${u.workspace.role !== "owner" ? ` (${u.workspace.role})` : ""}`].filter(Boolean).join(" · ") || "sem workspace";

type Dialog = { kind: "grant" | "delete" | "remove-plan" | "inactive"; user: AdminUserRow } | null;

function Avatar({ u }: { u: AdminUserRow }) {
  return (
    <span aria-hidden className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${u.banned ? "bg-surface-2 text-fg-2" : "bg-accent-soft text-accent"}`}>
      {initials(u)}
    </span>
  );
}

function PlanCell({ u }: { u: AdminUserRow }) {
  if (u.plan)
    return (
      <>
        <p className="flex flex-wrap items-center gap-1.5 text-fg">
          {planLabel(u.plan.id)}
          {u.plan.courtesy && <Badge tone="accent">cortesia</Badge>}
        </p>
        <p className="text-[12px] whitespace-nowrap text-fg-2">
          {u.plan.provider} · até {dt(u.plan.periodEnd)}
        </p>
      </>
    );
  if (u.openCheckout) return <p className="text-[12.5px] text-fg-2">escolheu {u.openCheckout.planId ? planLabel(u.openCheckout.planId) : "pedido"}</p>;
  return <span className="text-fg-2">Sem plano</span>;
}

/** Ações de uma pessoa: Dar plano à vista e o resto no menu. */
function RowActions({ u, pending, open }: { u: AdminUserRow; pending: boolean; open: (d: Dialog) => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <button type="button" className={btn.subtle} disabled={pending} onClick={() => open({ kind: "grant", user: u })}>
        <Gift size={14} aria-hidden /> Dar plano
      </button>
      <Menu>
        <MenuTrigger aria-label={`Mais ações de ${u.email}`} disabled={pending} className={`${btn.icon} outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-surface-2 data-[state=open]:text-fg`}>
          <MoreHorizontal size={18} aria-hidden />
        </MenuTrigger>
        <MenuContent align="end">
          {u.plan && (
            <MenuItem icon={<X size={15} />} onSelect={() => open({ kind: "remove-plan", user: u })}>
              Tirar plano
            </MenuItem>
          )}
          <MenuItem icon={u.banned ? <RotateCcw size={15} /> : <Ban size={15} />} onSelect={() => open({ kind: "inactive", user: u })}>
            {u.banned ? "Reativar" : "Inativar"}
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<Trash2 size={15} />} className="text-error-fg" onSelect={() => open({ kind: "delete", user: u })}>
            Excluir
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

export function UsersManager({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UserStatus | "todos">("todos");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const list = useMemo(() => users.filter((u) => matchesUser(u, query) && (filter === "todos" || statusOf(u) === filter)), [users, query, filter]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: users.length };
    for (const u of users) c[statusOf(u)] = (c[statusOf(u)] ?? 0) + 1;
    return c;
  }, [users]);

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setResult(await fn());
      setDialog(null);
    });
  const done = (r: ActionResult) => {
    setResult(r);
    if (r.ok) setDialog(null);
  };
  const th = "px-4 py-2.5 text-left text-[11.5px] font-medium tracking-[0.02em] text-fg-2";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Só admin"
        title="Usuários"
        text="Todos os cadastros: último acesso, logins, plano e ações. Liberar plano aqui não cobra nada."
        actions={
          <Link href="/painel/interno" className={btn.subtle}>
            <ArrowLeft size={15} aria-hidden /> Voltar ao Interno
          </Link>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block lg:w-80">
          <span className="sr-only">Buscar</span>
          <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por e-mail, nome ou organização"
            className="h-10 w-full rounded-control border border-line bg-field pr-3 pl-9 text-[14px] text-fg outline-none transition-colors placeholder:text-fg-2/70 hover:border-fg-2/50 focus:border-accent focus:ring-1 focus:ring-accent max-sm:h-11 max-sm:text-[16px]"
          />
        </label>
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <div role="group" aria-label="Filtrar por situação" className="flex w-max gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`inline-flex h-9 items-center gap-1.5 rounded-chip px-3 text-[13px] font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${filter === f ? "bg-accent text-on-accent" : "border border-line bg-card text-fg-2 hover:text-fg"}`}
              >
                {f === "todos" ? "Todos" : STATUS_LABEL[f]}
                <span className={`tabular-nums ${filter === f ? "opacity-80" : "text-fg-2/70"}`}>{counts[f] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {result && (
        <p role="status" className={`flex items-start justify-between gap-3 rounded-control px-3.5 py-2.5 text-[13.5px] ${result.ok ? "bg-accent-soft text-fg" : "bg-error-soft text-error-fg"}`}>
          <span>{result.message}</span>
          <button type="button" onClick={() => setResult(null)} aria-label="Fechar aviso" className="-my-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-black/5">
            <X size={14} aria-hidden />
          </button>
        </p>
      )}

      {list.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-4 py-12 text-center text-[14px] text-fg-2">Ninguém encontrado com esse filtro.</p>
      ) : (
        <>
          {/* computador: tabela */}
          <div className="hidden overflow-hidden rounded-card border border-line bg-card lg:block">
            <table className="w-full text-left text-[13.5px]">
              <thead className="border-b border-line bg-surface-2/50">
                <tr>
                  <th className={th}>Usuário</th>
                  <th className={th}>Cadastro</th>
                  <th className={th}>Último acesso</th>
                  <th className={`${th} text-right`}>Logins</th>
                  <th className={th}>Plano</th>
                  <th className={th}>Situação</th>
                  <th className={`${th} text-right`}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => {
                  const s = statusOf(u);
                  return (
                    <tr key={u.id} className="border-b border-line/70 transition-colors last:border-0 hover:bg-surface-2/40">
                      <td className="max-w-[320px] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar u={u} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-fg" title={u.email}>
                              {u.email}
                            </p>
                            <p className="truncate text-[12px] text-fg-2">{subline(u)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-fg-2 tabular-nums">{dt(u.createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-fg-2" title={u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString("pt-BR") : undefined}>
                        {ago(u.lastSignInAt)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{u.signIns}</td>
                      <td className="px-4 py-3">
                        <PlanCell u={u} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={TONE[s]}>{STATUS_LABEL[s]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <RowActions u={u} pending={pending} open={setDialog} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* celular e tablet: um cartão por pessoa */}
          <ul className="space-y-3 lg:hidden">
            {list.map((u) => {
              const s = statusOf(u);
              return (
                <li key={u.id} className="rounded-card border border-line bg-card p-4">
                  <div className="flex items-start gap-3">
                    <Avatar u={u} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium [overflow-wrap:anywhere] text-fg">{u.email}</p>
                      <p className="text-[12.5px] text-fg-2">{subline(u)}</p>
                    </div>
                    <Badge tone={TONE[s]}>{STATUS_LABEL[s]}</Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-[12.5px]">
                    <div className="rounded-control bg-surface-2/70 px-2.5 py-2">
                      <dt className="text-fg-2">Cadastro</dt>
                      <dd className="mt-0.5 font-medium tabular-nums">{dt(u.createdAt)}</dd>
                    </div>
                    <div className="rounded-control bg-surface-2/70 px-2.5 py-2">
                      <dt className="text-fg-2">Acesso</dt>
                      <dd className="mt-0.5 font-medium">{ago(u.lastSignInAt)}</dd>
                    </div>
                    <div className="rounded-control bg-surface-2/70 px-2.5 py-2">
                      <dt className="text-fg-2">Logins</dt>
                      <dd className="mt-0.5 font-medium tabular-nums">{u.signIns}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
                    <div className="min-w-0 text-[13.5px]">
                      <PlanCell u={u} />
                    </div>
                    <RowActions u={u} pending={pending} open={setDialog} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-[12.5px] text-fg-2 tabular-nums">
            {list.length} de {users.length} {users.length === 1 ? "cadastro" : "cadastros"}
          </p>
        </>
      )}

      {dialog?.kind === "grant" && <GrantDialog user={dialog.user} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "delete" && <DeleteDialog user={dialog.user} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === "remove-plan" && (
        <ConfirmDialog
          title="Tirar plano"
          text={
            <>
              Tirar o plano de <strong className="break-all">{dialog.user.email}</strong>? A organização fica sem assinatura; os dados continuam guardados.
            </>
          }
          confirm="Tirar plano"
          pending={pending}
          onClose={() => setDialog(null)}
          onConfirm={() => run(() => removePlanAction(dialog.user.id))}
        />
      )}
      {dialog?.kind === "inactive" && (
        <ConfirmDialog
          title={dialog.user.banned ? "Reativar usuário" : "Inativar usuário"}
          text={
            <>
              {dialog.user.banned ? "Reativar" : "Inativar"} <strong className="break-all">{dialog.user.email}</strong>? {dialog.user.banned ? "A pessoa volta a conseguir entrar." : "A pessoa deixa de conseguir entrar; nada é apagado."}
            </>
          }
          confirm={dialog.user.banned ? "Reativar" : "Inativar"}
          pending={pending}
          onClose={() => setDialog(null)}
          onConfirm={() => run(() => setInactiveAction(dialog.user.id, !dialog.user.banned))}
        />
      )}
    </div>
  );
}

/** Confirmação curta (no lugar do confirm() do navegador). */
function ConfirmDialog({ title, text, confirm, pending, onClose, onConfirm }: { title: string; text: React.ReactNode; confirm: string; pending: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-5">
        <p className="text-[14.5px] leading-relaxed">{text}</p>
        <ModalActions>
          <button type="button" className={`${btn.quiet} max-sm:h-11`} onClick={onClose} disabled={pending}>
            Cancelar
          </button>
          <button type="button" className={`${btn.small} max-sm:h-11`} onClick={onConfirm} disabled={pending}>
            {pending ? "Aguarde…" : confirm}
          </button>
        </ModalActions>
      </div>
    </Modal>
  );
}

function GrantDialog({ user, onClose, onDone }: { user: AdminUserRow; onClose: () => void; onDone: (r: ActionResult) => void }) {
  const [tier, setTier] = useState<GrantTier>("avancado");
  const [months, setMonths] = useState<number>(12);
  const [pending, start] = useTransition();
  const note = user.workspace
    ? user.plan
      ? `Troca o plano atual (${planLabel(user.plan.id)}) pela cortesia.`
      : "Cria a assinatura de cortesia na organização da pessoa."
    : user.openCheckout
      ? "A pessoa parou no pagamento: o pedido dela é concluído como cortesia (sem cobrança) e a organização é criada."
      : "A pessoa ainda não tem workspace: ele é criado agora, com a cortesia, e ela passa pelas boas-vindas no próximo login.";
  return (
    <Modal open onClose={onClose} title={`Dar plano a ${user.email}`}>
      <div className="space-y-4">
        <p className="text-[13.5px] text-fg-2">{note}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-[13px] font-medium">
            Plano
            <Select value={tier} onChange={(v) => setTier(v as GrantTier)} ariaLabel="Plano" options={GRANT_TIERS.map((t) => ({ value: t, label: GRANT_LABEL[t] }))} />
          </label>
          <label className="space-y-1 text-[13px] font-medium">
            Prazo
            <Select
              value={String(months)}
              onChange={(v) => setMonths(Number(v))}
              ariaLabel="Prazo"
              options={GRANT_MONTHS.map((m) => ({ value: String(m), label: m === 0 ? "Sem prazo" : m === 1 ? "1 mês" : `${m} meses` }))}
            />
          </label>
        </div>
        <ModalActions>
          <button type="button" className={`${btn.quiet} max-sm:h-11`} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={`${btn.small} max-sm:h-11`} disabled={pending} onClick={() => start(async () => onDone(await grantPlanAction(user.id, tier, months)))}>
            {pending ? "Liberando…" : "Liberar sem cobrar"}
          </button>
        </ModalActions>
      </div>
    </Modal>
  );
}

function DeleteDialog({ user, onClose, onDone }: { user: AdminUserRow; onClose: () => void; onDone: (r: ActionResult) => void }) {
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewDeletionAction>> | null>(null);
  const [typed, setTyped] = useState("");
  const [pending, start] = useTransition();
  const ready = preview?.ok && !preview.blocked;
  return (
    <Modal open onClose={onClose} title={`Excluir ${user.email}`} wide>
      <div className="space-y-4">
        <p className="text-[13.5px] text-fg-2">Exclusão total e definitiva (o mesmo processo dos pedidos de exclusão de dados). Primeiro veja a simulação: ela não apaga nada.</p>
        {!preview && (
          <button type="button" className={btn.subtle} disabled={pending} onClick={() => start(async () => setPreview(await previewDeletionAction(user.email)))}>
            {pending ? "Simulando…" : "Ver simulação"}
          </button>
        )}
        {preview && !preview.ok && <p className="rounded-control bg-error-soft px-3 py-2 text-[13px] text-error-fg">{preview.message}</p>}
        {preview?.ok && <pre className="max-h-72 overflow-auto rounded-control border border-line bg-field p-3 text-[12px] whitespace-pre-wrap text-fg">{preview.text}</pre>}
        {preview?.ok && preview.blocked && <p className="text-[13px] text-error-fg">Há bloqueios acima: resolva antes de excluir.</p>}
        {ready && (
          <>
            <TextField label={`Para confirmar, digite ${user.email}`} value={typed} onChange={setTyped} />
            <ModalActions>
              <button type="button" className={`${btn.quiet} max-sm:h-11`} onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className={`${btn.danger} max-sm:h-11`}
                disabled={pending || typed.trim().toLowerCase() !== user.email.toLowerCase()}
                onClick={() => start(async () => onDone(await applyDeletionAction(user.email, typed, preview.code)))}
              >
                {pending ? "Excluindo…" : "Excluir de vez"}
              </button>
            </ModalActions>
          </>
        )}
      </div>
    </Modal>
  );
}
