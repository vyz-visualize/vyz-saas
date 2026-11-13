// POST /api/v1/agent: o VYZ no app. Mesmo motor e mesmo contexto do site
// (plano, uso e números dos dashboards com o RLS de quem pergunta); a
// resposta volta pronta para desenhar. Ações do site (tema, abrir seções do
// painel) ficam de fora: no app, só o "abrir o dashboard".

import { z } from "zod";
import { createEngine, type AgentAnswer } from "@/features/agent/engine";
import { SUGGESTIONS } from "@/features/agent/engine/local";
import { loadAgentContext } from "@/server/agent/context";
import { apiJson, bearerSession, unauthorized } from "@/server/auth/bearer";
import { bearerWorkspace } from "@/server/auth/bearer-workspace";

const Input = z.object({
  question: z.string().trim().max(500),
  workspaceId: z.uuid().nullish(),
  /** Pergunta feita dentro de um dashboard, com o recorte aberto (ex.: "campanha=123"). */
  dashboardId: z.uuid().nullish(),
  search: z.string().max(2000).nullish(),
});

/** Sugestões que fazem sentido no app (sem trocar tema). */
const APP_SUGGESTIONS = [...SUGGESTIONS.filter((s) => !/modo|tema/i.test(s)), "Qual cliente teve o melhor ROAS?", "Quantas vendas esse mês?"];

function forApp(a: AgentAnswer) {
  const suggestions = a.suggestions?.filter((s) => !/modo|tema/i.test(s));
  return {
    text: a.text,
    card: a.card ?? null,
    chart: a.chart ?? null,
    dashboardId: a.target?.dashboardId ?? null,
    suggestions: suggestions?.length ? suggestions : null,
    understood: a.understood,
  };
}

export async function GET(request: Request) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  return apiJson({ suggestions: APP_SUGGESTIONS });
}

export async function POST(request: Request) {
  const session = await bearerSession(request);
  if (!session) return unauthorized();
  const parsed = Input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiJson({ error: { code: "validation", message: "Pergunta inválida." } }, 400);
  const { question, workspaceId, dashboardId, search } = parsed.data;
  try {
    const ws = await bearerWorkspace(session, workspaceId);
    if (!ws) return apiJson({ error: { code: "workspace:not_found", message: "Organização não encontrada." } }, 404);
    const focus = dashboardId ? { dashboardId, search: search ?? "" } : undefined;
    const ctx = await loadAgentContext(new Date(), focus, { session: ws, db: session.db });
    const answer = await createEngine().ask(question, ctx);
    return apiJson({ answer: forApp(answer) });
  } catch (err) {
    console.error("[vyz] api v1 agent", err);
    return apiJson({ error: { code: "unknown", message: "O VYZ não conseguiu responder agora. Tente de novo." } }, 500);
  }
}
