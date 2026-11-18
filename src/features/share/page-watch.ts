"use client";

// Na página pública do link (/r/<token>), o dashboard avisa qual tela está aberta, para a aba
// Acessos do workspace mostrar o que o cliente viu. Fora dela não há quem ouça e nada acontece.

import { createContext, use, useEffect } from "react";

export const PageWatchContext = createContext<((page: string) => void) | null>(null);

/** Chamado pelo dashboard com a tela aberta (id da página). */
export function useWatchPage(page: string | undefined) {
  const watch = use(PageWatchContext);
  useEffect(() => {
    if (page) watch?.(page);
  }, [watch, page]);
}
