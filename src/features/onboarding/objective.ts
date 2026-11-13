// Sugestão do modelo no passo "Contas e modelo": pelo objetivo das campanhas das contas
// escolhidas. Meta pelo objetivo da campanha; Google pelo resultado (sem objetivo na API que
// sincronizamos). Vence o objetivo com mais investimento nos últimos 30 dias. Alcance não tem
// modelo: fica o do segmento. Sem dados ainda (a importação dos 90 dias está rodando), o
// segmento do passo 1. Puro: o servidor junta os números e a tela mostra a explicação.

import { objectiveForBusiness, OBJECTIVES, type ObjectiveId } from "@/features/templates/dashboards/composed";

export type GoalKind = "sales" | "leads" | "reach";

export type CampaignSignal = {
  platform: string;
  /** Objetivo da campanha na Meta (OUTCOME_SALES...). Google: null. */
  objective: string | null;
  /** Tipo de campanha no Google (search, display, video...). */
  channel: string | null;
  /** Investimento dos últimos 30 dias, em reais. */
  spend: number;
  conversions: number;
  conversionValue: number;
};

const META_GOAL: Record<string, GoalKind> = {
  OUTCOME_SALES: "sales",
  CONVERSIONS: "sales",
  PRODUCT_CATALOG_SALES: "sales",
  OUTCOME_LEADS: "leads",
  LEAD_GENERATION: "leads",
  MESSAGES: "leads",
  OUTCOME_AWARENESS: "reach",
  REACH: "reach",
  BRAND_AWARENESS: "reach",
  VIDEO_VIEWS: "reach",
  OUTCOME_ENGAGEMENT: "reach",
  POST_ENGAGEMENT: "reach",
  PAGE_LIKES: "reach",
  OUTCOME_TRAFFIC: "reach",
  LINK_CLICKS: "reach",
  OUTCOME_APP_PROMOTION: "reach",
  APP_INSTALLS: "reach",
};

/** O objetivo de uma campanha (ou null quando não dá para saber). */
export function campaignGoal(c: CampaignSignal): GoalKind | null {
  if (c.platform === "meta") return c.objective ? (META_GOAL[c.objective.toUpperCase()] ?? null) : null;
  if (c.platform === "google") {
    if (c.conversionValue > 0) return "sales";
    if (c.conversions > 0) return "leads";
    if (c.channel && ["display", "video", "demand_gen"].includes(c.channel)) return "reach";
  }
  return null;
}

// objetivos do segmento que já são de venda ou de lead: a sugestão fica com eles
const SALES_OBJECTIVES: ObjectiveId[] = ["ecommerce", "infoproduto"];
const LEAD_OBJECTIVES: ObjectiveId[] = ["leads", "imob", "saude", "educacao", "local", "infoproduto"];

export type ObjectiveSuggestion = { objective: ObjectiveId; reason: string; source: "campaigns" | "segment" };

export function suggestObjective(signals: readonly CampaignSignal[], businessTypeId: string | null): ObjectiveSuggestion {
  const segment = objectiveForBusiness(businessTypeId);
  const totals: Record<GoalKind, number> = { sales: 0, leads: 0, reach: 0 };
  for (const s of signals) {
    const g = campaignGoal(s);
    if (g && s.spend > 0) totals[g] += s.spend;
  }
  const total = totals.sales + totals.leads + totals.reach;
  if (total <= 0) return { objective: segment, source: "segment", reason: `Pelo segmento escolhido no passo 1: as campanhas ainda estão sendo importadas.` };
  const winner = (Object.keys(totals) as GoalKind[]).reduce((a, b) => (totals[b] > totals[a] ? b : a));
  const pct = Math.round((totals[winner] / total) * 100);
  if (winner === "reach") return { objective: segment, source: "segment", reason: `Não temos um modelo de alcance; usamos o do seu segmento (${pct}% do investimento dos últimos 30 dias está em alcance).` };
  const objective = winner === "sales" ? (SALES_OBJECTIVES.includes(segment) ? segment : "ecommerce") : LEAD_OBJECTIVES.includes(segment) ? segment : "leads";
  return { objective, source: "campaigns", reason: `Sugerido porque ${pct}% do investimento dos últimos 30 dias está em campanhas de ${winner === "sales" ? "vendas" : "leads"}.` };
}

export const objectiveLabel = (id: ObjectiveId) => OBJECTIVES.find((o) => o.id === id)?.label ?? id;
