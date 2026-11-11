"use client";

// As ações do dashboard ficam na barra do topo da tela cheia (FocusShell), não dentro do
// dashboard. Quem desenha o dashboard entrega as ações por aqui: elas são levadas para o
// espaço da barra. Fora da tela cheia (sem a barra), não desenha nada.

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FOCUS_ACTIONS_ID } from "./focus";

const subscribe = () => () => {};

/** O espaço das ações na barra do topo (só existe na tela cheia, depois de montar). */
export function useFocusBar(): HTMLElement | null {
  return useSyncExternalStore(
    subscribe,
    () => document.getElementById(FOCUS_ACTIONS_ID),
    () => null,
  );
}

export function FocusBarActions({ children }: { children: ReactNode }) {
  const bar = useFocusBar();
  return bar ? createPortal(children, bar) : null;
}
