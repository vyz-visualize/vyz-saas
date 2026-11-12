"use client";

// Os passos do primeiro acesso (menos o de conectar, em ConnectStep): boas-
// vindas, projeto, contas e modelo, e a tela "Montando seu dashboard…".

import { Check, FolderPlus, LayoutTemplate, LoaderCircle, PlugZap } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { BUSINESS_TYPES } from "@/features/catalog/business-types";
import type { PickerSelection } from "@/features/integrations/AccountPicker";
import { CORE_PROVIDER_IDS, PROVIDERS, type ProviderId } from "@/features/integrations/providers";
import type { ConnectState } from "@/features/integrations/types";
import type { Tier } from "@/features/pricing/entitlements";
import type { FlowApi } from "./api";
import { LayoutCard } from "./LayoutCard";
import type { StepNav } from "./OnboardingFlow";
import { canBuildDashboard, layoutOptions } from "./steps";
import { FlowFooter, STEP_BODY, StepTitle, useStepAction } from "./ui";

const BODY = STEP_BODY;

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

export function ProjectStep({ project, businessTypeId, api, nav }: { project: { name: string } | null; businessTypeId: string | null; api: FlowApi; nav: StepNav }) {
  const [name, setName] = useState(project?.name ?? "");
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
            placeholder="Ex.: Loja da Ana, Clínica Sol"
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
  onBuilt: (id: string) => void;
};

export function SetupStep({ state, businessTypeId, tier, now, timeZone, api, nav, onBuilt }: SetupProps) {
  const providers = CORE_PROVIDER_IDS.filter((p) => state.platforms[p].connected);
  const options = useMemo(() => layoutOptions(businessTypeId, tier).filter((o) => o.allowed), [businessTypeId, tier]);
  const [chosen, setChosen] = useState<string | null>(options[0]?.template.id ?? null);
  const [selections, setSelections] = useState<Partial<Record<ProviderId, PickerSelection>>>({});
  const onSelection = useCallback((provider: ProviderId, s: PickerSelection) => setSelections((prev) => ({ ...prev, [provider]: s })), []);
  const action = useStepAction();
  const enabled = providers.reduce((n, p) => {
    const sel = selections[p];
    return n + (sel?.dirty ? sel.count : state.platforms[p].enabledCount);
  }, 0);
  const { AccountsPanel } = api;

  function build() {
    if (!chosen) return;
    action.run(async () => {
      for (const p of providers) {
        const sel = selections[p];
        if (sel?.dirty && !(await sel.save())) {
          return { ok: false, error: { code: "onboarding:accounts_not_saved", message: `Não deu para salvar as contas do ${PROVIDERS[p].name}. Confira o aviso acima.` } };
        }
      }
      if (!canBuildDashboard(enabled)) {
        return { ok: false, error: { code: "onboarding:no_accounts", message: "Ative pelo menos uma conta para montar o dashboard. Ou pule por agora: o passo fica pendente na Início." } };
      }
      return api.build(chosen);
    }, (data) => data && onBuilt((data as { id: string }).id));
  }

  return (
    <>
      <div className={BODY}>
        <StepTitle title="Escolha as contas e o modelo" text="As contas ativas entram no dashboard e os últimos 90 dias chegam na hora." />
        <div className="space-y-3">
          {providers.map((p) => (
            <section key={p} aria-labelledby={`contas-${p}`} data-provider={p} className="rounded-card border border-line bg-card p-4">
              <h3 id={`contas-${p}`} className="title mb-3 text-[16px] text-fg">
                Contas do {PROVIDERS[p].name}
              </h3>
              <AccountsPanel provider={p} state={state} now={now} timeZone={timeZone} onSelection={onSelection} />
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
        error={action.error ?? nav.error}
        primaryLabel="Montar dashboard"
        pendingLabel="Montando…"
        pending={action.pending}
        disabled={!chosen}
        hint={enabled === 0 ? "Ative pelo menos uma conta acima para montar o dashboard." : `${enabled} ${enabled === 1 ? "conta ativa" : "contas ativas"} no dashboard.`}
        onPrimary={build}
      />
    </>
  );
}

/** "Montando seu dashboard…": a transição até o dashboard abrir. */
export function BuildingView() {
  const lines = ["Ligando as contas", "Montando as páginas", "Abrindo o dashboard"];
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center px-6 py-12 text-center">
      <LoaderCircle size={34} aria-hidden className="animate-spin text-accent motion-reduce:animate-none" />
      <h2 id="passo-titulo" tabIndex={-1} className="display mt-5 outline-none text-[clamp(1.4rem,3vw,1.9rem)] text-fg">
        Montando seu dashboard…
      </h2>
      <ul className="mt-5 space-y-2 text-left">
        {lines.map((l, i) => (
          <li key={l} className="flex items-center gap-2 text-[14px] text-fg-2 motion-safe:animate-[fade-in_300ms_var(--ease)_both]" style={{ animationDelay: `${i * 450}ms` }}>
            <Check size={15} aria-hidden className="text-accent" /> {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
