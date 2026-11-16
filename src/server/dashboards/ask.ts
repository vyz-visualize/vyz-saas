"use server";

// "Pedir ao Vyz" com o Claude: lê o pedido da pessoa e devolve os blocos para a aba. Só monta a
// proposta: nada é gravado aqui (os blocos entram pelo editor e valem no Salvar, que confere tudo
// de novo). Sem chave, sem sessão, acima do limite ou com erro da API, devolve erro e o editor usa
// a leitura local.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AiPlanSchema, AskRequestSchema, fromAi } from "@/features/dashboards/ask/ai-plan";
import type { LayoutPlan } from "@/features/dashboards/ask/planner";
import { claude, CLAUDE_MODEL } from "@/server/ai/claude";
import { authorize } from "@/server/auth/workspace";
import { hitRateLimit } from "@/server/security/rate-limit";
import { appError, toActionError, type ActionResult } from "@/server/supabase/errors";
import { ASK_SYSTEM, askMessage } from "./ask-prompt";

export async function askLayout(input: unknown): Promise<ActionResult<LayoutPlan>> {
  try {
    const parsed = AskRequestSchema.safeParse(input);
    if (!parsed.success) throw appError("validation");
    const req = parsed.data;
    const ai = claude();
    if (!ai) throw appError("ai:off", "A leitura com IA não está ligada.");

    // quem pede: a sessão com plano ativo (cada pedido custa uma chamada). Na bancada de
    // desenvolvimento (/dev/templates) não há sessão: lá passa sem.
    let userId: string | null = null;
    try {
      userId = (await authorize("member")).user.id;
    } catch (err) {
      if (process.env.NODE_ENV === "production") throw err;
    }
    if (userId && !(await hitRateLimit("ask_layout_user", userId))) throw appError("rate_limited");

    const res = await ai.beta.messages.parse({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      // se o modelo recusar, a API refaz o pedido num modelo de reserva, na mesma chamada
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      // pedido curto e a pessoa esperando: pensar pouco basta para escolher blocos de um catálogo
      output_config: { effort: "low", format: betaZodOutputFormat(AiPlanSchema) },
      system: [{ type: "text", text: ASK_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: askMessage(req) }],
    });
    if (process.env.NODE_ENV !== "production") {
      const u = res.usage;
      console.info(`[vyz] pedir ao vyz: ${res.model}, ${u.input_tokens} entrada (+${u.cache_read_input_tokens ?? 0} do cache, ${u.cache_creation_input_tokens ?? 0} gravados), ${u.output_tokens} saída, ${res.stop_reason}`);
    }
    if (res.stop_reason === "refusal" || !res.parsed_output) throw appError("ai:failed", "Não deu para ler o pedido com IA.");
    return { ok: true, data: fromAi(res.parsed_output, req) };
  } catch (err) {
    return toActionError(err);
  }
}
