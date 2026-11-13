"use client";

// Monta algo pesado (as prévias dos modelos) só depois de a tela aparecer, um de cada vez,
// quando o navegador tiver folga: o passo abre na hora, com esqueleto, e as prévias entram depois.

import { useEffect, useState } from "react";

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

/** true depois do primeiro desenho + `order` × 140 ms, quando o navegador estiver livre. */
export function useDeferred(order = 0): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as IdleWindow;
    let idle = 0;
    const t = window.setTimeout(
      () => {
        if (w.requestIdleCallback) idle = w.requestIdleCallback(() => setReady(true), { timeout: 600 });
        else setReady(true);
      },
      120 + order * 140,
    );
    return () => {
      window.clearTimeout(t);
      if (idle) w.cancelIdleCallback?.(idle);
    };
  }, [order]);
  return ready;
}
