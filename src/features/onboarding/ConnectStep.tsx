"use client";

// Passo 3: conectar. Um botão por plataforma (Meta Ads e Google Ads), que leva
// ao login e volta para este mesmo passo, já com "Conectado ✓". Só segue com
// alguma plataforma conectada; sem nenhuma, a saída é "Pular por agora".

import { CircleAlert, CircleCheck, LoaderCircle, PlugZap, X } from "lucide-react";
import { useState } from "react";
import { PendingChip } from "@/components/ui/kit";
import { btn } from "@/components/ui/styles";
import { MOCK_NOTICE } from "@/features/integrations/mock-data";
import { CORE_PROVIDER_IDS, loginThe, PROVIDERS, type ProviderId } from "@/features/integrations/providers";
import type { ConnectResult } from "@/features/integrations/results";
import type { ConnectState } from "@/features/integrations/types";
import type { FlowApi } from "./api";
import { canContinueFromConnect } from "./steps";
import { FlowFooter, STEP_BODY, StepTitle, useStepAction } from "./ui";
import type { StepNav } from "./OnboardingFlow";

function ResultBanner({ result, onClose }: { result: ConnectResult; onClose: () => void }) {
  const ok = result.kind === "connected";
  const name = result.provider ? PROVIDERS[result.provider].name : null;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={`flex items-start gap-3 rounded-card border p-3.5 text-[14px] motion-safe:animate-[fade-in_200ms_var(--ease)_both] ${ok ? "border-accent bg-accent-soft/40" : "border-error/60 bg-error-soft text-error-fg"}`}
    >
      {ok ? <CircleCheck size={18} aria-hidden className="mt-0.5 shrink-0 text-accent" /> : <CircleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />}
      <p className="min-w-0 flex-1">{ok && name ? `${name} conectado ✓` : `${name ? `${name}: ` : ""}${result.message}`}</p>
      <button type="button" onClick={onClose} aria-label="Fechar aviso" className="inline-flex size-7 shrink-0 items-center justify-center rounded-control hover:bg-black/5">
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}

/** O link de login da plataforma (a rota de início confere papel e plano). */
function ConnectLink({ href, provider, connected, canManage }: { href: string; provider: ProviderId; connected: boolean; canManage: boolean }) {
  const [leaving, setLeaving] = useState(false);
  const name = PROVIDERS[provider].name;
  if (!canManage) {
    return (
      <span className={`${btn.small} cursor-not-allowed opacity-50`} aria-disabled="true" title="Só administradores do workspace conectam contas.">
        Conectar {name}
      </span>
    );
  }
  return (
    <a
      href={href}
      onClick={() => setLeaving(true)}
      aria-busy={leaving}
      aria-label={connected ? `Trocar o login do ${name}` : `Conectar ${name}`}
      className={connected ? "inline-flex h-9 items-center gap-1.5 rounded-control px-2 text-[13.5px] font-medium text-fg-2 underline-offset-4 hover:text-fg hover:underline" : btn.small}
    >
      {leaving ? <LoaderCircle size={15} aria-hidden className="animate-spin motion-reduce:animate-none" /> : connected ? null : <PlugZap size={15} aria-hidden />}
      {leaving ? "Abrindo…" : connected ? "Trocar login" : `Conectar ${name}`}
    </a>
  );
}

export function ConnectStep({ state, result, api, nav, showTestBadges }: { state: ConnectState; result: ConnectResult | null; api: FlowApi; nav: StepNav; showTestBadges: boolean }) {
  const [banner, setBanner] = useState(result);
  const action = useStepAction();
  const connected = CORE_PROVIDER_IDS.filter((p) => state.platforms[p].connected);
  const can = canContinueFromConnect(connected);

  return (
    <>
      <div className={STEP_BODY}>
        <StepTitle title="Conecte as contas de anúncio" text="Um login por plataforma, sem copiar ID. O VYZ lê os relatórios e só altera campanhas quando você clica em Aplicar ou liga o automático." />
        {banner && <ResultBanner result={banner} onClose={() => setBanner(null)} />}
        <ul className="space-y-3">
          {CORE_PROVIDER_IDS.map((p) => {
            const s = state.platforms[p];
            const login = s.connections.find((c) => c.status === "active");
            return (
              <li key={p} data-provider={p} className={`flex flex-col gap-3 rounded-card border p-4 sm:flex-row sm:items-center sm:justify-between ${s.connected ? "border-accent/60 bg-accent-soft/30" : "border-line bg-card"}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="title text-[17px] text-fg">{PROVIDERS[p].name}</span>
                    {s.connected ? (
                      <span className="inline-flex items-center gap-1 rounded-chip bg-accent px-2 py-0.5 text-[12px] font-semibold text-on-accent">
                        <CircleCheck size={12} aria-hidden /> Conectado ✓
                      </span>
                    ) : (
                      <span className="rounded-chip border border-line px-2 py-0.5 text-[12px] text-fg-2">Não conectado</span>
                    )}
                    {/* só para a equipe (dev ou ONBOARDING_REPLAY_EMAILS): o cliente nunca vê */}
                    {state.mock && showTestBadges && <PendingChip label="Modo de teste" detail={MOCK_NOTICE[p]} />}
                  </div>
                  <p className="mt-1 text-[13.5px] text-fg-2">{login ? `Login: ${login.userName ?? login.userEmail ?? "conectado"}` : `Entre com ${loginThe(p)}.`}</p>
                </div>
                <div className="shrink-0">
                  <ConnectLink href={api.connectHref(p)} provider={p} connected={s.connected} canManage={state.canManage} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <FlowFooter
        {...nav}
        error={action.error ?? nav.error}
        primaryLabel="Continuar"
        pendingLabel="Abrindo…"
        pending={action.pending}
        disabled={!can}
        hint={can ? undefined : "Conecte pelo menos uma plataforma para seguir, ou pule por agora: o passo fica pendente na Início."}
        onPrimary={() => action.run(() => api.toSetup())}
      />
    </>
  );
}
