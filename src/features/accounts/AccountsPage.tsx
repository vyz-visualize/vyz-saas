"use client";

// Página Contas: um cartão por ferramenta (ícone, situação e um botão), agrupados em
// Mídia paga, Analytics e CRM, e as outras formas (planilha, cadastro pelo ID). O
// detalhe (logins e a escolha das contas) abre num painel da ferramenta. Os
// dados vêm do servidor (getConnectState); as mudanças passam por Server
// Actions, que re-renderizam a página.

import { CircleAlert, CircleCheck, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { PlatformIcon } from "@/components/brand/PlatformIcon";
import { syncSummary } from "@/features/integrations/sync-label";
import { EmptyState, Modal, PageHeader, PendingChip } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { AccountPicker } from "@/features/integrations/AccountPicker";
import { ConnectButton } from "@/features/integrations/ConnectButton";
import { ConnectionCard } from "@/features/integrations/ConnectionCard";
import { MOCK_NOTICE } from "@/features/integrations/mock-data";
import { capitalize, loginVia, noAccount, PROVIDER_CATEGORIES, PROVIDERS, type ProviderId } from "@/features/integrations/providers";
import type { ConnectResult } from "@/features/integrations/results";
import type { AdAccountDTO, ConnectState } from "@/features/integrations/types";
import { btnSmallDanger, btnSmallOutline } from "@/features/integrations/ui";
import { removeAdAccount } from "@/server/integrations/actions";
import { AccountForm } from "./AccountForm";
import { ImportSection } from "./ImportSection";
import { manualIdLabel, MANUAL_PLATFORMS } from "./manual";
import { PLATFORMS, type PlatformId } from "./platforms";

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
  /** Contas alimentadas por planilha (CSV ou Google Sheets). */
  imported: AdAccountDTO[];
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
  // Meta: contas de anúncio, Instagram e Página em abas (o mesmo login traz os três)
  const tabs = [{ id: info.platformId as PlatformId, label: platform.extras?.length ? "Contas de anúncio" : "Contas", accounts: platform.accounts, extra: false }, ...(platform.extras ?? []).map((e) => ({ id: e.platformId, label: PLATFORMS[e.platformId].name, accounts: e.accounts, extra: true }))];
  const [tab, setTab] = useState(tabs[0].id);
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <section aria-label={info.name} className="space-y-5">
      <p className="text-[13.5px] text-fg-2">
        {capitalize(loginVia(provider))}. {info.planRule}
      </p>

      {platform.connections.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-card p-5">
          <p className="font-semibold">Nenhum login conectado</p>
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
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold tracking-wide text-fg-2 uppercase">Logins</h3>
            <ConnectButton provider={provider} next={RETURN_PATH} variant="secondary" label="Conectar outro login" canManage={state.canManage} />
          </div>
          {platform.connections.map((c) => (
            <ConnectionCard key={c.id} connection={c} canManage={state.canManage} next={RETURN_PATH} timeZone={timeZone} />
          ))}
        </div>
      )}

      {platform.connected && (
        <div className="space-y-3">
          {tabs.length > 1 ? (
            <div role="tablist" aria-label="Tipo de conta" className="flex flex-wrap gap-1.5">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`inline-flex h-9 items-center gap-2 rounded-chip border px-3 text-[13px] ${tab === t.id ? "border-accent bg-accent-soft font-semibold text-fg" : "border-line text-fg-2 hover:text-fg"}`}
                >
                  <PlatformIcon id={t.id} size={18} />
                  {t.label}
                  <span className="text-fg-2 tabular-nums">
                    {t.accounts.filter((a) => a.isEnabled).length}/{t.accounts.length}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <h3 className="text-[13px] font-semibold tracking-wide text-fg-2 uppercase">Contas · ligue as que entram no VYZ</h3>
          )}
          {current.accounts.length > 0 ? (
            <AccountPicker
              key={current.id}
              provider={provider}
              platformId={current.extra ? current.id : undefined}
              accounts={current.accounts}
              projects={state.projects}
              maxPerProject={state.limit.maxAccountsPerPlatform}
              canManage={state.canManage}
              canSync={state.canSync}
              autoSave
              now={now}
              timeZone={timeZone}
              onRemove={onRemove}
            />
          ) : (
            <p className="rounded-card border border-dashed border-line p-4 text-[14px] text-fg-2">
              {current.extra ? `Este login não traz ${PLATFORMS[current.id].name}.` : `Este login não enxerga ${noAccount(provider)}. Confira o acesso no ${info.name} e reconecte.`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Situação de uma ferramenta, para o cartão. */
function providerStatus(state: ConnectState, provider: ProviderId, now: string, timeZone: string) {
  const p = state.platforms[provider];
  const all = [...p.accounts, ...(p.extras ?? []).flatMap((e) => e.accounts)];
  const on = all.filter((a) => a.isEnabled);
  const errors = on.filter((a) => syncSummary(a, now, timeZone)?.tone === "error").length;
  return { connected: p.connected, logins: p.connections.length, total: all.length, on: on.length, errors };
}

function ToolCard({ icon, name, text, status, action, onOpen }: { icon: string; name: string; text: string; status?: ReactNode; action: ReactNode; onOpen?: () => void }) {
  return (
    <li className="flex flex-col rounded-card border border-line bg-card p-4 transition-colors hover:border-accent/50">
      <div className="flex items-start gap-3">
        <PlatformIcon id={icon} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-fg">{name}</p>
          <p className="text-[13px] text-fg-2">{text}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-1 items-end justify-between gap-3">
        <div className="min-w-0 text-[12.5px]">{status}</div>
        <div className="flex shrink-0 items-center gap-2">
          {onOpen && (
            <button type="button" onClick={onOpen} className={btnSmallOutline}>
              Gerenciar
            </button>
          )}
          {action}
        </div>
      </div>
    </li>
  );
}

const TOOL_TEXT: Record<string, string> = {
  midia: "Campanhas, investimento e resultados.",
  analytics: "Sessões, conversões e receita do site.",
  crm: "Leads, negócios e vendas.",
};

export function AccountsPage({ state, manual, imported, result, now, timeZone }: AccountsPageProps) {
  const [banner, setBanner] = useState(result);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<AdAccountDTO | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [openProvider, setOpenProvider] = useState<ProviderId | null>(null);
  const [openExtra, setOpenExtra] = useState<"import" | "manual" | null>(null);
  const askRemove = (a: AdAccountDTO) => {
    setRemoveError(null);
    setRemoving(a);
  };

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
        text="Conecte suas ferramentas e ligue as contas que alimentam os dashboards. Cada ferramenta tem o seu cartão: clique em Gerenciar para escolher as contas."
      />

      {banner && <ResultBanner result={banner} onClose={() => setBanner(null)} />}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-line bg-card p-4">
        <UsageBar used={state.limit.billableAccounts} limit={state.limit.accountsQuantity} label="Contas ativas × contratadas" />
        <p className="text-[13px] text-fg-2">
          Só as contas ligadas ocupam o plano.{" "}
          <Link href="/painel/plano" className="font-semibold text-accent underline-offset-4 hover:underline">
            Mudar o plano
          </Link>
        </p>
        {state.mock && <PendingChip label="Modo de teste" detail="Login e dados simulados: nenhuma conta real é acessada." />}
      </div>

      {PROVIDER_CATEGORIES.map((cat) => {
        const providers = state.providers.filter((p) => PROVIDERS[p].category === cat.id);
        if (providers.length === 0) return null;
        return (
          <section key={cat.id} aria-labelledby={`cat-${cat.id}`} className="space-y-3">
            <h2 id={`cat-${cat.id}`} className="title text-[17px]">
              {cat.label}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {providers.map((p) => {
                const st = providerStatus(state, p, now, timeZone);
                const info = PROVIDERS[p];
                return (
                  <ToolCard
                    key={p}
                    icon={p}
                    name={info.name}
                    text={p === "meta" ? "Anúncios, Instagram e Página do Facebook." : TOOL_TEXT[cat.id]}
                    status={
                      st.connected ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-0.5 font-medium text-fg">
                            <CircleCheck size={12} aria-hidden className="text-accent" /> Conectado
                          </span>
                          <span className="text-fg-2 tabular-nums">
                            {st.on} de {st.total} {st.total === 1 ? "conta ligada" : "contas ligadas"}
                          </span>
                          {st.errors > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-chip bg-error/10 px-2 py-0.5 text-error-fg">
                              <CircleAlert size={12} aria-hidden /> {st.errors} com erro
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-fg-2">Não conectado</span>
                      )
                    }
                    onOpen={st.connected ? () => setOpenProvider(p) : undefined}
                    action={st.connected ? null : <ConnectButton provider={p} next={RETURN_PATH} canManage={state.canManage} />}
                  />
                );
              })}
            </ul>
          </section>
        );
      })}

      <section aria-labelledby="cat-outras" className="space-y-3">
        <h2 id="cat-outras" className="title text-[17px]">
          Outras formas de trazer dados
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ToolCard
            icon="planilha"
            name="Planilha"
            text="CSV ou Google Sheets, para plataformas sem conexão direta."
            status={<span className="text-fg-2">{imported.length ? `${imported.length} ${imported.length === 1 ? "planilha" : "planilhas"}` : "Nenhuma planilha"}</span>}
            onOpen={() => setOpenExtra("import")}
            action={null}
          />
          <ToolCard
            icon="manual"
            name="Cadastro pelo ID"
            text="A conta fica aguardando a conexão automática da plataforma."
            status={<span className="text-fg-2">{manual.length ? `${manual.length} ${manual.length === 1 ? "conta" : "contas"}` : "Nenhuma conta"}</span>}
            onOpen={() => setOpenExtra("manual")}
            action={null}
          />
        </ul>
      </section>

      <Modal open={openProvider !== null} onClose={() => setOpenProvider(null)} title={openProvider ? PROVIDERS[openProvider].name : ""} wide>
        {openProvider && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <PlatformIcon id={openProvider} size={36} />
              <p className="text-[13.5px] text-fg-2">Ligue as contas que entram no VYZ. Cada toque já salva.</p>
            </div>
            <ProviderSection provider={openProvider} state={state} now={now} timeZone={timeZone} onRemove={askRemove} />
          </div>
        )}
      </Modal>

      <Modal open={openExtra === "import"} onClose={() => setOpenExtra(null)} title="Planilha" wide>
        {openExtra === "import" && <ImportSection accounts={imported} canManage={state.canManage} now={now} timeZone={timeZone} onRemove={askRemove} />}
      </Modal>

      <Modal open={openExtra === "manual"} onClose={() => setOpenExtra(null)} title="Cadastro pelo ID" wide>
        {openExtra === "manual" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13.5px] text-fg-2">Para as plataformas que ainda não conectam direto.</p>
              {state.canManage && (
                <button type="button" onClick={() => setAdding(true)} className={btn.small}>
                  <Plus size={16} aria-hidden /> Adicionar conta
                </button>
              )}
            </div>
            {manual.length === 0 ? (
              <EmptyState title="Nenhuma conta cadastrada pelo ID" text="Ela aparece nos dashboards com dados de amostra até a conexão chegar." />
            ) : (
              <div className="space-y-5">
                {manualByPlatform.map((p) => (
                  <div key={p}>
                    <h3 className="mb-2 flex items-center gap-2 text-[13px] font-medium text-fg-2">
                      <PlatformIcon id={p} size={18} /> {PLATFORMS[p].name}
                    </h3>
                    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
                      {manual
                        .filter((a) => a.platformId === p)
                        .map((a) => (
                          <li key={a.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-semibold break-words">{a.name}</p>
                              <p className="text-[13px] text-fg-2 tnum">{manualIdLabel(a.fields, a.externalId)}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="rounded-chip border border-dashed border-line px-2.5 py-0.5 text-[12px] text-fg-2">Aguardando conexão</span>
                              {state.canManage && (
                                <button type="button" aria-label={`Remover ${a.name}`} onClick={() => askRemove(a)} className="inline-flex size-9 items-center justify-center rounded-control border border-line hover:border-error">
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
          </div>
        )}
      </Modal>

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
