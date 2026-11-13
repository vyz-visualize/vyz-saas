"use client";

// Página Contas: o resumo (uso do plano, ferramentas conectadas e o que pede atenção), um
// cartão por ferramenta (ícone, situação e um botão), agrupados em Mídia paga, Analytics e
// CRM, e as outras formas (planilha, cadastro pelo ID). O detalhe (logins e a escolha das
// contas) abre num painel da ferramenta. Os dados vêm do servidor (getConnectState); as
// mudanças passam por Server Actions, que re-renderizam a página.

import { CircleAlert, CircleCheck, Plus, PlugZap, ShieldCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { PlatformIcon } from "@/components/brand/PlatformIcon";
import { syncSummary } from "@/features/integrations/sync-label";
import { Badge, EmptyState, Modal, PageHeader, PendingChip, SectionHeader } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { AccountPicker } from "@/features/integrations/AccountPicker";
import { ConnectButton } from "@/features/integrations/ConnectButton";
import { ConnectionCard } from "@/features/integrations/ConnectionCard";
import { MOCK_NOTICE } from "@/features/integrations/mock-data";
import { capitalize, CORE_PROVIDER_IDS, loginVia, noAccount, PROVIDER_CATEGORIES, PROVIDERS, type ProviderId } from "@/features/integrations/providers";
import type { ConnectResult } from "@/features/integrations/results";
import type { AdAccountDTO, ConnectState } from "@/features/integrations/types";
import { btnSmallDanger, btnSmallGhost, btnSmallOutline, errorBox, iconBtnDanger, modalFooter, subhead } from "@/features/integrations/ui";
import { removeAdAccount } from "@/server/integrations/actions";
import { AccountForm } from "./AccountForm";
import { ImportSection } from "./ImportSection";
import { manualIdLabel, MANUAL_PLATFORMS } from "./manual";
import { PLATFORMS, type PlatformId } from "./platforms";

const RETURN_PATH = "/painel/contas";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Uso de um limite do plano: rótulo, "usado/limite" e a barra (amarela a partir de 80%, vermelha acima do limite). */
export function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const over = used > limit;
  return (
    <div className="min-w-[12rem]">
      <p className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="min-w-0 text-fg-2">{label}</span>
        <span className={`shrink-0 font-semibold tnum ${over ? "text-error-fg" : "text-fg"}`}>
          {used}/{limit}
        </span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-brand ${over ? "bg-error" : used / limit >= 0.8 ? "bg-warning" : "bg-accent"}`}
          style={{ width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%` }}
        />
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
  /** Selo "Modo de teste": só em desenvolvimento ou para ONBOARDING_REPLAY_EMAILS (o cliente nunca vê). */
  showTestBadges: boolean;
};

function ResultBanner({ result, onClose }: { result: ConnectResult; onClose: () => void }) {
  const ok = result.kind === "connected";
  const name = result.provider ? PROVIDERS[result.provider].name : null;
  return (
    <div role={ok ? "status" : "alert"} className={`flex items-start gap-3 rounded-card border p-4 text-[14px] leading-snug ${ok ? "border-accent/40 bg-accent-soft text-fg" : "border-error/40 bg-error-soft text-error-fg"}`}>
      {ok ? <CircleCheck size={18} aria-hidden className="mt-px shrink-0 text-accent" /> : <CircleAlert size={18} aria-hidden className="mt-px shrink-0" />}
      <p className="min-w-0 flex-1">
        {!ok && name ? <strong>{name}: </strong> : null}
        {result.message}
      </p>
      <button type="button" onClick={onClose} aria-label="Fechar aviso" className="-my-1.5 -mr-1.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10">
        <X size={16} aria-hidden />
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
  showTestBadges,
}: {
  provider: ProviderId;
  state: ConnectState;
  now: string;
  timeZone: string;
  onRemove: (a: AdAccountDTO) => void;
  showTestBadges: boolean;
}) {
  const info = PROVIDERS[provider];
  const platform = state.platforms[provider];
  // Meta: contas de anúncio, Instagram e Página em abas (o mesmo login traz os três)
  const tabs = [{ id: info.platformId as PlatformId, label: platform.extras?.length ? "Contas de anúncio" : "Contas", accounts: platform.accounts, extra: false }, ...(platform.extras ?? []).map((e) => ({ id: e.platformId, label: PLATFORMS[e.platformId].name, accounts: e.accounts, extra: true }))];
  const [tab, setTab] = useState(tabs[0].id);
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <section aria-label={info.name} className="space-y-6">
      <div className="flex items-start gap-3 rounded-[calc(var(--r-card)-4px)] bg-surface-2 p-3.5">
        <PlatformIcon id={provider} size={36} />
        <div className="min-w-0 text-[13.5px] leading-snug">
          <p className="font-medium text-fg">Ligue as contas que entram no VYZ. Cada toque já salva.</p>
          <p className="mt-0.5 text-fg-2">
            {capitalize(loginVia(provider))}. {info.planRule}
          </p>
        </div>
      </div>

      {platform.connections.length === 0 ? (
        <div className="rounded-card border border-dashed border-line bg-card p-5">
          <p className="font-semibold">Nenhum login conectado</p>
          <ul className="mt-3 space-y-2 text-[13.5px] leading-snug">
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
            {state.mock && showTestBadges && <PendingChip label="Modo de teste" detail={MOCK_NOTICE[provider]} />}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className={subhead}>Logins</h3>
            <ConnectButton provider={provider} next={RETURN_PATH} variant="secondary" label="Conectar outro login" canManage={state.canManage} />
          </div>
          {platform.connections.map((c) => (
            <ConnectionCard key={c.id} connection={c} canManage={state.canManage} next={RETURN_PATH} timeZone={timeZone} showTestBadge={showTestBadges} />
          ))}
        </div>
      )}

      {platform.connected && (
        <div className="space-y-3">
          {tabs.length > 1 ? (
            <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:px-0">
              <div role="tablist" aria-label="Tipo de conta" className="inline-flex gap-1 rounded-[calc(var(--r-control)+4px)] bg-surface-2 p-1">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-control px-3 text-[13px] font-medium whitespace-nowrap outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent ${tab === t.id ? "bg-card text-fg shadow-card" : "text-fg-2 hover:text-fg"}`}
                  >
                    <PlatformIcon id={t.id} size={18} />
                    {t.label}
                    <span className="font-normal text-fg-2 tnum">
                      {t.accounts.filter((a) => a.isEnabled).length}/{t.accounts.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <h3 className={subhead}>Contas · ligue as que entram no VYZ</h3>
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
            <p className="rounded-card border border-dashed border-line p-4 text-[14px] leading-snug text-fg-2">
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
  // logins que pararam (expirado, revogado, com erro): pedem reconexão mesmo com outro login no ar
  const brokenLogins = p.connections.filter((c) => c.status !== "active").length;
  return { connected: p.connected, logins: p.connections.length, brokenLogins, total: all.length, on: on.length, errors };
}

/** Cartão de uma ferramenta: o que ela traz, a situação e uma ação. */
function ToolCard({ icon, name, text, badge, status, action, onOpen, attention = false }: { icon: string; name: string; text: string; badge?: ReactNode; status?: ReactNode; action?: ReactNode; onOpen?: () => void; attention?: boolean }) {
  return (
    <li className={`flex flex-col rounded-card border bg-card p-4 transition-colors duration-150 sm:p-5 ${attention ? "border-error/40" : "border-line hover:border-fg-2/40"}`}>
      <div className="flex items-start gap-3">
        <PlatformIcon id={icon} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[15px] leading-snug font-semibold text-fg">{name}</p>
            {badge}
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-fg-2">{text}</p>
        </div>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div className="min-w-0 flex-1 pb-2 text-[12.5px] leading-snug">{status}</div>
        <div className="flex shrink-0 items-center gap-2">
          {onOpen && (
            <button type="button" onClick={onOpen} aria-label={`Gerenciar ${name}`} className={btnSmallOutline}>
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

const toolGrid = "grid gap-3 @xl:grid-cols-2 @xl:gap-4 @5xl:grid-cols-3";

export function AccountsPage({ state, manual, imported, result, now, timeZone, showTestBadges }: AccountsPageProps) {
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
  const statuses = state.providers.map((p) => ({ provider: p, ...providerStatus(state, p, now, timeZone) }));
  const connectedTools = statuses.filter((s) => s.connected).length;
  // o que pede atenção: contas ligadas com a sincronização falhando e logins que pararam
  const troubled = statuses.filter((s) => s.errors > 0 || s.brokenLogins > 0);
  const syncErrors = troubled.reduce((n, s) => n + s.errors, 0);
  const brokenLogins = troubled.reduce((n, s) => n + s.brokenLogins, 0);
  const nothingConnected = connectedTools === 0 && statuses.every((s) => s.logins === 0);

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
    <div className="@container space-y-6 lg:space-y-8">
      <PageHeader
        title="Conexões"
        text="Os logins da organização e todas as contas que eles enxergam. Cada conta entra num workspace (cliente): em Gerenciar, escolha as contas e o workspace de cada uma. Dentro de cada workspace, a aba Contas mostra só as dele."
      />

      {banner && <ResultBanner result={banner} onClose={() => setBanner(null)} />}

      <section aria-label="Resumo das conexões" className="grid gap-px overflow-hidden rounded-card border border-line bg-line shadow-card @3xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="bg-card p-4 sm:p-5">
          <UsageBar used={state.limit.billableAccounts} limit={state.limit.accountsQuantity} label="Contas ativas × contratadas" />
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12.5px] leading-snug text-fg-2">
            <span>
              Só as contas ligadas ocupam o plano.{" "}
              <Link href="/painel/plano" className="font-semibold text-accent underline-offset-4 hover:underline">
                Mudar o plano
              </Link>
            </span>
            {state.mock && showTestBadges && <PendingChip label="Modo de teste" detail="Login e dados simulados: nenhuma conta real é acessada." />}
          </p>
        </div>
        <div className="bg-card p-4 sm:p-5">
          <p className="text-[12.5px] font-medium text-fg-2">Ferramentas conectadas</p>
          <p className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-[26px] leading-none font-bold tracking-[-0.03em] tnum">{connectedTools}</span>
            <span className="text-[13px] text-fg-2 tnum">de {state.providers.length}</span>
          </p>
          <p className="mt-2 text-[12.5px] leading-snug text-fg-2">{connectedTools ? "Cada uma traz as contas do login conectado." : "Nenhuma por enquanto."}</p>
        </div>
        <div className="bg-card p-4 sm:p-5">
          {troubled.length > 0 ? (
            <div className="flex h-full items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-error-soft text-error-fg">
                <CircleAlert size={17} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] leading-snug font-semibold">Precisa de atenção</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-fg-2">
                  {[syncErrors > 0 && `${plural(syncErrors, "conta", "contas")} com a sincronização falhando`, brokenLogins > 0 && `${plural(brokenLogins, "login parou", "logins pararam")} de funcionar`].filter(Boolean).join(" e ")}.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {troubled.map((s) => (
                    <button key={s.provider} type="button" onClick={() => setOpenProvider(s.provider)} className={`${btnSmallOutline} h-8 px-3 text-[12.5px]`}>
                      Ver {PROVIDERS[s.provider].name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : nothingConnected ? (
            <div className="flex h-full items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <PlugZap size={17} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] leading-snug font-semibold">Comece por aqui</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-fg-2">Conecte o Meta Ads ou o Google Ads: um login, sem copiar ID. Depois é só ligar as contas.</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-start gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <CircleCheck size={17} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] leading-snug font-semibold">Tudo certo</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-fg-2">Os logins estão no ar e as contas ligadas sincronizam sem erro.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {PROVIDER_CATEGORIES.map((cat) => {
        const tools = statuses.filter((s) => PROVIDERS[s.provider].category === cat.id);
        if (tools.length === 0) return null;
        return (
          <section key={cat.id} aria-labelledby={`cat-${cat.id}`} className="space-y-3.5">
            <SectionHeader id={`cat-${cat.id}`} title={cat.label} text={cat.text} />
            <ul className={toolGrid}>
              {tools.map((st) => {
                const p = st.provider;
                const info = PROVIDERS[p];
                // login parado sem nenhum outro no ar: a ferramenta está fora, mas o painel dela ainda abre (lá está o login para reconectar)
                const stopped = !st.connected && st.logins > 0;
                return (
                  <ToolCard
                    key={p}
                    icon={p}
                    name={info.name}
                    text={p === "meta" ? "Anúncios, Instagram e Página do Facebook." : TOOL_TEXT[cat.id]}
                    attention={st.errors > 0 || st.brokenLogins > 0}
                    badge={
                      st.connected ? (
                        <Badge tone="ok">
                          <CircleCheck size={12} aria-hidden className="text-accent" /> Conectado
                        </Badge>
                      ) : stopped ? (
                        <Badge tone="error">
                          <CircleAlert size={12} aria-hidden /> Login parado
                        </Badge>
                      ) : null
                    }
                    status={
                      st.connected ? (
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-fg-2 tnum">
                            {st.on} de {st.total} {st.total === 1 ? "conta ligada" : "contas ligadas"}
                          </span>
                          {st.errors > 0 && (
                            <Badge tone="error">
                              <CircleAlert size={12} aria-hidden /> {st.errors} com erro
                            </Badge>
                          )}
                          {st.brokenLogins > 0 && (
                            <Badge tone="error">
                              <CircleAlert size={12} aria-hidden /> {plural(st.brokenLogins, "login parado", "logins parados")}
                            </Badge>
                          )}
                        </span>
                      ) : stopped ? (
                        <span className="text-fg-2">Reconecte para voltar a sincronizar.</span>
                      ) : (
                        <span className="text-fg-2">Não conectado</span>
                      )
                    }
                    onOpen={st.connected || stopped ? () => setOpenProvider(p) : undefined}
                    action={
                      st.connected ? null : stopped ? (
                        <ConnectButton provider={p} next={RETURN_PATH} canManage={state.canManage} connected />
                      ) : (
                        // na conta nova, os dois logins principais puxam o olho; o resto fica em contorno
                        <ConnectButton provider={p} next={RETURN_PATH} canManage={state.canManage} compact variant={nothingConnected && (CORE_PROVIDER_IDS as readonly string[]).includes(p) ? "primary" : "secondary"} />
                      )
                    }
                  />
                );
              })}
            </ul>
          </section>
        );
      })}

      <section aria-labelledby="cat-outras" className="space-y-3.5">
        <SectionHeader id="cat-outras" title="Outras formas de trazer dados" text="Para as plataformas que ainda não conectam direto." />
        <ul className={toolGrid}>
          <ToolCard
            icon="planilha"
            name="Planilha"
            text="CSV ou Google Sheets, para plataformas sem conexão direta."
            status={<span className="text-fg-2">{imported.length ? plural(imported.length, "planilha", "planilhas") : "Nenhuma planilha"}</span>}
            onOpen={() => setOpenExtra("import")}
          />
          <ToolCard
            icon="manual"
            name="Cadastro pelo ID"
            text="A conta fica aguardando a conexão automática da plataforma."
            status={<span className="text-fg-2">{manual.length ? plural(manual.length, "conta", "contas") : "Nenhuma conta"}</span>}
            onOpen={() => setOpenExtra("manual")}
          />
        </ul>
      </section>

      <Modal open={openProvider !== null} onClose={() => setOpenProvider(null)} title={openProvider ? PROVIDERS[openProvider].name : ""} wide>
        {openProvider && <ProviderSection provider={openProvider} state={state} now={now} timeZone={timeZone} onRemove={askRemove} showTestBadges={showTestBadges} />}
      </Modal>

      <Modal open={openExtra === "import"} onClose={() => setOpenExtra(null)} title="Planilha" wide>
        {openExtra === "import" && <ImportSection accounts={imported} canManage={state.canManage} now={now} timeZone={timeZone} onRemove={askRemove} />}
      </Modal>

      <Modal open={openExtra === "manual"} onClose={() => setOpenExtra(null)} title="Cadastro pelo ID" wide>
        {openExtra === "manual" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13.5px] leading-snug text-fg-2">Para as plataformas que ainda não conectam direto. A conta entra com dados de amostra até a conexão chegar.</p>
              {state.canManage && (
                <button type="button" onClick={() => setAdding(true)} className={`${btn.small} shrink-0`}>
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
                    <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-medium text-fg-2">
                      <PlatformIcon id={p} size={18} /> {PLATFORMS[p].name}
                    </h3>
                    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
                      {manual
                        .filter((a) => a.platformId === p)
                        .map((a) => (
                          <li key={a.id} className="flex items-center gap-3 px-4 py-3.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] leading-snug font-semibold break-words">{a.name}</p>
                              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-fg-2">
                                <span className="tnum">{manualIdLabel(a.fields, a.externalId)}</span>
                                <Badge tone="dashed">Aguardando conexão</Badge>
                              </p>
                            </div>
                            {state.canManage && (
                              <button type="button" aria-label={`Remover ${a.name}`} title="Remover" onClick={() => askRemove(a)} className={iconBtnDanger}>
                                <Trash2 size={15} aria-hidden />
                              </button>
                            )}
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
          <div className="space-y-4 text-[14px] leading-relaxed">
            <p>
              Remover <strong>{removing.name}</strong>?
            </p>
            {removing.dashboards.length > 0 ? (
              <p className="rounded-control border border-warning/50 bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] px-3 py-2.5 text-[13.5px]">
                Esta conta está em: {removing.dashboards.map((d) => d.name).join(", ")}. Esses dashboards continuam abrindo, mas ficam sem ela.
              </p>
            ) : (
              <p className="text-fg-2">Ela não está em nenhum dashboard.</p>
            )}
            {!removing.manual && <p className="text-fg-2">Os dados já importados desta conta também saem do VYZ.</p>}
            {removeError && (
              <p role="alert" className={errorBox}>
                {removeError}
              </p>
            )}
            <div className={modalFooter}>
              <button type="button" className={btnSmallGhost} onClick={() => setRemoving(null)} disabled={pending}>
                Cancelar
              </button>
              <button type="button" className={btnSmallDanger} onClick={confirmRemove} disabled={pending}>
                {pending ? "Removendo…" : "Remover"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
