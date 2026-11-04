// Estado do onboarding que o servidor entrega à tela (src/server/onboarding/queries.ts monta).

import type { ProviderId } from "@/features/integrations/providers";
import type { ConnectState } from "@/features/integrations/types";
import type { Tier } from "@/features/pricing/entitlements";
import type { ActiveStep } from "./steps";

export type OnboardingState = {
  step: ActiveStep;
  workspaceName: string;
  businessTypeId: string | null;
  /** Meta/Google que o layout escolhido usa. */
  platforms: ProviderId[];
  /** Nome do layout escolhido (passo de conectar). */
  layoutName: string | null;
  tier: Tier | null;
  canManage: boolean;
  /** Só no passo de conectar. */
  connect: ConnectState | null;
};
