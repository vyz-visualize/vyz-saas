"use client";

// Primeiro acesso (/comecar): um passo por vez, num modal com barra de
// progresso e "Pular por agora" em todos os passos (nada bloqueia). O passo vem
// do banco (a página lê); cada passo grava pelo servidor e volta. Ao voltar do
// login da Meta ou do Google, o modal reabre no mesmo passo, com "Conectado ✓".

import { LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ConnectResult } from "@/features/integrations/results";
import { track } from "@/lib/track";
import { signOut } from "@/server/auth/actions";
import { realFlowApi, type FlowApi } from "./api";
import { ConnectStep } from "./ConnectStep";
import { BuildingView, ProjectStep, SetupStep, WelcomeStep } from "./FlowSteps";
import { ACTION_STEPS, actionNumber, ONBOARDING_STEPS, progressOf, STEP_LABEL, stepIndex, type ActiveStep } from "./steps";
import type { OnboardingState } from "./types";
import { useStepAction } from "./ui";

/** O que todo passo recebe para o rodapé: pular e voltar. */
export type StepNav = { onSkip: () => void; skipping: boolean; onBack?: () => void; backing?: boolean; error: string | null };

/** Tempo mínimo da tela "Montando seu dashboard…" antes de abrir o dashboard. */
export const BUILDING_MS = 1800;

const LAST_STEP_KEY = "vyz:onboarding-step";

/**
 * onboarding_step_view a cada passo aberto e onboarding_step_complete quando o
 * passo seguinte abre (o servidor redireciona; a tela só sabe que andou quando o
 * próximo passo aparece). O último passo completa ao montar o dashboard.
 */
function useStepTracking(step: ActiveStep) {
  // o modo estrito do React roda o efeito duas vezes em desenvolvimento: um evento por passo
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (seen.current === step) return;
    seen.current = step;
    let last: string | null = null;
    try {
      last = sessionStorage.getItem(LAST_STEP_KEY);
      sessionStorage.setItem(LAST_STEP_KEY, step);
    } catch {}
    if (last && last !== step && (ONBOARDING_STEPS as readonly string[]).includes(last) && stepIndex(last as ActiveStep) < stepIndex(step)) {
      track("onboarding_step_complete", { step: last });
    }
    track("onboarding_step_view", { step });
  }, [step]);
}

function FlowDialog({ step, building, children }: { step: ActiveStep; building: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  // a cada passo, o foco vai para o campo marcado (data-autofocus) ou para o título; nunca para
  // o primeiro botão (o "Pular por agora") nem para uma dica que abriria sozinha
  useEffect(() => {
    const d = ref.current;
    const raf = requestAnimationFrame(() => (d?.querySelector<HTMLElement>("[data-autofocus]") ?? d?.querySelector<HTMLElement>("#passo-titulo"))?.focus());
    return () => cancelAnimationFrame(raf);
  }, [step, building]);
  const number = actionNumber(step);
  const progress = Math.round(progressOf(building ? "building" : step) * 100);
  const wide = step === "setup" && !building;
  return (
    <dialog
      ref={ref}
      // Esc não fecha: a saída é "Pular por agora" (o modal não some deixando a tela vazia)
      onCancel={(e) => e.preventDefault()}
      aria-labelledby="passo-titulo"
      data-onboarding-step={building ? "building" : step}
      className={`m-auto max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-[20px] border border-line bg-bg p-0 text-fg backdrop:bg-black/55 backdrop:backdrop-blur-[2px] ${wide ? "w-[min(920px,calc(100vw-1.5rem))]" : "w-[min(620px,calc(100vw-1.5rem))]"}`}
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
        <div className="px-5 pt-5 sm:px-7">
          <p className="text-[13px] text-fg-2">
            {building ? (
              "Quase lá"
            ) : number ? (
              <>
                Passo <span className="tnum font-semibold text-fg">{number}</span> de {ACTION_STEPS.length} · {STEP_LABEL[step]}
              </>
            ) : (
              `${STEP_LABEL[step]} · ${ACTION_STEPS.length} passos`
            )}
          </p>
          <div role="progressbar" aria-label="Progresso do primeiro acesso" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-brand motion-reduce:transition-none" style={{ width: `${progress}%` }} />
          </div>
        </div>
        {/* key: cada passo entra com uma animação curta (sem movimento se o sistema pede) */}
        <div key={building ? "building" : step} className="flex min-h-0 flex-1 flex-col overflow-hidden motion-safe:animate-[rise_240ms_var(--ease)_both]">
          {children}
        </div>
      </div>
    </dialog>
  );
}

type OnboardingFlowProps = {
  state: OnboardingState;
  result: ConnectResult | null;
  /** Horário da renderização no servidor. */
  now: string;
  timeZone: string;
  /** Ações do fluxo (padrão: as do servidor; a página de desenvolvimento passa uma imitação). */
  api?: FlowApi;
};

export function OnboardingFlow({ state, result, now, timeZone, api = realFlowApi }: OnboardingFlowProps) {
  const { step } = state;
  const router = useRouter();
  const skip = useStepAction();
  const back = useStepAction();
  const [building, setBuilding] = useState(false);
  useStepTracking(step);

  const at = stepIndex(step);
  const prev = at > 0 ? ONBOARDING_STEPS[at - 1] : null;
  const nav: StepNav = {
    onSkip: () => {
      track("onboarding_skip", { step });
      skip.run(() => api.skip(step));
    },
    skipping: skip.pending,
    onBack: prev ? () => back.run(() => api.back(prev)) : undefined,
    backing: back.pending,
    error: skip.error ?? back.error,
  };

  function onBuilt(id: string) {
    track("onboarding_step_complete", { step: "setup" });
    try {
      sessionStorage.removeItem(LAST_STEP_KEY);
    } catch {}
    setBuilding(true);
    window.setTimeout(() => router.push(api.dashboardHref(id)), BUILDING_MS);
  }

  return (
    <FlowDialog step={step} building={building}>
      {building ? (
        <BuildingView />
      ) : step === "welcome" ? (
        <WelcomeStep firstName={state.firstName} api={api} nav={nav} />
      ) : step === "project" ? (
        <ProjectStep project={state.project} businessTypeId={state.businessTypeId} api={api} nav={nav} />
      ) : step === "connect" && state.connect ? (
        <ConnectStep state={state.connect} result={result} api={api} nav={nav} showTestBadges={state.showTestBadges} />
      ) : step === "setup" && state.connect ? (
        <SetupStep state={state.connect} businessTypeId={state.businessTypeId} tier={state.tier} now={now} timeZone={timeZone} api={api} nav={nav} onBuilt={onBuilt} />
      ) : null}
    </FlowDialog>
  );
}

/** Para quem não é admin: o primeiro acesso é do administrador do workspace. */
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
        O workspace <strong className="font-semibold text-fg">{workspaceName}</strong> ainda está sendo configurado. Quem é administrador cria o primeiro projeto e conecta as contas. Assim que terminar, o painel abre para você.
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
  return (
    <div className="mx-auto w-full max-w-[620px]" aria-busy="true" aria-label="Carregando">
      <div className="mt-10 h-72 animate-pulse rounded-[20px] bg-card motion-reduce:animate-none" />
    </div>
  );
}
