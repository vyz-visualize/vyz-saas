// Estado do primeiro acesso que o servidor entrega à tela (src/server/onboarding/queries.ts monta).

import type { ConnectState } from "@/features/integrations/types";
import type { Tier } from "@/features/pricing/entitlements";
import type { ActiveStep } from "./steps";

export type OnboardingState = {
  step: ActiveStep;
  firstName: string;
  workspaceName: string;
  businessTypeId: string | null;
  tier: Tier | null;
  canManage: boolean;
  /** O primeiro projeto, se já existe (refazer o primeiro acesso reaproveita). */
  project: { id: string; name: string } | null;
  /** Contas e conexões: só nos passos de conectar e de contas e modelo. */
  connect: ConnectState | null;
  /** Selo "Modo de teste" nas plataformas: só em desenvolvimento ou para ONBOARDING_REPLAY_EMAILS (nunca para o cliente). */
  showTestBadges: boolean;
};
