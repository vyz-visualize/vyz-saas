"use client";

// Workspace aberto no painel, no formato que os componentes já usavam
// ({ ws, ent, update }). Os dados vêm da sessão montada no servidor
// (WorkspaceProvider); update() grava pelo servidor e re-renderiza a rota.

import { useCallback } from "react";
import { ENTITLEMENTS, type Tier } from "@/features/pricing/entitlements";
import { updateWorkspace } from "@/server/workspace/actions";
import { useOptionalWorkspaceSession } from "./WorkspaceProvider";

export type Brand = { logo?: string; color: string; hideVyz: boolean };

export type Workspace = {
  name: string;
  userName: string;
  /** Plano vigente (sem assinatura ativa, vale o Base para os bloqueios). */
  tier: Tier;
  /** Projetos contratados (entram no limite). */
  contractedAccounts: number;
  brand: Brand;
};

export const DEFAULT_WORKSPACE: Workspace = {
  name: "Minha agência",
  userName: "",
  tier: "base",
  contractedAccounts: 3,
  brand: { color: "#4B5320", hideVyz: false },
};

export function useWorkspace() {
  const session = useOptionalWorkspaceSession();
  const ws: Workspace = session
    ? {
        name: session.workspace.name,
        userName: session.user.fullName,
        tier: session.access.tier ?? "base",
        contractedAccounts: session.access.accountsQuantity,
        brand: { logo: session.workspace.brandLogoUrl ?? undefined, color: session.workspace.brandColor, hideVyz: session.workspace.hideVyzBrand },
      }
    : DEFAULT_WORKSPACE;

  const update = useCallback(async (patch: Partial<Workspace>) => {
    return updateWorkspace({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.brand?.color !== undefined ? { brandColor: patch.brand.color } : {}),
      ...(patch.brand?.hideVyz !== undefined ? { hideVyzBrand: patch.brand.hideVyz } : {}),
    });
  }, []);

  return { ws, update, ent: session?.access.entitlements ?? ENTITLEMENTS[ws.tier], session };
}
