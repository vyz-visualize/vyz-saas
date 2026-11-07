"use client";

import { useSearchParams } from "next/navigation";
import { startTransition, useEffect, useRef } from "react";
import { fromQuery } from "@/features/pricing/pricing";
import { usePlan } from "./PlanProvider";

/**
 * Lê a simulação da query string uma vez (links que chegam com ?periodo=anual, por
 * exemplo). Não grava nada: no site, o estado fica só na memória da página.
 * Fica dentro de <Suspense>: o resto da página continua pré-renderizado.
 */
export function UrlSync() {
  const params = useSearchParams();
  const { update } = usePlan();
  const restored = useRef(false);

  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const fromUrl = fromQuery(params);
    // como transição, o React termina de hidratar as dobras antes de aplicar o
    // estado da URL (senão o HTML pré-renderizado não bate com o novo estado)
    if (fromUrl) startTransition(() => update(fromUrl));
  }, [params, update]);

  return null;
}

/** URL atual da simulação (para WhatsApp e "Copiar link"). */
export function simulationUrl(query: string): string {
  return `${window.location.origin}${window.location.pathname}?${query}`;
}
