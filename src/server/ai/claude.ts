import "server-only";

// Cliente da API do Claude (Anthropic). Sem CLAUDE_API_KEY, devolve null e quem chama segue sem IA
// (o "Pedir ao Vyz" volta para a leitura local). A chave só existe no servidor.

import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/server/env";

export const CLAUDE_MODEL = "claude-opus-5-5";

let cached: Anthropic | null | undefined;

export function claude(): Anthropic | null {
  if (cached !== undefined) return cached;
  const apiKey = serverEnv().CLAUDE_API_KEY;
  // uma nova tentativa só, e um teto de espera: a pessoa está olhando a tela
  cached = apiKey ? new Anthropic({ apiKey, maxRetries: 1, timeout: 40_000 }) : null;
  return cached;
}
