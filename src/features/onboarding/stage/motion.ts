"use client";

// "Reduzir movimento" do sistema e o texto que se escreve letra a letra (fala do agente).

import { useEffect, useState, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotionPref(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** Texto que aparece letra a letra; com "reduzir movimento", inteiro desde o começo. */
export function useTyped(text: string, reduced: boolean, speed = 16) {
  const [typed, setTyped] = useState({ text, n: 0 });
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setTyped((s) => (s.text !== text ? { text, n: 1 } : s.n >= text.length ? s : { text, n: s.n + 1 })), speed);
    return () => window.clearInterval(id);
  }, [text, reduced, speed]);
  const n = reduced ? text.length : typed.text === text ? typed.n : 0;
  return { shown: text.slice(0, n), done: n >= text.length };
}
