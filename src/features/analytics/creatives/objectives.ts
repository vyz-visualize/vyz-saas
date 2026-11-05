// Objetivos de campanha: nome em português e o que conta como resultado de cada
// um. Puro: serve à lista, ao comparativo e à análise.

export type ObjectiveKey = "sales" | "leads" | "engagement" | "traffic" | "awareness" | "other";

const KEYS: Record<string, ObjectiveKey> = {
  OUTCOME_SALES: "sales",
  SALES: "sales",
  CONVERSIONS: "sales",
  PRODUCT_CATALOG_SALES: "sales",
  OUTCOME_LEADS: "leads",
  LEAD_GENERATION: "leads",
  OUTCOME_ENGAGEMENT: "engagement",
  POST_ENGAGEMENT: "engagement",
  OUTCOME_TRAFFIC: "traffic",
  LINK_CLICKS: "traffic",
  OUTCOME_AWARENESS: "awareness",
  REACH: "awareness",
  BRAND_AWARENESS: "awareness",
};

export const objectiveKey = (raw: string | null | undefined): ObjectiveKey => (raw ? (KEYS[raw] ?? "other") : "other");

export const OBJECTIVE_LABEL: Record<ObjectiveKey, string> = {
  sales: "Vendas",
  leads: "Leads",
  engagement: "Engajamento",
  traffic: "Tráfego",
  awareness: "Reconhecimento",
  other: "Outro objetivo",
};

export type ResultInput = { conversions: number; leads: number | null; postEngagement: number | null; linkClicks: number | null; clicks: number; impressions: number };

/** O resultado de um anúncio ou campanha. `value` null = sem o dado: a tela mostra "—", nunca 0. */
export type ObjectiveResult = { label: string; value: number | null };

/** Resultado principal do objetivo: sempre o tipo que a campanha busca, nunca compras numa campanha de leads. */
export function objectiveResult(raw: string | null | undefined, t: ResultInput): ObjectiveResult {
  switch (objectiveKey(raw)) {
    case "sales":
      return { label: "compras", value: t.conversions };
    case "leads":
      return { label: "leads", value: t.leads };
    case "engagement":
      return { label: "interações", value: t.postEngagement };
    case "traffic":
      return t.linkClicks != null ? { label: "cliques no link", value: t.linkClicks } : { label: "cliques", value: t.clicks };
    case "awareness":
      return { label: "impressões", value: t.impressions };
  }
  // objetivo que o VYZ não conhece: compras, se houver; sem nenhuma, não dá para dizer qual seria o resultado
  return t.conversions > 0 ? { label: "compras", value: t.conversions } : { label: "resultados", value: null };
}

/** "cliques no link" → "Cliques no link". */
export const resultTitle = (label: string) => `${label[0].toUpperCase()}${label.slice(1)}`;
