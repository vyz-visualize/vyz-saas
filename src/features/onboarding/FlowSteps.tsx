"use client";

// Os passos do primeiro acesso (menos o de conectar, em ConnectStep): boas-
// vindas, projeto, contas e modelo, e a tela "Montando seu dashboard…".

import { Check, FolderPlus, LayoutTemplate, LoaderCircle, PlugZap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BUSINESS_TYPES } from "@/features/catalog/business-types";
import type { PickerSelection } from "@/features/integrations/AccountPicker";
import { PLATFORMS } from "@/features/accounts/platforms";
import { CORE_PROVIDER_IDS, PROVIDERS } from "@/features/integrations/providers";
import type { ConnectState } from "@/features/integrations/types";
import type { Tier } from "@/features/pricing/entitlements";
import type { AccountsGroup, FlowApi } from "./api";
import { LayoutCard } from "./LayoutCard";
import type { StepNav } from "./OnboardingFlow";
import { accountsSummary, canBuildDashboard, layoutOptions } from "./steps";
import { FlowFooter, STEP_BODY, StepTitle, useStepAction } from "./ui";

const BODY = STEP_BODY;
const NO_ACCOUNTS = "Ative pelo menos uma conta para montar o dashboard. Ou pule por agora: o passo fica pendente na Início.";

export function WelcomeStep({ firstName, api, nav }: { firstName: string; api: FlowApi; nav: StepNav }) {
  const action = useStepAction();
  const items = [
    { icon: FolderPlus, text: "Crie o projeto do seu cliente" },
    { icon: PlugZap, text: "Conecte o Meta Ads e o Google Ads" },
    { icon: LayoutTemplate, text: "Escolha as contas e o modelo do dashboard" },
  ];
  return (
    <>
      <div className={BODY}>
        <StepTitle title={firstName ? `Boas-vindas, ${firstName}.` : "Boas-vindas ao VYZ."} text="Em três passos, o seu cliente recebe um dashboard com os números reais das contas dele." />
        <ol className="space-y-2.5">
          {items.map(({ icon: Icon, text }, i) => (
            <li key={text} className="flex items-center gap-3 rounded-card border border-line bg-card p-3.5">
              <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-fg">
                <Icon size={18} />
              </span>
              <span className="text-[15px] text-fg">
                <span className="tnum mr-1.5 font-semibold text-fg-2">{i + 1}.</span>
                {text}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <FlowFooter {...nav} error={action.error ?? nav.error} primaryLabel="Começar" pendingLabel="Abrindo…" pending={action.pending} onPrimary={() => action.run(() => api.start())} />
    </>
  );
}

export function ProjectStep({ project, businessTypeId, api, nav }: { project: { name: string; named: boolean } | null; businessTypeId: string | null; api: FlowApi; nav: StepNav }) {
  // só vem preenchido com um nome que alguém deu (nunca o do workspace ou o da pessoa)
  const [name, setName] = useState(project?.named ? project.name : "");
  const available = BUSINESS_TYPES.filter((b) => b.available);
  const [segment, setSegment] = useState(available.find((b) => b.id === businessTypeId)?.id ?? available[0]?.id ?? "");
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
        <StepTitle title="Qual é o primeiro cliente?" text="Um projeto é o cliente ou a marca que você acompanha. As contas e os dashboards ficam dentro dele." />
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

type SetupProps = {
  state: ConnectState;
  businessTypeId: string | null;
  tier: Tier | null;
  now: string;
  timeZone: string;
  api: FlowApi;
  nav: StepNav;
  /** Salvas as contas: a tela "Montando" assume (cria o dashboard e abre). */
  onBuild: (templateId: string) => void;
};

export function SetupStep({ state, businessTypeId, tier, now, timeZone, api, nav, onBuild }: SetupProps) {
  const groups = useMemo(() => accountGroups(state), [state]);
  const options = useMemo(() => layoutOptions(businessTypeId, tier).filter((o) => o.allowed), [businessTypeId, tier]);
  const [chosen, setChosen] = useState<string | null>(options[0]?.template.id ?? null);
  const [selections, setSelections] = useState<Record<string, PickerSelection>>({});
  const onSelection = useCallback((key: string, s: PickerSelection) => setSelections((prev) => ({ ...prev, [key]: s })), []);
  const action = useStepAction();
  // "Ative pelo menos uma conta" só depois de tentar montar sem nenhuma, e some ao marcar uma
  const [triedEmpty, setTriedEmpty] = useState(false);
  // o que está marcado na tela, grupo a grupo (com o que ainda não foi salvo)
  const counts = groups.map((g) => ({ group: g, n: selections[g.key]?.dirty ? selections[g.key].count : g.accounts.filter((a) => a.isEnabled).length }));
  const enabled = counts.reduce((n, c) => n + c.n, 0);
  const noAccounts = triedEmpty && !canBuildDashboard(enabled) ? NO_ACCOUNTS : null;
  const { AccountsPanel } = api;

  function build() {
    if (!chosen) return;
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
    }, () => onBuild(chosen));
  }

  return (
    <>
      <div className={BODY}>
        <StepTitle title="Escolha as contas e o modelo" text="As contas marcadas entram no dashboard e os últimos 90 dias chegam na hora." />
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
        <section aria-labelledby="modelo-titulo">
          <h3 id="modelo-titulo" className="title text-[16px] text-fg">
            Modelo do dashboard
          </h3>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {options.map((o) => (
              <LayoutCard key={o.template.id} option={o} selected={chosen === o.template.id} nicheName={null} onSelect={() => setChosen(o.template.id)} />
            ))}
          </ul>
        </section>
      </div>
      <FlowFooter
        {...nav}
        error={noAccounts ?? action.error ?? nav.error}
        primaryLabel="Montar dashboard"
        pendingLabel="Salvando as contas…"
        pending={action.pending}
        disabled={!chosen}
        hint={enabled === 0 ? "Marque as contas que entram no dashboard." : accountsSummary(counts.map((c) => ({ platformId: c.group.platformId, n: c.n })))}
        onPrimary={build}
      />
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

/** "Montando seu dashboard…": sempre aparece, com o que está acontecendo, até o dashboard abrir. */
export function BuildingView() {
  const [shown, setShown] = useState(1);
  useEffect(() => {
    if (shown >= BUILDING_LINES.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), BUILDING_STEP_MS);
    return () => window.clearTimeout(t);
  }, [shown]);
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center px-6 py-12 text-center">
      <LoaderCircle size={34} aria-hidden className="animate-spin text-accent motion-reduce:animate-none" />
      <h2 id="passo-titulo" tabIndex={-1} className="display mt-5 text-[clamp(1.4rem,3vw,1.9rem)] text-fg outline-none">
        Montando seu dashboard…
      </h2>
      <ul className="mt-5 space-y-2 text-left" data-building-lines={shown}>
        {BUILDING_LINES.map((l, i) => {
          const done = i < shown - 1;
          const current = i === shown - 1;
          return (
            <li key={l} className={`flex items-center gap-2 text-[14px] transition-opacity duration-300 motion-reduce:transition-none ${i < shown ? "opacity-100" : "opacity-0"} ${current ? "text-fg" : "text-fg-2"}`}>
              {done ? <Check size={15} aria-hidden className="text-accent" /> : <LoaderCircle size={15} aria-hidden className={`text-accent ${current ? "animate-spin motion-reduce:animate-none" : ""}`} />}
              {l}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
