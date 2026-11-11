"use client";

// Gerenciador de usuários (aba Interno, só admins): lista, busca, filtros e ações.

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Modal, PageHeader, TextField } from "@/components/ui/kit";
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
const TONE: Record<UserStatus, string> = { ativo: "bg-accent-soft text-accent", inativado: "bg-error/15 text-error", sem_plano: "bg-field text-fg-2", parou_no_pagamento: "bg-field text-fg" };
const small = btn.secondary.replace("h-12 px-6", "h-8 px-3 text-[13px]");
const danger = `${small} hover:!border-error hover:!text-error`;

type Dialog = { kind: "grant"; user: AdminUserRow } | { kind: "delete"; user: AdminUserRow } | null;

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

  const run = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Só admin"
        title="Usuários"
        text="Todos os cadastros: último acesso, logins, plano e ações. Liberar plano aqui não cobra nada."
        actions={
          <Link href="/painel/interno" className={small}>
            Voltar ao Interno
          </Link>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-80">
          <TextField label="Buscar" value={query} onChange={setQuery} placeholder="e-mail, nome ou workspace" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["todos", "ativo", "parou_no_pagamento", "sem_plano", "inativado"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`h-8 rounded-pill px-3 text-[13px] ${filter === f ? "bg-accent text-on-accent" : "border border-line text-fg-2 hover:text-fg"}`}
            >
              {f === "todos" ? "Todos" : STATUS_LABEL[f]} · {counts[f] ?? 0}
            </button>
          ))}
        </div>
      </div>

      {result && (
        <p role="status" className={`rounded-control px-3 py-2 text-[13.5px] ${result.ok ? "bg-accent-soft text-fg" : "bg-error/10 text-error"}`}>
          {result.message}
        </p>
      )}

      <div className="overflow-x-auto rounded-card border border-line bg-card">
        <table className="w-full min-w-[920px] text-left text-[13.5px]">
          <thead className="border-b border-line text-[12px] text-fg-2">
            <tr>
              <th className="px-3 py-2 font-medium">Usuário</th>
              <th className="px-3 py-2 font-medium">Cadastro</th>
              <th className="px-3 py-2 font-medium">Último acesso</th>
              <th className="px-3 py-2 font-medium tabular-nums">Logins</th>
              <th className="px-3 py-2 font-medium">Plano</th>
              <th className="px-3 py-2 font-medium">Situação</th>
              <th className="px-3 py-2 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => {
              const s = statusOf(u);
              return (
                <tr key={u.id} className="border-b border-line/60 last:border-0 align-top">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-fg">{u.email}</p>
                    <p className="text-[12px] text-fg-2">
                      {[u.name, u.workspace?.name && `${u.workspace.name}${u.workspace.role !== "owner" ? ` (${u.workspace.role})` : ""}`].filter(Boolean).join(" · ") || "sem workspace"}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-fg-2">{dt(u.createdAt)}</td>
                  <td className="px-3 py-2.5 text-fg-2" title={u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString("pt-BR") : undefined}>
                    {ago(u.lastSignInAt)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{u.signIns}</td>
                  <td className="px-3 py-2.5">
                    {u.plan ? (
                      <>
                        <p className="text-fg">
                          {planLabel(u.plan.id)}
                          {u.plan.courtesy && <span className="ml-1.5 text-[11.5px] text-accent">cortesia</span>}
                        </p>
                        <p className="text-[12px] text-fg-2">
                          {u.plan.provider} · até {dt(u.plan.periodEnd)}
                        </p>
                      </>
                    ) : u.openCheckout ? (
                      <p className="text-[12px] text-fg-2">escolheu {u.openCheckout.planId ? planLabel(u.openCheckout.planId) : "pedido"}</p>
                    ) : (
                      <span className="text-fg-2">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-pill px-2 py-0.5 text-[12px] ${TONE[s]}`}>{STATUS_LABEL[s]}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button type="button" className={small} disabled={pending} onClick={() => setDialog({ kind: "grant", user: u })}>
                        Dar plano
                      </button>
                      {u.plan && (
                        <button type="button" className={small} disabled={pending} onClick={() => confirm(`Tirar o plano de ${u.email}?`) && run(() => removePlanAction(u.id))}>
                          Tirar plano
                        </button>
                      )}
                      <button
                        type="button"
                        className={small}
                        disabled={pending}
                        onClick={() => confirm(`${u.banned ? "Reativar" : "Inativar"} ${u.email}?`) && run(() => setInactiveAction(u.id, !u.banned))}
                      >
                        {u.banned ? "Reativar" : "Inativar"}
                      </button>
                      <button type="button" className={danger} disabled={pending} onClick={() => setDialog({ kind: "delete", user: u })}>
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!list.length && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-fg-2">
                  Ninguém encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {dialog?.kind === "grant" && (
        <GrantDialog
          user={dialog.user}
          onClose={() => setDialog(null)}
          onDone={(r) => {
            setResult(r);
            if (r.ok) setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteDialog
          user={dialog.user}
          onClose={() => setDialog(null)}
          onDone={(r) => {
            setResult(r);
            if (r.ok) setDialog(null);
          }}
        />
      )}
    </div>
  );
}

function GrantDialog({ user, onClose, onDone }: { user: AdminUserRow; onClose: () => void; onDone: (r: ActionResult) => void }) {
  const [tier, setTier] = useState<GrantTier>("avancado");
  const [months, setMonths] = useState<number>(12);
  const [pending, start] = useTransition();
  const note = user.workspace
    ? user.plan
      ? `Troca o plano atual (${planLabel(user.plan.id)}) pela cortesia.`
      : "Cria a assinatura de cortesia no workspace da pessoa."
    : user.openCheckout
      ? "A pessoa parou no pagamento: o pedido dela é concluído como cortesia (sem cobrança) e o workspace é criado."
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
        <div className="flex justify-end gap-2">
          <button type="button" className={small} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={btn.small}
            disabled={pending}
            onClick={() => start(async () => onDone(await grantPlanAction(user.id, tier, months)))}
          >
            {pending ? "Liberando…" : "Liberar sem cobrar"}
          </button>
        </div>
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
          <button type="button" className={small} disabled={pending} onClick={() => start(async () => setPreview(await previewDeletionAction(user.email)))}>
            {pending ? "Simulando…" : "Ver simulação"}
          </button>
        )}
        {preview && !preview.ok && <p className="rounded-control bg-error/10 px-3 py-2 text-[13px] text-error">{preview.message}</p>}
        {preview?.ok && <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-control bg-field p-3 text-[12px] text-fg">{preview.text}</pre>}
        {preview?.ok && preview.blocked && <p className="text-[13px] text-error">Há bloqueios acima: resolva antes de excluir.</p>}
        {ready && (
          <>
            <TextField label={`Para confirmar, digite ${user.email}`} value={typed} onChange={setTyped} />
            <div className="flex justify-end gap-2">
              <button type="button" className={small} onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className={`${btn.small} !bg-error !text-white`}
                disabled={pending || typed.trim().toLowerCase() !== user.email.toLowerCase()}
                onClick={() => start(async () => onDone(await applyDeletionAction(user.email, typed, preview.code)))}
              >
                {pending ? "Excluindo…" : "Excluir de vez"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
