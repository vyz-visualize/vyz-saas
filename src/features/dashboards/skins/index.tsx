"use client";

// Visuais próprios dos templates (DashboardTemplate.skin): desenham a primeira
// aba do template no estilo da referência; as outras abas usam os widgets padrão.

import type { SkinId } from "@/features/templates/types";
import { LavandaSkin } from "./Lavanda";
import { MonocromoSkin } from "./Monocromo";
import { PulsoSkin } from "./Pulso";
import type { SkinProps } from "./shared";

const SKINS: Record<SkinId, (p: SkinProps) => React.ReactNode> = {
  lavanda: LavandaSkin,
  pulso: PulsoSkin,
  monocromo: MonocromoSkin,
};

export function SkinView({ skin, ...props }: SkinProps & { skin: SkinId }) {
  const View = SKINS[skin];
  return <View {...props} />;
}

export type { SkinProps };
