"use client";

// Onboarding (/comecar): um passo por tela, com o passo a passo no topo. O
// passo vem do banco (a página lê); cada passo grava pelo servidor e volta.

import { LogOut, UserRound } from "lucide-react";
import type { ConnectResult } from "@/features/integrations/results";
import { signOut } from "@/server/auth/actions";
import { BusinessStep } from "./BusinessStep";
import { ConnectStep } from "./ConnectStep";
import { FinishStep } from "./FinishStep";
import { LayoutStep } from "./LayoutStep";
import { StepNav } from "./StepNav";
import type { OnboardingState } from "./types";

type OnboardingFlowProps = {
  state: OnboardingState;
  firstName: string;
  result: ConnectResult | null;
  /** Horário da renderização no servidor. */
  now: string;
  timeZone: string;
};

const FRAME = "mx-auto w-full max-w-[1180px]";

export function OnboardingFlow({ state, firstName, result, now, timeZone }: OnboardingFlowProps) {
  const { step, connect } = state;
  return (
    <div className={FRAME}>
      <StepNav current={step} />
      {/* key: cada passo entra com uma animação curta (sem movimento se o sistema pede). */}
      <div key={step} className="mt-8 motion-safe:animate-[rise_240ms_var(--ease)_both] sm:mt-10">
        {step === "business" && <BusinessStep initial={state.businessTypeId} firstName={firstName} />}
        {step === "platforms" && <LayoutStep businessTypeId={state.businessTypeId} tier={state.tier} />}
        {step === "connect" && connect && <ConnectStep platforms={state.platforms} layoutName={state.layoutName} state={connect} result={result} now={now} timeZone={timeZone} />}
        {step === "finish" && <FinishStep features={state.features ?? []} brand={state.brand} layoutName={state.layoutName} />}
      </div>
    </div>
  );
}

/** Para quem não é admin: o onboarding é do administrador do workspace. */
export function AskAdmin({ workspaceName }: { workspaceName: string }) {
  return (
    <section aria-labelledby="passo-titulo" className="mx-auto mt-10 max-w-xl rounded-[20px] border border-line bg-card p-6 sm:p-8">
      <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-full bg-accent-soft text-fg">
        <UserRound size={22} />
      </span>
      <h1 id="passo-titulo" className="title mt-5 text-[22px] text-fg">
        Peça ao administrador para concluir
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-fg-2">
        O workspace <strong className="font-semibold text-fg">{workspaceName}</strong> ainda está sendo configurado. Quem é administrador escolhe o segmento e o visual, conecta as contas e escolhe os recursos. Assim que terminar, o painel abre para você.
      </p>
      <form action={signOut} className="mt-6">
        <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-control border border-line px-4 text-[14px] font-semibold text-fg hover:border-accent hover:text-accent">
          <LogOut size={16} aria-hidden /> Sair
        </button>
      </form>
    </section>
  );
}

export function OnboardingSkeleton() {
  const block = "animate-pulse rounded-control bg-card motion-reduce:animate-none";
  return (
    <div className={FRAME} aria-busy="true" aria-label="Carregando">
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1 ${block}`} />
        ))}
      </div>
      <div className={`mt-10 h-4 w-28 ${block}`} />
      <div className={`mt-3 h-10 w-96 max-w-full ${block}`} />
      <div className="mt-8 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-card bg-card motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
