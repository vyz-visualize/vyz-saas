import { useSyncExternalStore } from "react";

// Estado da intro da primeira visita. O script do <head> decide se ela roda
// (marca data-intro no <html>, com shouldPlayIntro); o IntroController conduz as fases.

export type IntroPhase = "off" | "playing" | "reveal" | "done";

type State = { phase: IntroPhase; revealed: boolean };

let state: State = { phase: "off", revealed: false };
let initialized = false;
const listeners = new Set<() => void>();

function init() {
  if (initialized || typeof document === "undefined") return;
  initialized = true;
  if (document.documentElement.hasAttribute("data-intro")) state = { phase: "playing", revealed: false };
}

export function getIntro(): State {
  init();
  return state;
}

export const SERVER_INTRO: State = { phase: "off", revealed: false };

export function setIntroPhase(phase: IntroPhase) {
  init();
  state = { phase, revealed: state.revealed || phase === "reveal" };
  listeners.forEach((l) => l());
}

export function subscribeIntro(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// a regra mora em lib: o layout raiz também a usa, e ele não pode importar do site
export { INTRO_KEY, shouldPlayIntro, type IntroVisit } from "@/lib/intro-rule";

export function useIntro() {
  return useSyncExternalStore(subscribeIntro, getIntro, () => SERVER_INTRO);
}
