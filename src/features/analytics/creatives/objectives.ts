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

/** Resultado principal do objetivo. Sem o dado do objetivo, cai no que a campanha tem. */
export function objectiveResult(raw: string | null | undefined, t: ResultInput): { label: string; value: number } {
  switch (objectiveKey(raw)) {
    case "leads":
      if (t.leads != null) return { label: "leads", value: t.leads };
      break;
    case "engagement":
      if (t.postEngagement != null) return { label: "engajamentos", value: t.postEngagement };
      break;
    case "traffic":
      return t.linkClicks != null ? { label: "cliques no link", value: t.linkClicks } : { label: "cliques", value: t.clicks };
    case "awareness":
      return { label: "impressões", value: t.impressions };
  }
  return { label: "compras", value: t.conversions };
}
