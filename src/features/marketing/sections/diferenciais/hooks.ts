"use client";

// "Reduzir movimento" sem descompasso na hidratação: no servidor e no primeiro render é false,
// e o valor do navegador entra logo depois (o cérebro de dados decide se anima).

import { useSyncExternalStore } from "react";

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeReduce = (cb: () => void) => {
  const m = matchMedia(REDUCE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export function useReduceMotion() {
  return useSyncExternalStore(subscribeReduce, () => matchMedia(REDUCE).matches, () => false);
}
