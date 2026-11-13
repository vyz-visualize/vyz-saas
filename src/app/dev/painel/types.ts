// Uma tela da bancada do painel: o endereço que ela simula (para a seção ativa do menu) e o que desenha.

import type { ReactNode } from "react";
import type { Tier } from "@/features/pricing/entitlements";
import type { MemberRole } from "@/features/workspace/session";

export type Screen = { path: string; node: (tier: Exclude<Tier, "personalizado">, role: MemberRole) => ReactNode };
