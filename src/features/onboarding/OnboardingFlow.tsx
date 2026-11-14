"use client";

// Primeiro acesso (/comecar): um passo por vez, num modal com barra de
// progresso e "Pular por agora" em todos os passos (nada bloqueia). O passo vem
// do banco (a página lê); cada passo grava pelo servidor e volta. Ao voltar do
// login da Meta ou do Google, o modal reabre no mesmo passo, com "Conectado ✓".

import { LogOut, UserRound } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BUSINESS_TYPES, businessType } from "@/features/catalog/business-types";
import { CORE_PROVIDER_IDS, PROVIDERS } from "@/features/integrations/providers";
import type { ConnectResult } from "@/features/integrations/results";
import type { ConnectState } from "@/features/integrations/types";
import { anyDashboardTemplate } from "@/features/templates/live";
import { track } from "@/lib/track";
import { signOut } from "@/server/auth/actions";
import type { ActionResult } from "@/server/supabase/errors";
import { realFlowApi, type FlowApi } from "./api";
import { ConnectStep } from "./ConnectStep";
import { AccountsStep, BuildingView, ModelStep, ProjectStep, WelcomeStep, type MarkedAccount } from "./FlowSteps";
import { StageVisual, type StageInfo } from "./stage/StageVisual";
import { Trail, type TrailSummaries } from "./stage/Trail";
import { useStepTransition } from "./stage/useStepTransition";
import { ONBOARDING_STEPS, stepIndex, type ActiveStep } from "./steps";
import type { OnboardingState } from "./types";
import { LAST_STEP_KEY, NUDGE_SESSION_KEY } from "./guides";
import { STEP_BODY, useStepAction } from "./ui";

/** O que todo passo recebe para o rodapé: pular e voltar. */
export type StepNav = { onSkip: () => void; skipping: boolean; onBack?: () => void; backing?: boolean; error: string | null };

/** Tempo mínimo da tela "Montando seu dashboard…" antes de abrir o dashboard (as 4 etapas aparecem). */
export const BUILDING_MS = 1600;


/**
 * onboarding_step_view a cada passo aberto e onboarding_step_complete quando o
 * passo seguinte abre (o servidor redireciona; a tela só sabe que andou quando o
 * próximo passo aparece). O último passo completa ao montar o dashboard.
 */
/** O servidor demorou mais que isto: o esqueleto do próximo passo entra no lugar do botão girando. */
const SKELETON_AFTER_MS = 150;

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

type FlowScreenProps = {
  step: ActiveStep;
  building: boolean;
  /** O passo ainda vem do servidor: a tela mostra o esqueleto dele. */
  loading?: boolean;
  stage: StageInfo;
  summaries: TrailSummaries;
  transition: ReturnType<typeof useStepTransition>;
  content: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
};

/**
 * A tela do primeiro acesso: cheia, com o palco (a prévia grande do passo) à esquerda e o
 * conteúdo à direita, a trilha dos passos no topo. No celular, o palco vira um banner.
 * É um <dialog> modal: o foco fica dentro, e Esc não fecha (a saída é "Pular por agora").
 */
function FlowScreen({ step, building, loading = false, stage, summaries, transition, content, children }: FlowScreenProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  // ao sair (o fim do primeiro acesso navega para o painel), a tela fica escondida (Activity) em
  // vez de desmontada: o <dialog> modal aberto deixaria o painel inteiro inerte. Fecha ao esconder.
  useLayoutEffect(() => {
    const d = ref.current;
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  // a cada passo, o foco vai para o campo marcado (data-autofocus) ou para o título; nunca para
  // o primeiro botão (o "Pular por agora") nem para uma dica que abriria sozinha
  useEffect(() => {
    const d = ref.current;
    // passo novo começa do topo (no celular a tela rola inteira)
    content.current?.scrollTo({ top: 0 });
    const raf = requestAnimationFrame(() => (d?.querySelector<HTMLElement>("[data-autofocus]") ?? d?.querySelector<HTMLElement>("#passo-titulo"))?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(raf);
  }, [step, building, content]);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => e.preventDefault()}
      aria-labelledby="passo-titulo"
      aria-busy={transition.active || undefined}
      data-onboarding-step={building ? "building" : loading ? `${step}-carregando` : step}
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-bg p-0 text-fg backdrop:bg-bg"
    >
      {/* celular: a tela rola inteira (o banner do palco vai junto) e o rodapé fica preso embaixo;
          desktop: palco e conteúdo lado a lado, cada um com a sua rolagem */}
      <div ref={content} data-flow-scroll className="h-full overflow-y-auto overscroll-contain lg:grid lg:grid-cols-[1.1fr_1fr] lg:overflow-hidden">
        <div className="h-[clamp(160px,26dvh,220px)] lg:h-full">
          <StageVisual info={stage} />
        </div>
        <div className="flex min-h-[calc(100%-clamp(160px,26dvh,220px))] flex-col border-line lg:min-h-0 lg:border-l">
          {/* nas boas-vindas, a jornada 01/02/03 já faz o papel da trilha: ela aparece a partir do passo 01 */}
          {(step !== "welcome" || building) && (
            <div className="px-5 pt-4 sm:px-8 lg:px-10 lg:pt-8">
              <Trail step={step} building={building} summaries={summaries} />
            </div>
          )}
          {/* key: cada passo entra com uma animação curta (sem movimento se o sistema pede) */}
          <div key={building ? "building" : step} className="fa-in flex flex-1 flex-col lg:min-h-0 lg:overflow-hidden">
            {children}
          </div>
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

export function OnboardingFlow({ state, result, now, timeZone, api: baseApi = realFlowApi }: OnboardingFlowProps) {
  const { step } = state;
  const content = useRef<HTMLDivElement>(null);
  const transition = useStepTransition(content);
  const skip = useStepAction();
  const back = useStepAction();
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  // para onde a ação em andamento leva: se o servidor demorar, a tela abre com esse passo em esqueleto
  const [pending, setPending] = useState<ActiveStep | null>(null);
  // o que a pessoa escolhe e o palco mostra: o nome digitado, o segmento e o modelo
  const [typedName, setTypedName] = useState(state.project?.named ? state.project.name : "");
  // o segmento: o salvo ou o primeiro disponível (o mesmo que o passo 1 já mostra marcado)
  const [segmentId, setSegmentId] = useState<string | null>(state.businessTypeId ?? BUSINESS_TYPES.find((b) => b.available)?.id ?? null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  // 04 Modelo: só da tela (o banco grava Contas e Modelo como o mesmo passo); recarregar volta para Contas
  const [onModel, setOnModel] = useState(false);
  // quantas contas a pessoa marcou nas Contas (o resumo da trilha não espera o servidor)
  const [marked, setMarked] = useState<number | null>(null);
  // as contas marcadas agora (o palco das Contas mostra os cartões delas)
  const [markedAccounts, setMarkedAccounts] = useState<MarkedAccount[]>([]);
  const shown: ActiveStep = step === "setup" && onModel ? "model" : step;
  useStepTracking(shown);

  // o próximo passo chegou (ou a montagem começou): a tela abre
  const { settle, swap } = transition;
  // o servidor demorou: o esqueleto do próximo passo entra (a tela nunca fica parada com o botão girando)
  const [slow, setSlow] = useState(false);
  const [lastDir, setLastDir] = useState<1 | -1>(1);

  // cada ação que troca de passo passa pela transição; a ação roda junto, sem esperar a animação
  const { begin } = transition;
  const api = useMemo<FlowApi>(() => {
    const wrap =
      <A extends unknown[], R>(fn: (...a: A) => Promise<ActionResult<R>>, dir: 1 | -1, target: (...a: A) => ActiveStep) =>
      async (...a: A) => {
        setPending(target(...a));
        setSlow(false);
        setLastDir(dir);
        begin(dir);
        const timer = window.setTimeout(() => setSlow(true), SKELETON_AFTER_MS);
        const r = await fn(...a);
        if (r && !r.ok) {
          // falhou: abre o mesmo passo, com o erro
          window.clearTimeout(timer);
          setPending(null);
          setSlow(false);
          settle();
        }
        return r;
      };
    return {
      ...baseApi,
      start: wrap(baseApi.start, 1, () => "project"),
      saveProject: wrap(baseApi.saveProject, 1, () => "connect"),
      toSetup: wrap(baseApi.toSetup, 1, () => "setup"),
      back: wrap(baseApi.back, -1, (to) => to),
    };
  }, [baseApi, begin, settle]);
  // (o timer de cada ação é limpo na falha; no sucesso, o passo novo chega e o esqueleto some sozinho)

  const at = stepIndex(shown);
  const prev = at > 0 ? ONBOARDING_STEPS[at - 1] : null;
  // Contas ↔ Modelo trocam só na tela; o resto passa pelo servidor
  const toModel = (enabled: number) => {
    setMarked(enabled);
    setLastDir(1);
    begin(1);
    setOnModel(true);
  };
  const backToAccounts = () => {
    setLastDir(-1);
    begin(-1);
    setOnModel(false);
  };
  const nav: StepNav = {
    onSkip: () => {
      track("onboarding_skip", { step });
      try {
        sessionStorage.setItem(NUDGE_SESSION_KEY, "1");
      } catch {}
      skip.run(() => api.skip(step));
    },
    skipping: skip.pending,
    onBack: shown === "model" ? backToAccounts : prev ? () => back.run(() => api.back(prev)) : undefined,
    backing: back.pending,
    error: skip.error ?? back.error ?? buildError,
  };

  /**
   * A tela "Montando" aparece já no clique (pelo mascote) e fica pelo menos BUILDING_MS,
   * enquanto o servidor cria o dashboard (fase 1). Depois, a fase 2 conclui e abre.
   */
  async function onBuild(id: string) {
    setBuildError(null);
    begin(1);
    setBuilding(true);
    const started = Date.now();
    const res = await api.build(id);
    if (!res.ok) {
      begin(-1);
      setBuilding(false);
      setBuildError(res.error.message);
      return;
    }
    await new Promise((r) => window.setTimeout(r, Math.max(0, BUILDING_MS - (Date.now() - started))));
    track("onboarding_step_complete", { step: "model" });
    try {
      sessionStorage.removeItem(LAST_STEP_KEY);
      // o lembrete de conexão não aparece na mesma sessão do primeiro acesso: só na próxima visita
      sessionStorage.setItem(NUDGE_SESSION_KEY, "1");
    } catch {}
    const done = await api.finish(res.data.id);
    if (done && !done.ok) {
      begin(-1);
      setBuilding(false);
      setBuildError(done.error.message);
    }
  }

  // o passo que a tela mostra: o do servidor ou, enquanto ele não chega, o esqueleto do próximo
  const waiting = !!pending && pending !== step && !building && slow;
  const view = waiting ? pending : shown;
  // cada troca do que está na tela (passo, esqueleto, montando) entra por cima da anterior, antes de pintar
  const shownKey = building ? "building" : waiting ? `espera-${pending}` : shown;
  useLayoutEffect(() => {
    swap();
    // o esqueleto também vira imagem: quando o passo de verdade chegar, ele entra por cima
    if (shownKey.startsWith("espera-")) begin(lastDir);
    // a direção só importa no momento da troca
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownKey, swap, begin]);
  const connect = state.connect;
  const connected = connect ? CORE_PROVIDER_IDS.filter((p) => connect.platforms[p].connected) : [];
  const projectName = step === "welcome" ? "" : step === "project" ? typedName : (state.project?.name ?? typedName);
  const client = projectName.trim() || "Seu cliente";
  const segment = businessType(segmentId)?.name ?? null;
  const summaries: TrailSummaries = {
    project: state.project?.name ? `${state.project.name}${businessType(state.businessTypeId)?.name ? ` · ${businessType(state.businessTypeId)?.name}` : ""}` : undefined,
    connect: connect && connected.length ? connectSummary(connect, connected) : undefined,
    setup: marked ? `${marked} ${marked === 1 ? "conta" : "contas"} no dashboard` : connect ? enabledSummary(connect) : undefined,
    model: templateId ? anyDashboardTemplate(templateId)?.name : undefined,
  };
  const stage: StageInfo = {
    step: shown,
    building,
    client,
    segment,
    connected,
    justConnected: result?.kind === "connected" && result.provider && isCore(result.provider) ? result.provider : null,
    template: templateId ? (anyDashboardTemplate(templateId) ?? null) : null,
    marked: markedAccounts,
  };

  return (
    <FlowScreen step={view} building={building} loading={waiting} stage={{ ...stage, step: view }} summaries={summaries} transition={transition} content={content}>
      {waiting ? (
        <StepSkeleton />
      ) : building ? (
        <BuildingView />
      ) : step === "welcome" ? (
        <WelcomeStep firstName={state.firstName} api={api} nav={nav} />
      ) : step === "project" ? (
        <ProjectStep project={state.project} businessTypeId={state.businessTypeId} api={api} nav={nav} onNameChange={setTypedName} onSegmentChange={setSegmentId} />
      ) : step === "connect" && state.connect ? (
        <ConnectStep state={state.connect} result={result} api={api} nav={nav} showTestBadges={state.showTestBadges} />
      ) : shown === "model" ? (
        <ModelStep businessTypeId={state.businessTypeId} tier={state.tier} nav={nav} onBuild={onBuild} client={client} suggestion={state.suggestion} templateId={templateId} onTemplateChange={setTemplateId} />
      ) : step === "setup" && state.connect ? (
        <AccountsStep state={state.connect} now={now} timeZone={timeZone} api={api} nav={nav} onContinue={toModel} onMarkedChange={setMarkedAccounts} />
      ) : null}
    </FlowScreen>
  );
}

/** O próximo passo enquanto o servidor responde: título, fala e blocos, sem conteúdo. */
function StepSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando o próximo passo" data-step-skeleton className={STEP_BODY}>
      <span id="passo-titulo" tabIndex={-1} className="block h-9 w-3/4 rounded-control bg-line/70 outline-none" />
      <div className="flex items-start gap-3">
        <span className="size-[46px] shrink-0 rounded-full bg-accent/40" />
        <span className="h-14 flex-1 rounded-[18px] bg-line/50" />
      </div>
      {[0, 1, 2].map((i) => (
        <span key={i} className="block h-20 rounded-card bg-line/40" />
      ))}
    </div>
  );
}

const isCore = (p: string): p is (typeof CORE_PROVIDER_IDS)[number] => (CORE_PROVIDER_IDS as readonly string[]).includes(p);

/** "3 contas no dashboard" (as ativas, de todas as plataformas e extras). */
function enabledSummary(connect: ConnectState): string | undefined {
  const n = CORE_PROVIDER_IDS.reduce((a, p) => {
    const s = connect.platforms[p];
    return a + s.accounts.filter((x) => x.isEnabled).length + (s.extras ?? []).reduce((b, e) => b + e.accounts.filter((x) => x.isEnabled).length, 0);
  }, 0);
  return n ? `${n} ${n === 1 ? "conta" : "contas"} no dashboard` : undefined;
}

/** "Meta Ads ✓ · 2 contas" (as contas que o login trouxe). */
function connectSummary(connect: ConnectState, connected: readonly (typeof CORE_PROVIDER_IDS)[number][]): string {
  const names = connected.map((p) => `${PROVIDERS[p].name} ✓`).join(" · ");
  const n = connected.reduce((a, p) => a + connect.platforms[p].accounts.length, 0);
  return n ? `${names} · ${n} ${n === 1 ? "conta" : "contas"}` : names;
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
        A organização <strong className="font-semibold text-fg">{workspaceName}</strong> ainda está sendo configurada. Quem é administrador cria o primeiro workspace e conecta as contas. Assim que terminar, o painel abre para você.
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
