// Ponto de troca do motor. Hoje: LocalEngine (no navegador, sem API).
// Depois: um LlmEngine que chama um route handler no servidor, com a mesma
// interface VyzEngine (ver "Assistente VYZ" em docs/PENDENCIAS.md).

import { LocalEngine } from "./local";
import type { VyzEngine } from "./types";

export function createEngine(): VyzEngine {
  return new LocalEngine();
}

export type { AgentAnswer, AgentContext, AgentTarget, VyzEngine } from "./types";
