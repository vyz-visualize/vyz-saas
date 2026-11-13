// Definições de métrica: rótulo, formato e se "maior é melhor". Os rótulos de
// conversão mudam com o perfil do negócio (venda, matrícula, agendamento...).

import { brl, brlCompact, decimal, int, pct } from "@/lib/format";

export type Profile =
  | "ecommerce"
  | "leads"
  | "imob"
  | "local"
  | "midia"
  | "pesquisa"
  | "site"
  | "infoproduto"
  | "agencia"
  | "marketplace"
  | "saude"
  | "educacao"
  | "video"
  | "executivo";

export type MetricId =
  | "spend"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpc"
  | "cpm"
  | "conversions"
  | "cpa"
  | "revenue"
  | "roas"
  | "ticket"
  | "leads"
  | "cpl"
  | "qualified"
  | "cplq"
  | "visits"
  | "calls"
  | "sessions"
  | "convRate"
  | "views"
  | "cpv"
  | "viewRate"
  | "frequency";

export type Format = "brl" | "brlCompact" | "int" | "pct" | "decimal";

export type MetricDef = { id: MetricId; label: string; format: Format; better: "up" | "down" | "neutral"; help?: string };

/** Vocabulário de conversão por perfil. */
/** Objetivos de venda: o resultado é a venda, e receita e ROAS fazem sentido. Nos outros, o resultado do objetivo (lead, agendamento...). */
export const SALES_PROFILES: readonly Profile[] = ["ecommerce", "marketplace", "executivo", "site", "infoproduto"];
export const isSalesProfile = (profile: Profile) => SALES_PROFILES.includes(profile);

export const VOCAB: Record<Profile, { conv: string; one: string; cpa: string }> = {
  ecommerce: { conv: "Vendas confirmadas", one: "venda", cpa: "Custo por venda" },
  marketplace: { conv: "Vendas", one: "venda", cpa: "Custo por venda" },
  executivo: { conv: "Vendas confirmadas", one: "venda", cpa: "Custo por venda" },
  site: { conv: "Compras", one: "compra", cpa: "Custo por compra" },
  infoproduto: { conv: "Vendas", one: "venda", cpa: "Custo por venda" },
  leads: { conv: "Leads", one: "lead", cpa: "Custo por lead" },
  imob: { conv: "Leads qualificados", one: "lead", cpa: "Custo por lead qualificado" },
  local: { conv: "Conversas no WhatsApp", one: "conversa", cpa: "Custo por conversa" },
  midia: { conv: "Resultados", one: "resultado", cpa: "Custo por resultado" },
  pesquisa: { conv: "Conversões", one: "conversão", cpa: "Custo por conversão" },
  agencia: { conv: "Conversões", one: "conversão", cpa: "CPA médio" },
  saude: { conv: "Agendamentos", one: "agendamento", cpa: "Custo por agendamento" },
  educacao: { conv: "Matrículas", one: "matrícula", cpa: "Custo por matrícula" },
  video: { conv: "Visualizações", one: "visualização", cpa: "Custo por visualização" },
};

const BASE: Record<MetricId, MetricDef> = {
  spend: { id: "spend", label: "Investimento", format: "brlCompact", better: "neutral" },
  impressions: { id: "impressions", label: "Impressões", format: "int", better: "up" },
  clicks: { id: "clicks", label: "Cliques", format: "int", better: "up" },
  ctr: { id: "ctr", label: "CTR", format: "pct", better: "up", help: "Cliques ÷ impressões do período inteiro, não média de médias." },
  cpc: { id: "cpc", label: "CPC", format: "brl", better: "down" },
  cpm: { id: "cpm", label: "CPM", format: "brl", better: "down" },
  conversions: { id: "conversions", label: "Conversões", format: "int", better: "up", help: "Confirmadas na fonte de verdade (GA4 ou CRM), sem dupla contagem." },
  cpa: { id: "cpa", label: "CPA", format: "brl", better: "down" },
  revenue: { id: "revenue", label: "Receita", format: "brlCompact", better: "up" },
  roas: { id: "roas", label: "ROAS", format: "decimal", better: "up", help: "Receita ÷ investimento. Equilíbrio = 1 ÷ margem." },
  ticket: { id: "ticket", label: "Ticket médio", format: "brl", better: "up" },
  leads: { id: "leads", label: "Leads", format: "int", better: "up" },
  cpl: { id: "cpl", label: "Custo por lead", format: "brl", better: "down" },
  qualified: { id: "qualified", label: "Leads qualificados", format: "int", better: "up" },
  cplq: { id: "cplq", label: "Custo por lead qualificado", format: "brl", better: "down" },
  visits: { id: "visits", label: "Visitas agendadas", format: "int", better: "up" },
  calls: { id: "calls", label: "Ligações", format: "int", better: "up" },
  sessions: { id: "sessions", label: "Sessões", format: "int", better: "up" },
  convRate: { id: "convRate", label: "Taxa de conversão", format: "pct", better: "up" },
  views: { id: "views", label: "Visualizações", format: "int", better: "up" },
  cpv: { id: "cpv", label: "Custo por visualização", format: "brl", better: "down" },
  viewRate: { id: "viewRate", label: "Taxa de visualização", format: "pct", better: "up" },
  frequency: { id: "frequency", label: "Frequência média por dia", format: "decimal", better: "neutral" },
};

/** Definição da métrica com o rótulo do perfil (ex.: conversões → "Matrículas"). */
export function metric(id: MetricId, profile: Profile): MetricDef {
  const def = BASE[id];
  const v = VOCAB[profile];
  if (id === "conversions") return { ...def, label: v.conv };
  if (id === "cpa") return { ...def, label: v.cpa };
  return def;
}

export function formatValue(value: number, format: Format): string {
  if (!Number.isFinite(value)) return "—";
  switch (format) {
    case "brl":
      return brl(value);
    case "brlCompact":
      return brlCompact(value);
    case "int":
      return int(value);
    case "pct":
      return pct(value, value < 0.1 ? 2 : 1);
    case "decimal":
      return decimal(value, 1);
  }
}

/** Variação boa ou ruim, segundo o sentido da métrica. */
export function isGood(delta: number, better: MetricDef["better"]): boolean | null {
  if (better === "neutral" || delta === 0) return null;
  return better === "up" ? delta > 0 : delta < 0;
}
