// Estado do onboarding que o servidor entrega à tela (src/server/onboarding/queries.ts monta).

import type { ProviderId } from "@/features/integrations/providers";
import type { ConnectState } from "@/features/integrations/types";
import type { Tier } from "@/features/pricing/entitlements";
import type { ActiveStep, FeatureOption } from "./steps";

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
  /** Só no passo de recursos e marca: os recursos que combinam com as contas conectadas. */
  features: FeatureOption[] | null;
  /** Logo e cor da empresa (workspace). */
  brand: { color: string; logoUrl: string | null };
};
