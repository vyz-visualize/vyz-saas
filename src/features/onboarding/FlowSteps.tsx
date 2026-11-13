"use client";

// Os passos do primeiro acesso (menos o de conectar, em ConnectStep): boas-
// vindas, projeto, contas, modelo e a tela "Montando seu dashboard…".

import { Check, LoaderCircle, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BUSINESS_TYPES } from "@/features/catalog/business-types";
import type { PickerSelection } from "@/features/integrations/AccountPicker";
import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { CORE_PROVIDER_IDS, PROVIDERS } from "@/features/integrations/providers";
import type { ConnectState } from "@/features/integrations/types";
import type { Tier } from "@/features/pricing/entitlements";
import type { AccountsGroup, FlowApi } from "./api";
import { LayoutCard } from "./LayoutCard";
import type { StepNav } from "./OnboardingFlow";
import { objectiveForBusiness, type ObjectiveId } from "@/features/templates/dashboards/composed";
import { objectiveLabel, type ObjectiveSuggestion } from "./objective";
import { Journey } from "./stage/Journey";
import { accountsSummary, canBuildDashboard, layoutOptionsFor } from "./steps";
import { anyDashboardTemplate } from "@/features/templates/live";
import { FlowFooter, STEP_BODY, StepTitle, useStepAction } from "./ui";

const BODY = STEP_BODY;
const NO_ACCOUNTS = "Ative pelo menos uma conta para montar o dashboard. Ou pule por agora: o passo fica pendente na Início.";

export function WelcomeStep({ firstName, api, nav }: { firstName: string; api: FlowApi; nav: StepNav }) {
  const action = useStepAction();
  return (
    <>
      {/* no desktop, o conteúdo fica no meio da altura (sem vazio entre os cards e o botão) */}
      <div className={`${BODY} lg:flex lg:flex-col lg:justify-center`}>
        <StepTitle
          title={firstName ? `Boas-vindas, ${firstName}.` : "Boas-vindas ao VYZ."}
          text={`Oi${firstName ? `, ${firstName}` : ""}! Eu sou o VYZ. Em 4 passos o seu cliente recebe o mês dele num link.`}
        />
        <Journey />
      </div>
      <FlowFooter {...nav} error={action.error ?? nav.error} primaryLabel="Começar" pendingLabel="Abrindo…" pending={action.pending} onPrimary={() => action.run(() => api.start())} />
    </>
  );
}

type ProjectProps = {
  project: { name: string; named: boolean } | null;
  businessTypeId: string | null;
  api: FlowApi;
  nav: StepNav;
  /** O palco mostra o cartão do cliente enquanto a pessoa digita. */
  onNameChange?: (name: string) => void;
  onSegmentChange?: (id: string) => void;
};

export function ProjectStep({ project, businessTypeId, api, nav, onNameChange, onSegmentChange }: ProjectProps) {
  // só vem preenchido com um nome que alguém deu (nunca o do workspace ou o da pessoa)
  const [name, setNameState] = useState(project?.named ? project.name : "");
  const available = BUSINESS_TYPES.filter((b) => b.available);
  const [segment, setSegmentState] = useState<string>(available.find((b) => b.id === businessTypeId)?.id ?? available[0]?.id ?? "");
  const setName = (v: string) => {
    setNameState(v);
    onNameChange?.(v);
  };
  const setSegment = (v: string) => {
    setSegmentState(v);
    onSegmentChange?.(v);
  };
  const action = useStepAction();
  const submit = () => name.trim() && segment && action.run(() => api.saveProject(name.trim(), segment));
  return (
    <>
      <form
        className={BODY}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <StepTitle title="Qual é o primeiro cliente?" text="Primeiro, me diz quem é o cliente. As contas e os dashboards dele ficam dentro desse projeto." />
        <label className="block">
          <span className="text-[14px] font-medium text-fg">Nome do cliente</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Loja da Ana"
            maxLength={80}
            data-autofocus
            name="projeto"
            className="mt-1.5 h-11 w-full rounded-control border border-line bg-field px-3 text-[15px] outline-none focus:border-accent"
          />
        </label>
        <fieldset>
          <legend className="text-[14px] font-medium text-fg">Segmento</legend>
          <p className="mt-0.5 text-[13px] text-fg-2">O dashboard usa as métricas e o funil do segmento.</p>
          <div role="radiogroup" aria-label="Segmento" className="mt-2 flex flex-wrap gap-2">
            {available.map((b) => (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={segment === b.id}
                onClick={() => setSegment(b.id)}
                className={`rounded-chip px-3 py-1.5 text-[13.5px] transition-colors duration-150 ${segment === b.id ? "bg-accent font-semibold text-on-accent" : "border border-line text-fg-2 hover:text-fg"}`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </fieldset>
      </form>
      <FlowFooter {...nav} error={action.error ?? nav.error} primaryLabel="Continuar" pending={action.pending} disabled={!name.trim() || !segment} onPrimary={submit} />
    </>
  );
}

type AccountsProps = {
  state: ConnectState;
  now: string;
  timeZone: string;
  api: FlowApi;
  nav: StepNav;
  /** Contas salvas: segue para o Modelo (com quantas entram, para o resumo da trilha). */
  onContinue: (enabled: number) => void;
  /** As contas marcadas agora (o palco mostra os cartões delas entrando na prévia). */
  onMarkedChange?: (accounts: MarkedAccount[]) => void;
};

export type MarkedAccount = { id: string; name: string; platformId: PlatformId };

/** 03 Contas: as contas de anúncio, o Instagram e a Página que entram no dashboard. */
export function AccountsStep({ state, now, timeZone, api, nav, onContinue, onMarkedChange }: AccountsProps) {
  const groups = useMemo(() => accountGroups(state), [state]);
  const [selections, setSelections] = useState<Record<string, PickerSelection>>({});
  const onSelection = useCallback((key: string, s: PickerSelection) => setSelections((prev) => ({ ...prev, [key]: s })), []);
  const action = useStepAction();
  // "Ative pelo menos uma conta" só depois de tentar seguir sem nenhuma, e some ao marcar uma
  const [triedEmpty, setTriedEmpty] = useState(false);
  // o que está marcado na tela, grupo a grupo (com o que ainda não foi salvo)
  const counts = groups.map((g) => ({ group: g, n: selections[g.key]?.dirty ? selections[g.key].count : g.accounts.filter((a) => a.isEnabled).length }));
  const enabled = counts.reduce((n, c) => n + c.n, 0);
  const noAccounts = triedEmpty && !canBuildDashboard(enabled) ? NO_ACCOUNTS : null;
  const { AccountsPanel } = api;
  // as marcadas agora (com o que ainda não foi salvo), em texto estável para o efeito
  const markedKey = groups.map((g) => (selections[g.key]?.ids ?? g.accounts.filter((a) => a.isEnabled).map((a) => a.id)).join("|")).join("·");
  useEffect(() => {
    const marked = groups.flatMap((g) => {
      const ids = new Set(selections[g.key]?.ids ?? g.accounts.filter((a) => a.isEnabled).map((a) => a.id));
      return g.accounts.filter((a) => ids.has(a.id)).map((a) => ({ id: a.id, name: a.name, platformId: g.platformId }));
    });
    onMarkedChange?.(marked);
    // markedKey resume groups e selections
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markedKey, onMarkedChange]);

  function next() {
    if (!canBuildDashboard(enabled)) {
      setTriedEmpty(true);
      return;
    }
    setTriedEmpty(false);
    action.run(async () => {
      for (const g of groups) {
        const sel = selections[g.key];
        if (sel?.dirty && !(await sel.save())) {
          return { ok: false, error: { code: "onboarding:accounts_not_saved", message: `Não deu para salvar as contas de ${PLATFORMS[g.platformId].name}. Confira o aviso acima.` } };
        }
      }
      return { ok: true, data: undefined };
    }, () => onContinue(enabled));
  }

  return (
    <>
      <div className={BODY}>
        <StepTitle title="Escolha as contas" text="Marque as contas que entram no dashboard. Eu trago os últimos 90 dias delas." />
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`contas-${g.key}`} data-provider={g.provider} data-platform={g.platformId} className="rounded-card border border-line bg-card p-4">
              <h3 id={`contas-${g.key}`} className="title mb-3 text-[16px] text-fg">
                {groupTitle(g)}
              </h3>
              <AccountsPanel group={g} state={state} now={now} timeZone={timeZone} onSelection={onSelection} />
            </section>
          ))}
        </div>
      </div>
      <FlowFooter
        {...nav}
        error={noAccounts ?? action.error ?? nav.error}
        primaryLabel="Continuar"
        pendingLabel="Salvando as contas…"
        pending={action.pending}
        hint={enabled === 0 ? "Marque as contas que entram no dashboard." : accountsSummary(counts.map((c) => ({ platformId: c.group.platformId, n: c.n })))}
        onPrimary={next}
      />
    </>
  );
}

type ModelProps = {
  businessTypeId: string | null;
  tier: Tier | null;
  nav: StepNav;
  /** Escolhido o modelo: a tela "Montando" assume (cria o dashboard e abre). */
  onBuild: (templateId: string) => void;
  /** O nome do cliente nas prévias dos modelos. */
  client?: string;
  /** O objetivo sugerido pelas campanhas (ou pelo segmento) e o porquê. */
  suggestion?: ObjectiveSuggestion | null;
  /** O modelo já escolhido (ao voltar das Contas, continua marcado). */
  templateId?: string | null;
  /** O palco mostra o modelo escolhido. */
  onTemplateChange?: (templateId: string | null) => void;
};

/** 04 Modelo: o objetivo (sugerido pelas campanhas) e o visual, com a prévia grande no palco. */
export function ModelStep({ businessTypeId, tier, nav, onBuild, client, suggestion, templateId, onTemplateChange }: ModelProps) {
  // o objetivo: o do modelo já escolhido, o sugerido pelas campanhas ou o do segmento; a pessoa pode trocar
  const segmentObjective = objectiveForBusiness(businessTypeId);
  const initial = templateId ? anyDashboardTemplate(templateId)?.composed : undefined;
  const [objective, setObjective] = useState<ObjectiveId>((initial?.objective as ObjectiveId | undefined) ?? suggestion?.objective ?? segmentObjective);
  const objectives = [...new Set<ObjectiveId>([suggestion?.objective ?? segmentObjective, "ecommerce", "leads", segmentObjective])];
  const options = useMemo(() => layoutOptionsFor(objective, tier).filter((o) => o.allowed), [objective, tier]);
  // o visual escolhido vale em qualquer objetivo (Padrão VYZ · Vender online → Padrão VYZ · Gerar leads)
  const [visual, setVisual] = useState(() => Math.max(0, options.findIndex((o) => o.template.composed?.visual === initial?.visual)));
  const chosen = options[Math.min(visual, options.length - 1)]?.template.id ?? null;
  useEffect(() => onTemplateChange?.(chosen), [chosen, onTemplateChange]);
  const setChosen = (id: string) => setVisual(Math.max(0, options.findIndex((o) => o.template.id === id)));

  return (
    <>
      <div className={BODY}>
        <StepTitle title="Escolha o modelo" text="O visual do dashboard e os números do topo, pelo objetivo das campanhas. A prévia mostra como o seu cliente vai ver." />
        <section aria-labelledby="modelo-titulo">
          <h3 id="modelo-titulo" className="sr-only">
            Modelo do dashboard
          </h3>
          <div role="radiogroup" aria-label="Objetivo do dashboard" className="flex flex-wrap gap-2">
            {objectives.map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={objective === o}
                onClick={() => setObjective(o)}
                className={`rounded-chip px-3 py-1.5 text-[13px] transition-colors duration-150 ${objective === o ? "bg-accent font-semibold text-on-accent" : "border border-line text-fg-2 hover:text-fg"}`}
              >
                {objectiveLabel(o)}
                {suggestion && o === suggestion.objective && <span className="ml-1 opacity-80">· sugerido</span>}
              </button>
            ))}
          </div>
          {suggestion && (
            <p className="mt-2 flex items-start gap-1.5 text-[13px] text-fg-2" data-suggestion={suggestion.source}>
              <Sparkles size={14} aria-hidden className="mt-0.5 shrink-0 text-accent" />
              {suggestion.reason}
            </p>
          )}
          {/* logo abaixo da sugestão, à vista sem rolar */}
          <p className={`text-[13px] text-fg-2 ${suggestion ? "mt-1 pl-5" : "mt-2"}`} data-model-note>
            Você pode trocar o modelo depois, na página Dashboards.
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {options.map((o, i) => (
              <LayoutCard key={o.template.id} option={o} selected={chosen === o.template.id} nicheName={null} onSelect={() => setChosen(o.template.id)} client={client} defer={i + 1} />
            ))}
          </ul>
        </section>
      </div>
      <FlowFooter {...nav} primaryLabel="Montar dashboard" pendingLabel="Montando…" pending={false} disabled={!chosen} onPrimary={() => chosen && onBuild(chosen)} />
    </>
  );
}

/** Os seletores do passo: as contas de anúncio de cada login e, na Meta, o Instagram e a Página que vêm junto. */
export function accountGroups(state: ConnectState): AccountsGroup[] {
  return CORE_PROVIDER_IDS.filter((p) => state.platforms[p].connected).flatMap((p) => {
    const s = state.platforms[p];
    const main: AccountsGroup = { key: p, provider: p, platformId: s.platformId, accounts: s.accounts };
    return [main, ...(s.extras ?? []).filter((e) => e.accounts.length > 0).map((e) => ({ key: `${p}:${e.platformId}`, provider: p, platformId: e.platformId, accounts: e.accounts }))];
  });
}

const groupTitle = (g: AccountsGroup) => (g.platformId === PROVIDERS[g.provider].platformId ? `Contas do ${PROVIDERS[g.provider].name}` : `${PLATFORMS[g.platformId].name} (pelo login do ${PROVIDERS[g.provider].name})`);

/** O que acontece na montagem, em ordem (cada linha entra a cada BUILDING_STEP_MS). */
export const BUILDING_LINES = ["Ligando as contas ao dashboard", "Importando as campanhas dos últimos 90 dias", "Calculando as métricas", "Abrindo o dashboard"];
export const BUILDING_STEP_MS = 400;

/** "Montando seu dashboard…": sempre aparece, com o que está acontecendo, até o dashboard abrir. A prévia se monta no palco. */
export function BuildingView() {
  const [shown, setShown] = useState(1);
  useEffect(() => {
    if (shown >= BUILDING_LINES.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), BUILDING_STEP_MS);
    return () => window.clearTimeout(t);
  }, [shown]);
  return (
    <div role="status" aria-live="polite" className={BODY}>
      <StepTitle title="Montando seu dashboard…" text="Já já ele abre com os números de verdade." />
      <ul className="space-y-2.5" data-building-lines={shown}>
        {BUILDING_LINES.map((l, i) => {
          const done = i < shown - 1;
          const current = i === shown - 1;
          return (
            <li key={l} className={`flex items-center gap-2.5 text-[15px] transition-opacity duration-300 motion-reduce:transition-none ${i < shown ? "opacity-100" : "opacity-0"} ${current ? "text-fg" : "text-fg-2"}`}>
              {done ? <Check size={16} aria-hidden className="text-accent" /> : <LoaderCircle size={16} aria-hidden className={`text-accent ${current ? "animate-spin motion-reduce:animate-none" : ""}`} />}
              {l}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
