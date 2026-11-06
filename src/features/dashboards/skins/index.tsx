"use client";

// Visuais próprios dos templates (DashboardTemplate.skin): desenham a primeira
// aba do template no estilo da referência; as outras abas usam os widgets padrão.

import type { SkinId } from "@/features/templates/types";
import { CriativosAoVivoSkin } from "./CriativosAoVivo";
import { LavandaSkin } from "./Lavanda";
import { MmmSkin } from "./Mmm";
import { MonocromoSkin } from "./Monocromo";
import { PrevisaoSkin } from "./Previsao";
import { PulsoSkin } from "./Pulso";
import type { SkinProps } from "./shared";

const SKINS: Record<SkinId, (p: SkinProps) => React.ReactNode> = {
  lavanda: LavandaSkin,
  pulso: PulsoSkin,
  monocromo: MonocromoSkin,
  "criativos-ao-vivo": CriativosAoVivoSkin,
  previsao: PrevisaoSkin,
  mmm: MmmSkin,
};

export function SkinView({ skin, ...props }: SkinProps & { skin: SkinId }) {
  const View = SKINS[skin];
  return <View {...props} />;
}

export type { SkinProps };
