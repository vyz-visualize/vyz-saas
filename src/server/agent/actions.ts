"use server";

// O assistente VYZ pede o contexto ao servidor a cada pergunta: plano, uso e
// os números dos dashboards vêm do banco, com o RLS de quem pergunta. O motor
// (local) continua no navegador.

import { unstable_rethrow } from "next/navigation";
import type { AgentContext } from "@/features/agent/engine";
import { authorize } from "@/server/auth/workspace";
import { logActivity } from "@/server/history/log";
import { toActionError, type ActionResult } from "@/server/supabase/errors";
import { loadAgentContext, type AgentFocus } from "./context";

export async function getAgentContext(focus?: AgentFocus): Promise<ActionResult<AgentContext>> {
  try {
    const session = await authorize("viewer", { access: false });
    const data = await loadAgentContext(new Date(), focus);
    // a pergunta fica no navegador (motor local): o registro guarda só que o assistente foi consultado e onde
    await logActivity({ workspaceId: session.workspace.id, actorId: session.user.id, event: "agent.consulted", metadata: focus ? { focus: JSON.parse(JSON.stringify(focus)) } : {} });
    return { ok: true, data };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}
