import "server-only";

// O miolo comum das Server Actions que mudam dados: roda, atualiza a tela (refresh) e devolve
// { ok, data }. Erro vira mensagem para o usuário; redirect e notFound seguem o fluxo do Next.

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { toActionError, type ActionResult } from "@/server/supabase/errors";

export async function runAndRefresh<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    refresh();
    return { ok: true, data };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}
