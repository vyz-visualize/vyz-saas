"use client";

// Passo 3: conectar. Para cada plataforma escolhida, o login (rota de início
// da área de integrações, voltando para /comecar) e, depois, a escolha das
// contas com o limite do plano. Ativar já importa os últimos 90 dias; o
// Continuar salva antes a escolha que ainda não foi salva.

import { CircleAlert, CircleCheck, PlugZap, X } from "lucide-react";
import { useCallback, useState } from "react";
import { PendingChip } from "@/components/ui/kit";
import { AccountPicker, type PickerSelection } from "@/features/integrations/AccountPicker";
import { ConnectButton } from "@/features/integrations/ConnectButton";
import { planUsageLabel } from "@/features/integrations/limits";
import { MOCK_NOTICE } from "@/features/integrations/mock-data";
import { loginThe, PROVIDERS, type ProviderId } from "@/features/integrations/providers";
import type { ConnectResult } from "@/features/integrations/results";
import type { ConnectState } from "@/features/integrations/types";
import { useRouter } from "next/navigation";
import { FINISH_QUERY, FINISH_VALUE } from "./steps";
import { StepFooter, StepHeader, useStepAction } from "./ui";

const RETURN_PATH = "/comecar";

type ConnectStepProps = {
  platforms: ProviderId[];
  layoutName: string | null;
  state: ConnectState;
  result: ConnectResult | null;
  now: string;
  timeZone: string;
};

function ResultBanner({ result, onClose }: { result: ConnectResult; onClose: () => void }) {
  const ok = result.kind === "connected";
  const name = result.provider ? PROVIDERS[result.provider].name : null;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={`flex items-start gap-3 rounded-card border p-4 text-[14px] motion-safe:animate-[fade-in_200ms_var(--ease)_both] ${ok ? "border-accent bg-accent-soft/40" : "border-error/60 bg-error-soft text-error-fg"}`}
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

type PanelProps = {
  provider: ProviderId;
  state: ConnectState;
  now: string;
  timeZone: string;
  onSelection: (provider: ProviderId, selection: PickerSelection) => void;
};

function PlatformPanel({ provider, state, now, timeZone, onSelection }: PanelProps) {
  const p = state.platforms[provider];
  const onSelectionChange = useCallback((s: PickerSelection) => onSelection(provider, s), [onSelection, provider]);
  const info = PROVIDERS[provider];
  const login = p.connections.find((c) => c.status === "active");
  const enabled = p.enabledCount;

  return (
    <section aria-labelledby={`conectar-${provider}`} className="rounded-[20px] border border-line bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`conectar-${provider}`} className="title text-[19px] text-fg">
              {info.name}
            </h2>
            {p.connected ? (
              <span className="inline-flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-fg">
                <CircleCheck size={12} aria-hidden /> Conectado
              </span>
            ) : null}
            {state.mock && <PendingChip label="Modo de teste" detail={MOCK_NOTICE[provider]} />}
          </div>
          <p className="mt-1 text-[13.5px] text-fg-2">
            {login
              ? `Login: ${login.userName ?? login.userEmail ?? "conectado"}${enabled ? ` · ${enabled} ${enabled === 1 ? "conta ativa" : "contas ativas"}` : ""}`
              : `Entre com ${loginThe(provider)}. O VYZ lê os relatórios e só altera campanhas quando você clica em Aplicar ou liga o automático.`}
          </p>
        </div>
        <ConnectButton provider={provider} next={RETURN_PATH} connected={p.connected} canManage={state.canManage} variant={p.connected ? "secondary" : "primary"} className="shrink-0 self-start" />
      </div>

      {p.connected && (
        <div className="mt-5 border-t border-line pt-5">
          {p.accounts.length > 0 ? (
            <>
              <p className="mb-3 text-[14px] text-fg">Escolha as contas que entram no VYZ.</p>
              <AccountPicker
                provider={provider}
                accounts={p.accounts}
                projects={state.projects}
                maxPerProject={state.limit.maxAccountsPerPlatform}
                canManage={state.canManage}
                canSync={state.canSync}
                now={now}
                timeZone={timeZone}
                saveLabel="Ativar e importar"
                onSelectionChange={onSelectionChange}
              />
            </>
          ) : (
            <p className="text-[14px] text-fg-2">O login não devolveu nenhuma conta de anúncio. Confira se ele tem acesso às contas e conecte de novo.</p>
          )}
        </div>
      )}
    </section>
  );
}

export function ConnectStep({ platforms, layoutName, state, result, now, timeZone }: ConnectStepProps) {
  const [banner, setBanner] = useState(result);
  const router = useRouter();
  const { pending, error, run } = useStepAction();
  const skip = useStepAction();
  // Escolha de cada seletor, com o que ainda não foi salvo.
  const [selections, setSelections] = useState<Partial<Record<ProviderId, PickerSelection>>>({});
  const onSelection = useCallback((provider: ProviderId, s: PickerSelection) => setSelections((prev) => ({ ...prev, [provider]: s })), []);
  const pendingSave = platforms.some((p) => selections[p]?.dirty);
  const enabled = platforms.reduce((n, p) => {
    const sel = selections[p];
    return n + (sel?.dirty ? sel.count : state.platforms[p].enabledCount);
  }, 0);

  function onContinue() {
    run(async () => {
      for (const p of platforms) {
        const sel = selections[p];
        if (sel?.dirty && !(await sel.save())) {
          return { ok: false, error: { code: "onboarding:accounts_not_saved", message: `Não deu para salvar as contas do ${PROVIDERS[p].name}. Confira o aviso acima.` } };
        }
      }
      // recursos e marca: o último passo (a URL guarda o passo; recarregar continua nele)
      router.push(`/comecar?${FINISH_QUERY}=${FINISH_VALUE}`);
      return { ok: true, data: undefined };
    });
  }
  const anyConnected = platforms.some((p) => state.platforms[p].connected);

  return (
    <section aria-labelledby="passo-titulo">
      <StepHeader
        eyebrow="Passo 3 de 4 · Conectar"
        title="Conecte as contas de anúncio"
        text={
          <>
            {layoutName ? (
              <>
                Seu dashboard <strong className="font-semibold text-fg">{layoutName}</strong> está pronto.{" "}
              </>
            ) : null}
            Um login por plataforma, sem copiar ID; ative as contas e os últimos 90 dias chegam na hora. Pode pular e conectar depois.{" "}
            <span className="tnum text-fg">{planUsageLabel(state.projects.length, state.limit.accountsQuantity)}</span> em uso.
          </>
        }
      />

      <div className="mt-8 space-y-4">
        {banner && <ResultBanner result={banner} onClose={() => setBanner(null)} />}
        {platforms.length === 0 ? (
          <div className="flex items-start gap-3 rounded-card border border-dashed border-line p-5 text-[14px] text-fg-2">
            <PlugZap size={18} aria-hidden className="mt-0.5 shrink-0" />
            Este layout usa plataformas que ainda não conectam por login. Entre no dashboard: ele mostra o que falta.
          </div>
        ) : (
          platforms.map((p) => <PlatformPanel key={p} provider={p} state={state} now={now} timeZone={timeZone} onSelection={onSelection} />)
        )}
      </div>


      <StepFooter
        back="platforms"
        pending={pending}
        error={error ?? skip.error}
        disabled={skip.pending}
        continueLabel="Continuar"
        pendingLabel={pendingSave ? "Ativando e importando…" : "Abrindo…"}
        onContinue={onContinue}
        aside={
          enabled === 0 && platforms.length > 0 ? (
            <span className="text-[13px] text-fg-2">{anyConnected ? "Nenhuma conta ativa: dá para ativar depois." : "Sem conexão: dá para conectar depois."}</span>
          ) : null
        }
      />
    </section>
  );
}
