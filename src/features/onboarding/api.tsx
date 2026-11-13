"use client";

// O que o primeiro acesso pede ao servidor. Na página /comecar são as Server
// Actions de verdade; na página de desenvolvimento (/dev/primeiro-acesso), uma
// imitação em memória, para testar o fluxo sem banco.

import { useCallback, type ComponentType } from "react";
import { AccountPicker, type PickerSelection } from "@/features/integrations/AccountPicker";
import { connectHref as providerConnectHref, type ProviderId } from "@/features/integrations/providers";
import type { PlatformId } from "@/features/accounts/platforms";
import type { AdAccountDTO, ConnectState } from "@/features/integrations/types";
import { buildFirstDashboard, continueToSetup, finishFirstAccess, goToStep, saveFirstProject, skipOnboarding, startOnboarding } from "@/server/onboarding/actions";
import type { ActionResult } from "@/server/supabase/errors";
import type { ActiveStep } from "./steps";

/** Um seletor do passo de contas: as contas de anúncio do login ou um grupo extra dele (Instagram, Página). */
export type AccountsGroup = { key: string; provider: ProviderId; platformId: PlatformId; accounts: AdAccountDTO[] };

export type AccountsPanelProps = {
  group: AccountsGroup;
  state: ConnectState;
  now: string;
  timeZone: string;
  onSelection: (key: string, selection: PickerSelection) => void;
};

export type FlowApi = {
  start: () => Promise<ActionResult>;
  saveProject: (name: string, businessTypeId: string) => Promise<ActionResult>;
  toSetup: () => Promise<ActionResult>;
  /** Fase 1 da montagem: cria o dashboard (o primeiro acesso ainda não termina). */
  build: (templateId: string) => Promise<ActionResult<{ id: string }>>;
  /** Fase 2, depois da tela "Montando": conclui o primeiro acesso e abre o dashboard com o tour. */
  finish: (dashboardId: string) => Promise<ActionResult>;
  skip: (step: ActiveStep) => Promise<ActionResult>;
  back: (step: ActiveStep) => Promise<ActionResult>;
  /** O login da plataforma, voltando para o mesmo passo do primeiro acesso. */
  connectHref: (provider: ProviderId) => string;
  /** Seletor das contas de anúncio de uma plataforma conectada. */
  AccountsPanel: ComponentType<AccountsPanelProps>;
};

/** Volta do login da Meta e do Google: o passo de conectar, com o "Conectado". */
export const ONBOARDING_RETURN = "/comecar";

function ProductAccountsPanel({ group, state, now, timeZone, onSelection }: AccountsPanelProps) {
  const { provider, platformId, accounts, key } = group;
  // estável: o seletor avisa a escolha num efeito
  const onChange = useCallback((s: PickerSelection) => onSelection(key, s), [onSelection, key]);
  if (accounts.length === 0) return <p className="text-[14px] text-fg-2">O login não devolveu nenhuma conta de anúncio. Confira se ele tem acesso às contas e conecte de novo.</p>;
  return (
    <AccountPicker
      provider={provider}
      platformId={platformId}
      accounts={accounts}
      projects={state.projects}
      maxPerProject={state.limit.maxAccountsPerPlatform}
      canManage={state.canManage}
      canSync={state.canSync}
      now={now}
      timeZone={timeZone}
      saveLabel="Ativar e importar"
      onSelectionChange={onChange}
    />
  );
}

export const realFlowApi: FlowApi = {
  start: startOnboarding,
  saveProject: saveFirstProject,
  toSetup: continueToSetup,
  build: buildFirstDashboard,
  skip: skipOnboarding,
  back: goToStep,
  connectHref: (provider) => providerConnectHref(provider, ONBOARDING_RETURN),
  finish: finishFirstAccess,
  AccountsPanel: ProductAccountsPanel,
};
