"use client";

// Aba Contas de um workspace: as contas deste cliente por plataforma (ligar, desligar,
// sincronizar, mover para outro workspace, remover), o "Adicionar contas" (escolhe a plataforma
// e pega as contas dos logins que a organização já tem; sem login, conecta um e volta para cá)
// e os logins que alimentam o workspace. Só admin mexe; member pede sincronização.

import { AlertTriangle, ArrowRight, ArrowUpRight, ChevronLeft, FolderInput, MoreHorizontal, Plug, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { PlatformIcon } from "@/components/brand/PlatformIcon";
import { CheckboxBox } from "@/components/ui/controls";
import { Badge, Modal, ModalActions, PageHeader, SectionHeader, type BadgeTone } from "@/components/ui/kit";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";
import { Select } from "@/components/ui/Select";
import { btn } from "@/components/ui/styles";
import { useToast } from "@/components/ui/Toast";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { ConnectButton } from "@/features/integrations/ConnectButton";
import { PROVIDERS, type ProviderId } from "@/features/integrations/providers";
import { relativeTime, syncSummary } from "@/features/integrations/sync-label";
import type { AdAccountDTO, ConnectionDTO } from "@/features/integrations/types";
import { projectHref } from "@/features/workspace/nav";
import { removeAdAccount, resyncAccount } from "@/server/integrations/actions";
import { addAccountsToProject, setAccountActive } from "@/server/projects/accounts";
import { moveAccountToProject } from "@/server/projects/actions";
import type { ProjectAccountsData } from "../types";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const platformName = (id: string) => PLATFORMS[id as PlatformId]?.name ?? id;
const PLATFORM_ORDER = Object.keys(PLATFORMS);
const ring = "outline-none focus-visible:ring-2 focus-visible:ring-accent";

const CONNECTION_STATUS: Record<ConnectionDTO["status"], { label: string; tone: BadgeTone }> = {
  active: { label: "Conectado", tone: "ok" },
  expired: { label: "Expirou", tone: "warn" },
  revoked: { label: "Desfeito", tone: "error" },
  error: { label: "Com erro", tone: "error" },
};

const loginName = (c: ConnectionDTO | undefined) => (c ? (c.userName ?? c.userEmail ?? PROVIDERS[c.provider].name) : null);

/** Situação de uma conta numa linha: o selo e a frase de apoio. */
function accountState(a: AdAccountDTO, now: string, timeZone: string): { label: string; tone: BadgeTone; detail: string } {
  if (a.manual) return { label: "Aguardando conexão", tone: "dashed", detail: "Cadastrada pelo ID" };
  if (!a.isEnabled) return { label: "Desligada", tone: "neutral", detail: a.status === "active" ? "Não entra nos dashboards" : "O login não dá mais acesso a ela" };
  const s = syncSummary(a, now, timeZone);
  if (s?.tone === "error") return { label: "Falhou", tone: "error", detail: s.detail ?? s.label };
  if (s?.tone === "running") return { label: "Sincronizando", tone: "accent", detail: s.label };
  return { label: "Ativa", tone: "ok", detail: a.lastSyncedAt ? `Sincronizada ${relativeTime(a.lastSyncedAt, now, timeZone)}` : "Aguardando a primeira sincronização" };
}

function Toggle({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200 disabled:opacity-50 ${ring} ${checked ? "bg-accent" : "bg-surface-2 ring-1 ring-line ring-inset"}`}
    >
      <span className={`block size-[18px] rounded-full shadow transition-transform duration-200 ease-brand ${checked ? "translate-x-[19px] bg-on-accent" : "translate-x-[3px] bg-fg-2"}`} />
    </button>
  );
}

/** "Adicionar contas": escolher a plataforma, depois as contas dos logins (ou conectar um login). */
function AddAccounts({ data, projectId, projectName, onDone }: { data: ProjectAccountsData; projectId: string; projectName: string; onDone: (msg?: string) => void }) {
  const [provider, setProvider] = useState<ProviderId | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const next = projectHref(projectId, "contas");
  const conns = useMemo(() => new Map(data.connections.map((c) => [c.id, c])), [data.connections]);
  const providerOf = (a: AdAccountDTO) => (a.connectionId ? conns.get(a.connectionId)?.provider : undefined);
  const inHere = (platformId: string) => data.accounts.filter((a) => a.platformId === platformId && a.isEnabled).length;

  if (!provider) {
    return (
      <div className="space-y-4">
        <p className="text-[14px] text-fg-2">De qual ferramenta são as contas de {projectName}?</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.providers.map((p) => {
            const active = data.connections.filter((c) => c.provider === p && c.status === "active").length;
            const available = data.candidates.filter((a) => providerOf(a) === p).length;
            return (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => {
                    setProvider(p);
                    setPicked(new Set());
                    setError(null);
                  }}
                  className={`flex w-full items-center gap-3 rounded-[calc(var(--r-card)-4px)] border border-line p-3 text-left transition-colors hover:border-fg-2/50 hover:bg-surface-2/40 ${ring}`}
                >
                  <PlatformIcon id={p} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{PROVIDERS[p].name}</span>
                    <span className="block truncate text-[12.5px] text-fg-2">{active ? (available ? plural(available, "conta nos seus logins", "contas nos seus logins") : "Todas as contas já estão aqui") : "Conectar um login"}</span>
                  </span>
                  <ArrowRight size={15} aria-hidden className="shrink-0 text-fg-2" />
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-[12.5px] text-fg-2">
          Planilha ou cadastro pelo ID:{" "}
          <Link href="/painel/contas" className="font-semibold text-accent underline-offset-4 hover:underline">
            em Conexões
          </Link>
          .
        </p>
      </div>
    );
  }

  const active = data.connections.filter((c) => c.provider === provider && c.status === "active");
  const list = data.candidates.filter((a) => providerOf(a) === provider);
  const platforms = [...new Set(list.map((a) => a.platformId))].sort((a, b) => PLATFORM_ORDER.indexOf(a) - PLATFORM_ORDER.indexOf(b));
  const room = (platformId: string) => Math.max(0, data.maxAccountsPerPlatform - inHere(platformId));
  const pickedIn = (platformId: string) => list.filter((a) => a.platformId === platformId && picked.has(a.id)).length;

  const add = () =>
    start(async () => {
      setError(null);
      for (const platformId of platforms) {
        const ids = list.filter((a) => a.platformId === platformId && picked.has(a.id)).map((a) => a.id);
        if (!ids.length) continue;
        const r = await addAccountsToProject(projectId, platformId, ids);
        if (!r.ok) return setError(r.error.message);
      }
      onDone(`${plural(picked.size, "conta adicionada", "contas adicionadas")} a ${projectName}.`);
    });

  return (
    <div className="space-y-5">
      <button type="button" onClick={() => setProvider(null)} className={`${btn.quiet} -ml-3 h-8`}>
        <ChevronLeft size={15} aria-hidden /> Outra ferramenta
      </button>
      <div className="flex items-center gap-3">
        <PlatformIcon id={provider} size={40} />
        <div className="min-w-0">
          <p className="text-[16px] font-semibold">{PROVIDERS[provider].name}</p>
          <p className="text-[12.5px] text-fg-2">{active.length ? `Pelos logins: ${active.map((c) => loginName(c)).join(", ")}` : "Nenhum login conectado ainda"}</p>
        </div>
      </div>

      {!active.length ? (
        <div className="space-y-3 rounded-[calc(var(--r-card)-4px)] border border-dashed border-line p-5">
          <p className="text-[14px] text-fg-2">Entre com o {PROVIDERS[provider].loginName}. Depois você volta para cá e escolhe as contas de {projectName}.</p>
          <ConnectButton provider={provider} next={next} canManage={data.canManage} />
        </div>
      ) : list.length === 0 ? (
        <div className="space-y-3 rounded-[calc(var(--r-card)-4px)] border border-dashed border-line p-5">
          <p className="text-[14px] text-fg-2">Todas as contas que esses logins enxergam já estão neste workspace. Precisa de outra? Conecte o login que tem acesso a ela.</p>
          <ConnectButton provider={provider} next={next} canManage={data.canManage} variant="secondary" label="Conectar outro login" />
        </div>
      ) : (
        <>
          {platforms.map((platformId) => {
            const free = room(platformId);
            return (
              <fieldset key={platformId} className="space-y-1.5">
                <legend className="flex w-full items-center justify-between gap-3 pb-1 text-[13px]">
                  <span className="font-semibold">{platformName(platformId)}</span>
                  <span className={`tnum ${free === 0 ? "text-error-fg" : "text-fg-2"}`}>
                    {free === 0 ? `Limite do plano: ${data.maxAccountsPerPlatform} por workspace` : `Cabem mais ${free} aqui`}
                  </span>
                </legend>
                <ul className="divide-y divide-line rounded-[calc(var(--r-card)-4px)] border border-line">
                  {list
                    .filter((a) => a.platformId === platformId)
                    .map((a) => {
                      const on = picked.has(a.id);
                      const full = !on && pickedIn(platformId) >= free;
                      return (
                        <li key={a.id}>
                          <label className={`flex items-center gap-3 px-3 py-2.5 ${full ? "opacity-50" : "cursor-pointer hover:bg-surface-2/40"}`}>
                            <CheckboxBox
                              checked={on}
                              disabled={full}
                              ariaLabel={a.name}
                              onChange={(v) =>
                                setPicked((cur) => {
                                  const n = new Set(cur);
                                  if (v) n.add(a.id);
                                  else n.delete(a.id);
                                  return n;
                                })
                              }
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-medium">{a.name}</span>
                              <span className="block truncate text-[12px] text-fg-2">
                                {[a.businessName, loginName(a.connectionId ? conns.get(a.connectionId) : undefined) && `via ${loginName(a.connectionId ? conns.get(a.connectionId) : undefined)}`].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            {a.projectName ? <Badge tone="warn">em {a.projectName}</Badge> : <Badge tone="outline">sem workspace</Badge>}
                          </label>
                        </li>
                      );
                    })}
                </ul>
              </fieldset>
            );
          })}
          {list.some((a) => picked.has(a.id) && a.projectName) && (
            <p className="flex items-start gap-2 rounded-control bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] px-3 py-2.5 text-[13px]">
              <AlertTriangle size={15} aria-hidden className="mt-0.5 shrink-0" />
              As contas de outro workspace mudam para {projectName}: os dashboards de lá deixam de usá-las.
            </p>
          )}
          {data.mock && <p className="text-[12.5px] text-fg-2">Modo de teste: as contas e os números são simulados.</p>}
        </>
      )}

      {error && (
        <p role="alert" className="rounded-control bg-error-soft px-3 py-2 text-[13px] text-error-fg">
          {error}
        </p>
      )}
      {active.length > 0 && list.length > 0 && (
        <ModalActions>
          <ConnectButton provider={provider} next={next} canManage={data.canManage} variant="secondary" label="Conectar outro login" className="max-sm:h-11" />
          <button type="button" onClick={add} disabled={pending || picked.size === 0} className={`${btn.small} max-sm:h-11`}>
            {pending ? "Adicionando…" : picked.size ? `Adicionar ${plural(picked.size, "conta", "contas")}` : "Escolha as contas"}
          </button>
        </ModalActions>
      )}
    </div>
  );
}

export function WorkspaceAccounts({ data, projectId, projectName }: { data: ProjectAccountsData; projectId: string; projectName: string }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<AdAccountDTO | null>(null);
  const [target, setTarget] = useState("");
  const [removing, setRemoving] = useState<AdAccountDTO | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const conns = useMemo(() => new Map(data.connections.map((c) => [c.id, c])), [data.connections]);

  const groups = useMemo(() => {
    const by = new Map<string, AdAccountDTO[]>();
    for (const a of data.accounts) by.set(a.platformId, [...(by.get(a.platformId) ?? []), a]);
    return [...by.entries()]
      .map(([platformId, list]) => ({ platformId, list: list.sort((a, b) => Number(b.isEnabled) - Number(a.isEnabled) || a.name.localeCompare(b.name, "pt-BR")) }))
      .sort((a, b) => PLATFORM_ORDER.indexOf(a.platformId) - PLATFORM_ORDER.indexOf(b.platformId));
  }, [data.accounts]);
  const enabled = data.accounts.filter((a) => a.isEnabled).length;
  const usedHere = new Set(data.accounts.map((a) => a.connectionId).filter(Boolean));
  const logins = [...data.connections].sort((a, b) => Number(usedHere.has(b.id)) - Number(usedHere.has(a.id)));

  const run = (id: string, fn: () => Promise<{ ok: boolean; error?: { message: string } }>, done: string) => {
    setBusy(id);
    start(async () => {
      const r = await fn();
      setBusy(null);
      toast.show(r.ok ? done : (r.error?.message ?? "Não deu certo. Tente de novo."), r.ok ? "ok" : "blocked");
    });
  };

  const addButton = data.canManage && (
    <button type="button" onClick={() => setAdding(true)} className={btn.small}>
      <Plus size={16} aria-hidden /> Adicionar contas
    </button>
  );

  return (
    <div className="space-y-5 lg:space-y-6">
      <PageHeader
        title="Contas"
        text={`${plural(enabled, "conta ligada", "contas ligadas")} em ${projectName}. Os dashboards deste workspace usam só estas contas (até ${plural(data.maxAccountsPerPlatform, "conta", "contas")} de cada plataforma).`}
        actions={addButton || undefined}
      />

      {groups.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-card/60 px-6 py-12 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Plug size={22} aria-hidden />
          </span>
          <h3 className="mt-4 text-[18px] font-semibold">Nenhuma conta neste workspace</h3>
          <p className="mt-1.5 max-w-md text-[14px] text-fg-2">
            {data.canManage ? `Traga as contas de ${projectName} dos seus logins (Meta, Google, GA4, CRM) ou conecte um login novo.` : "Peça a um admin da organização para ligar as contas deste cliente."}
          </p>
          {addButton && <div className="mt-5">{addButton}</div>}
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 2xl:grid-cols-2">
          {groups.map(({ platformId, list }) => {
            const on = list.filter((a) => a.isEnabled).length;
            return (
              <section key={platformId} aria-label={platformName(platformId)} className="rounded-card border border-line bg-card shadow-card">
                <header className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
                  <PlatformIcon id={platformId} size={32} />
                  <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{platformName(platformId)}</h3>
                  <span className={`text-[12.5px] tnum ${on >= data.maxAccountsPerPlatform ? "text-fg" : "text-fg-2"}`}>
                    {on} de {data.maxAccountsPerPlatform} ligadas
                  </span>
                </header>
                <ul className="divide-y divide-line">
                  {list.map((a) => {
                    const st = accountState(a, data.now, data.timeZone);
                    const login = loginName(a.connectionId ? conns.get(a.connectionId) : undefined);
                    const working = pending && busy === a.id;
                    return (
                      <li key={a.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">{a.name}</span>
                          <span className={`flex items-center gap-1 truncate text-[12.5px] ${st.tone === "error" ? "text-error-fg" : "text-fg-2"}`}>
                            {st.tone === "error" && <AlertTriangle size={12} aria-hidden className="shrink-0" />}
                            <span className="truncate">{[st.detail, login && `via ${login}`].filter(Boolean).join(" · ")}</span>
                          </span>
                        </span>
                        <Badge tone={st.tone} className="max-sm:hidden">
                          {working ? "…" : st.label}
                        </Badge>
                        {data.canManage && !a.manual && (
                          <Toggle checked={a.isEnabled} disabled={working || (!a.isEnabled && a.status !== "active")} label={`${a.isEnabled ? "Desligar" : "Ligar"} ${a.name}`} onChange={(v) => run(a.id, () => setAccountActive(a.id, v), v ? `${a.name} ligada.` : `${a.name} desligada.`)} />
                        )}
                        {(data.canSync || data.canManage) && (
                          <Menu>
                            <MenuTrigger aria-label={`Mais ações de ${a.name}`} className={`${btn.icon} ${ring} data-[state=open]:bg-surface-2 data-[state=open]:text-fg`}>
                              <MoreHorizontal size={18} aria-hidden />
                            </MenuTrigger>
                            <MenuContent align="end">
                              {data.canSync && a.isEnabled && !a.manual && (
                                <MenuItem icon={<RefreshCw size={15} />} onSelect={() => run(a.id, () => resyncAccount(a.id), `${a.name}: sincronização pedida.`)}>
                                  Sincronizar agora
                                </MenuItem>
                              )}
                              {data.canManage && data.projects.length > 0 && (
                                <MenuItem
                                  icon={<FolderInput size={15} />}
                                  onSelect={() => {
                                    setTarget(data.projects[0].id);
                                    setMoving(a);
                                  }}
                                >
                                  Mover para outro workspace
                                </MenuItem>
                              )}
                              {data.canManage && (
                                <>
                                  <MenuSeparator />
                                  <MenuItem icon={<Trash2 size={15} />} className="text-error-fg" onSelect={() => setRemoving(a)}>
                                    Remover do VYZ
                                  </MenuItem>
                                </>
                              )}
                            </MenuContent>
                          </Menu>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <section aria-labelledby="h-logins" className="rounded-card border border-line bg-card p-5 shadow-card sm:p-6">
        <SectionHeader
          id="h-logins"
          title="Logins"
          text="As contas chegam pelos logins da organização (um login pode servir vários clientes)."
          action={
            <Link href="/painel/contas" className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-accent underline-offset-4 hover:underline">
              Gerenciar em Conexões <ArrowUpRight size={14} aria-hidden />
            </Link>
          }
        />
        {logins.length ? (
          <ul className="mt-2 divide-y divide-line">
            {logins.map((c) => {
              const st = CONNECTION_STATUS[c.status];
              const here = data.accounts.filter((a) => a.connectionId === c.id).length;
              return (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <PlatformIcon id={c.provider} size={32} className={c.status === "active" ? "" : "opacity-60 grayscale"} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{loginName(c)}</span>
                    <span className="block truncate text-[12.5px] text-fg-2">
                      {PROVIDERS[c.provider].name} · {here ? `${plural(here, "conta", "contas")} aqui` : "nenhuma conta aqui"} · {plural(c.accountsCount, "conta no login", "contas no login")}
                    </span>
                  </span>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {c.status !== "active" && <ConnectButton provider={c.provider} next={projectHref(projectId, "contas")} canManage={data.canManage} connected variant="secondary" compact />}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] text-fg-2">Nenhum login conectado. {data.canManage ? "Use Adicionar contas para conectar o primeiro." : ""}</p>
        )}
      </section>

      <Modal open={adding} onClose={() => setAdding(false)} title={`Adicionar contas a ${projectName}`} wide>
        {adding && (
          <AddAccounts
            data={data}
            projectId={projectId}
            projectName={projectName}
            onDone={(msg) => {
              setAdding(false);
              if (msg) toast.show(msg);
            }}
          />
        )}
      </Modal>

      <Modal open={!!moving} onClose={() => setMoving(null)} title="Mover para outro workspace">
        {moving && (
          <div className="space-y-5">
            <p className="text-[14px] leading-relaxed">
              <strong>{moving.name}</strong> sai de {projectName} e passa a alimentar os dashboards do workspace escolhido. Os dados já importados vão junto.
            </p>
            <Select ariaLabel="Workspace de destino" value={target} onChange={setTarget} options={data.projects.map((p) => ({ value: p.id, label: p.name }))} />
            <ModalActions>
              <button type="button" onClick={() => setMoving(null)} className={`${btn.quiet} max-sm:h-11`}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending || !target}
                onClick={() => {
                  const a = moving;
                  setMoving(null);
                  run(a.id, () => moveAccountToProject(a.id, target), `${a.name} mudou de workspace.`);
                }}
                className={`${btn.small} max-sm:h-11`}
              >
                Mover conta
              </button>
            </ModalActions>
          </div>
        )}
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remover conta do VYZ">
        {removing && (
          <div className="space-y-5">
            <p className="text-[14px] leading-relaxed">
              Remover <strong>{removing.name}</strong>? Ela sai de {projectName} e de todos os dashboards, e os dados já importados dela saem do VYZ. Para só tirar dos dashboards, desligue a conta.
            </p>
            {removing.dashboards.length > 0 && (
              <p className="rounded-control bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] px-3 py-2.5 text-[13px]">Está em: {removing.dashboards.map((d) => d.name).join(", ")}.</p>
            )}
            <ModalActions>
              <button type="button" onClick={() => setRemoving(null)} className={`${btn.quiet} max-sm:h-11`}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const a = removing;
                  setRemoving(null);
                  run(a.id, () => removeAdAccount(a.id), `${a.name} removida.`);
                }}
                className={`${btn.danger} max-sm:h-11`}
              >
                Remover conta
              </button>
            </ModalActions>
          </div>
        )}
      </Modal>
      {toast.node}
    </div>
  );
}
