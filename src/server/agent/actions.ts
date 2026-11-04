"use server";

// O assistente VYZ pede o contexto ao servidor a cada pergunta: plano, uso e
// os números dos dashboards vêm do banco, com o RLS de quem pergunta. O motor
// (local) continua no navegador.

import { unstable_rethrow } from "next/navigation";
import type { AgentContext } from "@/features/agent/engine";
import { toActionError, type ActionResult } from "@/server/supabase/errors";
import { loadAgentContext, type AgentFocus } from "./context";

export async function getAgentContext(focus?: AgentFocus): Promise<ActionResult<AgentContext>> {
  try {
    return { ok: true, data: await loadAgentContext(new Date(), focus) };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}
