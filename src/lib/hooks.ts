"use client";

import { useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** true depois da hidratação; false no servidor e no HTML inicial. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  };
}

const finePointerQuery = "(hover: hover) and (pointer: fine)";
const subscribeFine = subscribeMedia(finePointerQuery);

/** Mouse de verdade (para tilt, magnético e parallax). */
export function useFinePointer(): boolean {
  return useSyncExternalStore(
    subscribeFine,
    () => window.matchMedia(finePointerQuery).matches,
    () => false,
  );
}

/** Animação rica liberada: hidratado, sem movimento reduzido. */
export function useMotionOK(): boolean {
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  return hydrated && !reduce;
}

const smQuery = "(min-width: 640px)";
const subscribeSm = subscribeMedia(smQuery);

/** Tela a partir de 640 px (o "sm" do Tailwind). No servidor, false. */
export function useSmUp(): boolean {
  return useSyncExternalStore(
    subscribeSm,
    () => window.matchMedia(smQuery).matches,
    () => false,
  );
}
