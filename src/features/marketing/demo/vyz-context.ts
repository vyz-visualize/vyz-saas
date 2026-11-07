// O contexto do VYZ na demonstração: dois clientes fictícios, com o mês até hoje e o
// período anterior de mesmo tamanho (o mesmo que ele lê no painel), da mesma amostra.

import { respond } from "@/features/agent/engine/local";
import type { AgentAnswer, AgentContext, ClientData } from "@/features/agent/engine/types";
import { aggregateDashboard } from "@/features/analytics/aggregate";
import type { LivePlatform, Totals as ViewTotals } from "@/features/analytics/types";
import { totals, type Totals } from "@/features/metrics/compute";
import { ENTITLEMENTS, TIER_LABEL } from "@/features/pricing/entitlements";
import { sampleRowsFor } from "./engine";

/** Os totais da tela (em reais) no formato do motor (em centavos). */
function engineTotals(t: ViewTotals): Totals {
  return totals(
    [{ ago: 0, spend: Math.round((t.spend ?? 0) * 100), impressions: t.impressions, clicks: t.clicks, conversions: t.conversions, revenue: Math.round(t.value * 100), leads: 0, qualified: 0, visits: 0, calls: 0, sessions: 0, views: 0, byPlatform: {}, maturing: false }],
    t.frequency ?? 0,
  );
}

/** Dois clientes para o VYZ comparar: a amostra da Meta e a do Google, com nomes diferentes. */
export const DEMO_CLIENTS: Record<LivePlatform, string> = { meta: "Loja Verde", google: "Casa Norte" };

function client(platform: LivePlatform): ClientData {
  const view = aggregateDashboard(sampleRowsFor(platform, "mes"), { breakEvenRoas: 2.5 });
  const name = DEMO_CLIENTS[platform];
  // sem cards no contexto: na demonstração não há painel para "Mostrar no painel"
  return { dashboardId: `site-${platform}`, dashboardName: name, client: name, profile: "ecommerce", cur: engineTotals(view.totals), prev: engineTotals(view.previousTotals), kpis: [] };
}

export function demoContext(now = new Date()): AgentContext {
  return {
    now,
    tier: "avancado",
    tierLabel: TIER_LABEL.avancado,
    ent: ENTITLEMENTS.avancado,
    dashboards: [client("meta"), client("google")],
    landingPages: false,
    counts: { dashboards: 2, landingPublished: 0, accounts: 2, projects: 2, contractedProjects: 2 },
  };
}

/** Perguntas que o VYZ responde com estes dados (testadas). */
export const DEMO_QUESTIONS = ["Quanto investi esse mês?", "Quantas vendas esse mês?", "Qual cliente teve o melhor ROAS?", "Qual cliente teve o pior CPA?"] as const;

/** O que o VYZ diz a qualquer pergunta fora dos atalhos: nunca uma resposta errada. */
export const DEMO_FALLBACK = `Nesta amostra eu respondo estas perguntas: ${DEMO_QUESTIONS.join(" · ")}`;

/**
 * A resposta da demonstração: o motor do painel só para os atalhos (testados com estes
 * dados); qualquer outra pergunta recebe a lista do que dá para perguntar aqui.
 */
export function demoAnswer(question: string, ctx: AgentContext): AgentAnswer {
  const known = (DEMO_QUESTIONS as readonly string[]).includes(question.trim());
  const answer = known ? respond(question, ctx) : null;
  if (answer?.understood) return answer;
  return { text: DEMO_FALLBACK, spoken: DEMO_FALLBACK, understood: false };
}
