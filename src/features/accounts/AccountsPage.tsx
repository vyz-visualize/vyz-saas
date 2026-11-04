"use client";

// Página Contas: logins conectados (Meta Ads, Google Ads) com a escolha das
// contas que entram no VYZ, e o cadastro pelo ID das outras plataformas. Os
// dados vêm do servidor (getConnectState); as mudanças passam por Server
// Actions, que re-renderizam a página.

import { CircleAlert, CircleCheck, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { EmptyState, Modal, PageHeader, PendingChip } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { AccountPicker } from "@/features/integrations/AccountPicker";
import { ConnectButton } from "@/features/integrations/ConnectButton";
import { ConnectionCard } from "@/features/integrations/ConnectionCard";
import { MOCK_NOTICE } from "@/features/integrations/mock-data";
import { PROVIDER_IDS, PROVIDERS, type ProviderId } from "@/features/integrations/providers";
import type { ConnectResult } from "@/features/integrations/results";
import type { AdAccountDTO, ConnectState } from "@/features/integrations/types";
import { btnSmallDanger } from "@/features/integrations/ui";
import { removeAdAccount } from "@/server/integrations/actions";
import { AccountForm } from "./AccountForm";
import { manualIdLabel, MANUAL_PLATFORMS } from "./manual";
import { PLATFORMS } from "./platforms";

const RETURN_PATH = "/painel/contas";

export function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const over = used > limit;
  return (
    <div className="min-w-[12rem]">
      <p className="flex justify-between gap-3 text-[13px]">
        <span className="text-fg-2">{label}</span>
        <span className={`font-semibold tnum ${over ? "text-error-fg" : "text-fg"}`}>
          {used}/{limit}
        </span>
      </p>
      <div className="mt-1.5 h-2 rounded-full bg-line">
        <div className={`h-full rounded-full ${over ? "bg-error" : used / limit >= 0.8 ? "bg-warning" : "bg-accent"}`} style={{ width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%` }} />
      </div>
    </div>
  );
}

type AccountsPageProps = {
  state: ConnectState;
  /** Contas cadastradas pelo ID. */
  manual: AdAccountDTO[];
  /** Volta do login (?conectado= / ?erro=). */
  result: ConnectResult | null;
  /** Horário da renderização no servidor. */
  now: string;
  timeZone: string;
};

function ResultBanner({ result, onClose }: { result: ConnectResult; onClose: () => void }) {
  const ok = result.kind === "connected";
  const name = result.provider ? PROVIDERS[result.provider].name : null;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={`flex items-start gap-3 rounded-card border p-4 text-[14px] ${ok ? "border-accent bg-accent-soft/40" : "border-error/60 bg-error-soft text-error-fg"}`}
    >
      {ok ? <CircleCheck size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" /> : <CircleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />}
      <p className="min-w-0 flex-1">
        {!ok && name ? <strong>{name}: </strong> : null}
        {result.message}
      </p>
      <button type="button" onClick={onClose} aria-label="Fechar aviso" className="inline-flex size-7 shrink-0 items-center justify-center rounded-control hover:bg-black/5">
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}

function ProviderSection({
  provider,
  state,
  now,
  timeZone,
  onRemove,
}: {
  provider: ProviderId;
  state: ConnectState;
  now: string;
  timeZone: string;
  onRemove: (a: AdAccountDTO) => void;
}) {
  const info = PROVIDERS[provider];
  const platform = state.platforms[provider];

  return (
    <section aria-labelledby={`pl-${provider}`} className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`pl-${provider}`} className="title text-lg">
            {info.name}
          </h2>
          <p className="text-[13.5px] text-fg-2">
            Pelo {info.loginName}.{provider === "meta" ? " Cada Business Manager conta como 1 conta do plano." : " Cada conta de anúncio conta como 1 conta do plano."}
          </p>
        </div>
        {platform.connections.length > 0 && <ConnectButton provider={provider} next={RETURN_PATH} variant="secondary" label="Conectar outro login" canManage={state.canManage} />}
      </div>

      {platform.connections.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-card p-5">
          <p className="font-semibold">Nenhum login conectado</p>
          <p className="mt-1 max-w-xl text-[14px] text-fg-2">
            Conecte para o VYZ encontrar as contas e importar campanhas e métricas. Você escolhe depois quais contas entram.
          </p>
          <ul className="mt-3 space-y-1.5 text-[13.5px]">
            {info.permissions.map((p) => (
              <li key={p.scope} className="flex items-start gap-2">
                <ShieldCheck size={15} aria-hidden className="mt-0.5 shrink-0 text-accent" />
                <span>
                  {p.label} <span className="text-fg-2">· {p.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ConnectButton provider={provider} next={RETURN_PATH} canManage={state.canManage} />
            {state.mock && <PendingChip label="Modo de teste" detail={MOCK_NOTICE[provider]} />}
            {!state.canManage && <span className="text-[12.5px] text-fg-2">Só administradores do workspace conectam contas.</span>}
          </div>
        </div>
      ) : (
        platform.connections.map((c) => <ConnectionCard key={c.id} connection={c} canManage={state.canManage} next={RETURN_PATH} timeZone={timeZone} />)
      )}

      {platform.accounts.length > 0 ? (
        <AccountPicker
          provider={provider}
          accounts={platform.accounts}
          projects={state.projects}
          maxPerProject={state.limit.maxAccountsPerPlatform}
          canManage={state.canManage}
          canSync={state.canSync}
          now={now}
          timeZone={timeZone}
          onRemove={onRemove}
        />
      ) : (
        platform.connected && <p className="text-[14px] text-fg-2">Este login não enxerga nenhuma conta de anúncio. Confira o acesso no {info.name} e reconecte.</p>
      )}
    </section>
  );
}

export function AccountsPage({ state, manual, result, now, timeZone }: AccountsPageProps) {
  const [banner, setBanner] = useState(result);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<AdAccountDTO | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // O aviso fica na tela; a URL perde o ?conectado= / ?erro= (recarregar não repete o aviso).
  useEffect(() => {
    if (result) window.history.replaceState(null, "", RETURN_PATH);
  }, [result]);

  const manualByPlatform = MANUAL_PLATFORMS.filter((p) => manual.some((a) => a.platformId === p));

  function confirmRemove() {
    if (!removing) return;
    setRemoveError(null);
    start(async () => {
      const res = await removeAdAccount(removing.id);
      if (res.ok) setRemoving(null);
      else setRemoveError(res.error.message);
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Contas"
        title="Contas e conexões"
        text="Conecte o Meta Ads e o Google Ads e escolha quais contas entram no VYZ. As outras plataformas entram pelo ID."
      />

      {banner && <ResultBanner result={banner} onClose={() => setBanner(null)} />}

      <div className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-card p-4">
        <UsageBar used={state.limit.billableAccounts} limit={state.limit.accountsQuantity} label="Contas ativas × contratadas" />
        <p className="text-[13px] text-fg-2">
          Só as contas ativas ocupam o plano.{" "}
          <Link href="/painel/plano" className="font-semibold text-accent underline-offset-4 hover:underline">
            Mudar as contas contratadas
          </Link>
        </p>
        {state.mock && <PendingChip label="Modo de teste" detail="Login e dados simulados: nenhuma conta real do Meta ou do Google é acessada. A conexão real depende das credenciais e da aprovação dos apps nas duas plataformas." />}
      </div>

      {PROVIDER_IDS.map((p) => (
        <ProviderSection
          key={p}
          provider={p}
          state={state}
          now={now}
          timeZone={timeZone}
          onRemove={(a) => {
            setRemoveError(null);
            setRemoving(a);
          }}
        />
      ))}

      <section aria-labelledby="pl-manual" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="pl-manual" className="title text-lg">
              Outras plataformas
            </h2>
            <p className="text-[13.5px] text-fg-2">GA4, TikTok, LinkedIn e as demais entram pelo ID e ficam aguardando a conexão automática.</p>
          </div>
          {state.canManage && (
            <button type="button" onClick={() => setAdding(true)} className={btn.small}>
              <Plus size={16} aria-hidden /> Adicionar conta
            </button>
          )}
        </div>

        {manual.length === 0 ? (
          <EmptyState
            title="Nenhuma conta cadastrada pelo ID"
            text="Cadastre a propriedade do GA4, a conta do TikTok Ads ou o CRM do cliente. Elas aparecem nos dashboards com dados de amostra até a conexão chegar."
            action={
              state.canManage ? (
                <button type="button" onClick={() => setAdding(true)} className={btn.small}>
                  <Plus size={16} aria-hidden /> Adicionar conta
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-5">
            {manualByPlatform.map((p) => (
              <div key={p}>
                <h3 className="mb-2 text-[13px] font-medium text-fg-2">{PLATFORMS[p].name}</h3>
                <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
                  {manual
                    .filter((a) => a.platformId === p)
                    .map((a) => (
                      <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-semibold break-words">{a.name}</p>
                          <p className="text-[13px] text-fg-2 tnum">{manualIdLabel(a.fields, a.externalId)}</p>
                          <p className="mt-1 text-[12.5px] text-fg-2">{a.dashboards.length ? `Usada em: ${a.dashboards.map((d) => d.name).join(", ")}` : "Não usada em nenhum dashboard"}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="rounded-chip border border-dashed border-line px-2.5 py-0.5 text-[12px] text-fg-2">Aguardando conexão</span>
                          {state.canManage && (
                            <button
                              type="button"
                              aria-label={`Remover ${a.name}`}
                              onClick={() => {
                                setRemoveError(null);
                                setRemoving(a);
                              }}
                              className="inline-flex size-9 items-center justify-center rounded-control border border-line hover:border-error"
                            >
                              <Trash2 size={15} aria-hidden />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal open={adding} onClose={() => setAdding(false)} title="Adicionar conta pelo ID">
        {adding && <AccountForm onSaved={() => setAdding(false)} onCancel={() => setAdding(false)} />}
      </Modal>

      <Modal open={removing !== null} onClose={() => !pending && setRemoving(null)} title="Remover conta">
        {removing && (
          <div className="space-y-4 text-[14px]">
            <p>
              Remover <strong>{removing.name}</strong>?
            </p>
            {removing.dashboards.length > 0 ? (
              <p className="rounded-control border border-warning/60 bg-warning/10 p-3">
                Esta conta está em: {removing.dashboards.map((d) => d.name).join(", ")}. Esses dashboards continuam abrindo, mas ficam sem ela.
              </p>
            ) : (
              <p className="text-fg-2">Ela não está em nenhum dashboard.</p>
            )}
            {!removing.manual && <p className="text-fg-2">Os dados já importados desta conta também saem do VYZ.</p>}
            {removeError && (
              <p role="alert" className="rounded-control border border-error/60 bg-error-soft p-3 text-error-fg">
                {removeError}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" className={btnSmallDanger} onClick={confirmRemove} disabled={pending}>
                {pending ? "Removendo…" : "Remover"}
              </button>
              <button type="button" className={`${btn.ghost} h-9`} onClick={() => setRemoving(null)} disabled={pending}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
