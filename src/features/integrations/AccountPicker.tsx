"use client";

// Escolha das contas que entram no VYZ, por plataforma conectada. Liga e
// desliga respeitando o limite do plano (no Meta, a BM conta uma vez), salva
// de uma vez (setEnabledAccounts) e mostra a sincronização de cada conta.
// Reaproveitado no onboarding (/comecar): passe onSaved para seguir o fluxo e
// onSelectionChange para o Continuar salvar a escolha que ficou pendente.

import { CircleAlert, CircleCheck, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Switch } from "@/components/ui/controls";
import { btn } from "@/components/ui/styles";
import { resyncAccount, setEnabledAccounts, type EnabledAccountsResult } from "@/server/integrations/actions";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { fitsProject, type BillableRef } from "./limits";
import { PROVIDERS, type ProviderId } from "./providers";
import { accountStatusLabel, syncSummary, type SyncSummary } from "./sync-label";
import type { AdAccountDTO } from "./types";
import { btnSmallOutline } from "./ui";

type AccountPickerProps = {
  provider: ProviderId;
  /** Plataforma das contas quando não é a do login (Meta: Instagram e Página do Facebook, orgânico). */
  platformId?: PlatformId;
  /** Contas vistas pelas conexões desta plataforma (getConnectState). */
  accounts: AdAccountDTO[];
  /** Projetos ativos: cada conta ligada entra em um. */
  projects: { id: string; name: string }[];
  /** Contas da mesma plataforma em cada projeto (plano). */
  maxPerProject: number;
  canManage: boolean;
  canSync?: boolean;
  /** Horário da renderização no servidor (texto igual no servidor e no navegador). */
  now: string;
  timeZone?: string;
  /** Depois de salvar (o onboarding segue para o próximo passo). */
  onSaved?: (result: EnabledAccountsResult) => void;
  saveLabel?: string;
  /** Contas sem conexão podem ser removidas (página de contas). */
  onRemove?: (account: AdAccountDTO) => void;
  /** Avisa a escolha atual (com o que ainda não foi salvo) e como salvá-la. */
  onSelectionChange?: (selection: PickerSelection) => void;
  /** Salva a cada toque no toggle (página de contas): sem botão Salvar no fim da lista. */
  autoSave?: boolean;
};

const norm = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export type PickerSelection = {
  /** Há mudança ainda não salva. */
  dirty: boolean;
  /** Contas ligadas, contando o que ainda não foi salvo. */
  count: number;
  /** Salva a escolha pendente; true se salvou (ou não havia o que salvar). Erros aparecem no próprio seletor. */
  save: () => Promise<boolean>;
};

const ref = (a: AdAccountDTO): BillableRef => ({ platformId: a.platformId, externalId: a.externalId, businessExternalId: a.businessExternalId });

type Group = { key: string; title: string; accounts: AdAccountDTO[] };

function groupsOf(provider: ProviderId, accounts: AdAccountDTO[], platformId?: PlatformId): Group[] {
  // orgânico (Instagram, Página): um grupo só, com o nome da plataforma
  if (platformId && platformId !== PROVIDERS[provider].platformId) return [{ key: platformId, title: PLATFORMS[platformId].name, accounts }];
  const label = PROVIDERS[provider].groupLabel;
  const map = new Map<string, Group>();
  for (const a of accounts) {
    const id = provider === "meta" ? a.businessExternalId : a.managerExternalId;
    const name = provider === "meta" ? a.businessName : a.managerName;
    const key = id ?? "_";
    const title = id ? `${label} · ${name ?? id}` : provider === "meta" ? "Sem Business Manager" : "Contas com acesso direto";
    const group = map.get(key) ?? { key, title, accounts: [] };
    group.accounts.push(a);
    map.set(key, group);
  }
  return [...map.values()];
}

const TONE: Record<SyncSummary["tone"], string> = {
  ok: "border-line text-fg-2",
  running: "border-accent text-accent",
  error: "border-error/60 bg-error-soft text-error-fg",
  idle: "border-dashed border-line text-fg-2",
};

export function SyncBadge({ summary }: { summary: SyncSummary }) {
  return (
    <span title={summary.detail} className={`inline-flex max-w-full items-center gap-1.5 rounded-chip border px-2.5 py-0.5 text-[12px] ${TONE[summary.tone]}`}>
      {summary.tone === "running" && <LoaderCircle size={12} aria-hidden className="shrink-0 animate-spin motion-reduce:animate-none" />}
      {summary.tone === "error" && <CircleAlert size={12} aria-hidden className="shrink-0" />}
      {summary.tone === "ok" && <CircleCheck size={12} aria-hidden className="shrink-0" />}
      <span className="truncate">{summary.label}</span>
    </span>
  );
}

export function AccountPicker({ provider, platformId, accounts, projects, maxPerProject, canManage, canSync = canManage, now, timeZone, onSaved, saveLabel = "Salvar escolha", onRemove, onSelectionChange, autoSave = false }: AccountPickerProps) {
  // conta tocada por último: o aviso de salvando/salvo aparece na linha dela, não no fim da lista
  const [touched, setTouched] = useState<string | null>(null);
  // muitas contas: busca por nome, ID ou Business, e o filtro "só as ligadas"
  const [query, setQuery] = useState("");
  const [onlyOn, setOnlyOn] = useState(false);
  const searchable = accounts.length > 6;
  // Só o que mudou em relação ao banco; depois de salvar, volta a valer o banco.
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [saving, startSave] = useTransition();
  const [syncing, startSync] = useTransition();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // projeto de cada conta: o escolhido agora, o salvo, ou o primeiro (o banco cria um se não houver)
  const [projectDraft, setProjectDraft] = useState<Record<string, string>>({});
  const projectOf = (a: AdAccountDTO) => projectDraft[a.id] ?? a.projectId ?? projects[0]?.id ?? "";
  const isOn = (a: AdAccountDTO) => draft[a.id] ?? a.isEnabled;
  const selected = accounts.filter(isOn);
  const dirty = accounts.some((a) => isOn(a) !== a.isEnabled) || Object.keys(projectDraft).length > 0;
  const groups = useMemo(() => groupsOf(provider, accounts, platformId), [provider, accounts, platformId]);
  const busy = saving || syncing;
  const inProject = (project: string, except?: AdAccountDTO) => selected.filter((s) => s !== except && projectOf(s) === project).map(ref);
  const fitsIn = (a: AdAccountDTO, project: string) => fitsProject(ref(a), inProject(project, a), maxPerProject);
  const blockedByPlan = accounts.some((a) => !isOn(a) && a.connectionId && a.status === "active" && !fitsIn(a, projectOf(a)));
  const overLimit = selected.some((a) => !fitsIn(a, projectOf(a)));

  function setProject(a: AdAccountDTO, project: string) {
    setMessage(null);
    setTouched(a.id);
    setProjectDraft((d) => {
      const next = { ...d, [a.id]: project };
      if (project === (a.projectId ?? projects[0]?.id ?? "")) delete next[a.id];
      return next;
    });
  }

  function toggle(a: AdAccountDTO, on: boolean) {
    setMessage(null);
    setTouched(a.id);
    setDraft((d) => {
      const next = { ...d, [a.id]: on };
      if (on === a.isEnabled) delete next[a.id];
      return next;
    });
  }

  function save(): Promise<boolean> {
    setMessage(null);
    return new Promise((resolve) => startSave(async () => resolve(await persist())));
  }

  async function persist(): Promise<boolean> {
    const assign = Object.fromEntries(selected.filter((a) => projectOf(a)).map((a) => [a.id, projectOf(a)]));
    const res = await setEnabledAccounts(platformId ?? PROVIDERS[provider].platformId, selected.map((a) => a.id), assign);
    if (!res.ok) {
      setMessage({ tone: "error", text: res.error.message });
      // salvando a cada toque: o toggle volta ao que está no banco
      if (autoSave) {
        setDraft({});
        setProjectDraft({});
      }
      return false;
    }
    setDraft({});
    setProjectDraft({});
    const failed = res.data.synced.filter((s) => !s.ok);
    const n = res.data.enabledCount;
    const active = `${n} ${n === 1 ? "conta ativa" : "contas ativas"}`;
    if (failed.length) setMessage({ tone: "error", text: `${active}, mas ${failed.length === 1 ? "uma conta não importou" : `${failed.length} contas não importaram`} os dados: ${failed[0].error}` });
    else if (res.data.synced.length) setMessage({ tone: "ok", text: `Pronto: ${active}. Os últimos 90 dias já estão no VYZ.` });
    else if (res.data.syncing) setMessage({ tone: "ok", text: `Pronto: ${active}. A importação dos últimos 90 dias começou.` });
    else setMessage({ tone: "ok", text: `Pronto: ${active}.` });
    onSaved?.(res.data);
    return true;
  }

  // O pai guarda uma função estável; ela sempre salva a escolha mais recente.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  const count = selected.length;
  // salvar a cada toque: assim que a escolha muda, grava (uma de cada vez)
  useEffect(() => {
    if (autoSave && dirty && !saving) saveRef.current();
  }, [autoSave, dirty, saving]);
  useEffect(() => {
    onSelectionChange?.({ dirty, count, save: () => (dirty ? saveRef.current() : Promise.resolve(true)) });
  }, [onSelectionChange, dirty, count]);

  function resync(a: AdAccountDTO) {
    setMessage(null);
    setSyncingId(a.id);
    startSync(async () => {
      const res = await resyncAccount(a.id);
      setSyncingId(null);
      if (!res.ok) setMessage({ tone: "error", text: `${a.name}: ${res.error.message}` });
      else setMessage({ tone: "ok", text: res.data.syncing ? `${a.name}: sincronização começou.` : `${a.name}: dados dos últimos 7 dias atualizados.` });
    });
  }

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar entre ${accounts.length} contas (nome, ID ou Business)`}
            aria-label="Buscar contas"
            className="h-10 min-w-0 flex-1 rounded-control border border-line bg-field px-3 text-[14px] outline-none focus:border-accent"
          />
          <button type="button" aria-pressed={onlyOn} onClick={() => setOnlyOn((v) => !v)} className={`h-10 rounded-control border px-3 text-[13px] ${onlyOn ? "border-accent bg-accent-soft text-fg" : "border-line text-fg-2 hover:text-fg"}`}>
            Só as ligadas · {selected.length}
          </button>
        </div>
      )}
      {groups.map((g) => {
        const q = norm(query.trim());
        const shown = g.accounts.filter((a) => (!onlyOn || isOn(a)) && (!q || norm(`${a.name} ${a.externalId} ${a.businessName ?? ""}`).includes(q)));
        if (!shown.length) return null;
        return (
        <div key={g.key}>
          <h3 className="mb-2 text-[13px] font-medium text-fg-2">{g.title}</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
            {shown.map((a) => {
              const on = isOn(a);
              const connected = !!a.connectionId;
              const enableable = connected && a.status === "active";
              const fits = on || fitsIn(a, projectOf(a));
              const why = !connected ? "Sem conexão: reconecte o login para ativar." : a.status === "disabled" ? "O login conectado não dá mais acesso a esta conta. Reconecte para atualizar." : a.status !== "active" ? `${accountStatusLabel(a.status)}.` : !fits ? "O projeto já tem o máximo de contas desta plataforma no seu plano." : null;
              const summary = a.isEnabled ? syncSummary(a, now, timeZone) : null;
              const rowSyncing = syncing && syncingId === a.id;
              return (
                <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Switch
                      label={<span className="font-semibold break-words">{a.name}</span>}
                      hint={
                        <span className="tnum">
                          {a.externalId} · {a.currency}
                          {why && !on ? <span className="block text-fg-2">{why}</span> : null}
                        </span>
                      }
                      checked={on}
                      disabled={!canManage || busy || (!on && (!enableable || !fits))}
                      onChange={(v) => toggle(a, v)}
                    />
                    {on && projects.length > 0 && (
                      <label className="mt-2 flex flex-wrap items-center gap-2 pl-[52px] text-[12.5px] text-fg-2">
                        Projeto
                        <select
                          value={projectOf(a)}
                          onChange={(e) => setProject(a, e.target.value)}
                          disabled={!canManage || busy}
                          className="h-8 max-w-[220px] rounded-control border border-line bg-bg px-2 text-[13px] text-fg"
                        >
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {a.dashboards.length > 0 && <p className="mt-1.5 pl-[52px] text-[12.5px] text-fg-2">Em: {a.dashboards.map((d) => d.name).join(", ")}</p>}
                    {autoSave && touched === a.id && (saving || message) && (
                      <p role="status" className={`mt-1.5 pl-[52px] text-[12.5px] ${!saving && message?.tone === "error" ? "text-error-fg" : "text-fg-2"}`}>
                        {saving ? "Salvando…" : message?.text}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 pl-[52px] sm:pl-0">
                    {rowSyncing ? <SyncBadge summary={{ tone: "running", label: "Sincronizando…" }} /> : summary && <SyncBadge summary={summary} />}
                    {canSync && a.isEnabled && connected && (
                      <button type="button" onClick={() => resync(a)} disabled={busy || dirty} className={btnSmallOutline} aria-label={`Sincronizar ${a.name}`}>
                        <RefreshCw size={14} aria-hidden className={rowSyncing ? "animate-spin motion-reduce:animate-none" : ""} />
                        <span className="hidden sm:inline">Sincronizar</span>
                      </button>
                    )}
                    {onRemove && canManage && !connected && (
                      <button
                        type="button"
                        aria-label={`Remover ${a.name}`}
                        onClick={() => onRemove(a)}
                        className="inline-flex size-9 items-center justify-center rounded-control border border-line hover:border-error"
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        );
      })}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px]">
          <p className={`font-semibold ${overLimit ? "text-error-fg" : "text-fg"}`}>
            Até {maxPerProject} {maxPerProject === 1 ? "conta" : "contas"} de {PROVIDERS[provider].name} por projeto
          </p>
          {provider === "meta" && <p className="text-fg-2">Contas da mesma BM contam como uma.</p>}
          {blockedByPlan && canManage && (
            <p className="text-fg-2">
              Para ativar mais, coloque a conta em outro projeto em{" "}
              <Link href="/painel/projetos" className="font-semibold text-accent underline-offset-4 hover:underline">
                Projetos
              </Link>{" "}
              ou mude o plano em{" "}
              <Link href="/painel/plano" className="font-semibold text-accent underline-offset-4 hover:underline">
                Plano
              </Link>
              .
            </p>
          )}
          {!canManage && <p className="text-fg-2">Só administradores escolhem as contas.</p>}
        </div>
        {canManage && !autoSave && (dirty || onSaved) && (
          <div className="flex flex-wrap gap-2">
            {dirty && !saving && (
              <button
                type="button"
                onClick={() => {
                  setDraft({});
                  setProjectDraft({});
                }}
                className={`${btn.ghost} h-9`}
              >
                Desfazer
              </button>
            )}
            <button type="button" onClick={() => void save()} disabled={busy || (!dirty && !onSaved)} className={btn.small}>
              {saving && <LoaderCircle size={15} aria-hidden className="animate-spin motion-reduce:animate-none" />}
              {saving ? "Ativando e importando…" : saveLabel}
            </button>
          </div>
        )}
      </div>

      <p role="status" aria-live="polite" className="min-h-0 text-[13.5px]">
        {saving && <span className="text-fg-2">Ativando as contas e importando os últimos 90 dias. Leva alguns segundos.</span>}
        {!saving && message && (
          <span className={`inline-flex items-start gap-1.5 ${message.tone === "error" ? "text-error-fg" : "text-fg"}`}>
            {message.tone === "error" ? <CircleAlert size={15} aria-hidden className="mt-0.5 shrink-0" /> : <CircleCheck size={15} aria-hidden className="mt-0.5 shrink-0 text-accent" />}
            {message.text}
          </span>
        )}
      </p>
    </div>
  );
}
