// Métricas que a pessoa escolhe para os cards de criativo (1 a 4, na ordem dela), por dashboard.
// Um catálogo só, agrupado (entrega, clique, vídeo, resultado), com a conta de cada uma a partir
// do criativo. Sem dado para aquele criativo: null (a tela mostra "—", nunca 0). As de vídeo só
// valem para criativo de vídeo. Puro: painel, link público e testes.

import type { Dataset } from "@/features/metrics/source";
import type { CreativeVM } from "../types";

export type CardMetricGroup = "entrega" | "clique" | "video" | "resultado";
export const CARD_GROUP_LABEL: Record<CardMetricGroup, string> = { entrega: "Entrega", clique: "Clique", video: "Vídeo", resultado: "Resultado" };
export const CARD_GROUPS: CardMetricGroup[] = ["entrega", "clique", "video", "resultado"];

/** O criativo como os cards leem: vem da galeria do servidor (dados reais e amostra) ou do conjunto do dashboard. */
export type CardCreative = {
  id: string;
  name: string;
  campaignName: string;
  format: string;
  video: boolean;
  thumbnailUrl: string | null;
  postUrl: string | null;
  status: string;
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  frequency: number | null;
  linkClicks: number | null;
  linkCtr: number | null;
  cpc: number | null;
  cpm: number | null;
  thruplays: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p100: number | null;
  hookRate: number | null;
  /** O resultado do objetivo da campanha (com o nome dele) e o custo de cada um. */
  result: { label: string; value: number | null };
  costPerResult: number | null;
  revenue: number | null;
  roas: number | null;
  /** CTR do link por dia (curva de vida) e o cansaço entre as metades do período, quando a galeria traz. */
  ctrSpark?: (number | null)[];
  fatigue?: { frequencyChange: number; ctrChange: number } | null;
  /** Moeda dos valores (a galeria do servidor vem em reais; o conjunto do dashboard, em centavos). */
  cents: boolean;
};

export type CardFormat = "money" | "int" | "pct" | "decimal";
export type CardMetric = { id: string; label: string; group: CardMetricGroup; format: CardFormat; help: string; videoOnly?: boolean; spendDerived?: boolean; value: (c: CardCreative) => number | null };

const div = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null && b > 0 ? a / b : null);

export const CARD_METRICS: CardMetric[] = [
  { id: "spend", label: "Investimento", group: "entrega", format: "money", spendDerived: true, help: "Quanto o criativo gastou no período.", value: (c) => c.spend },
  { id: "impressions", label: "Impressões", group: "entrega", format: "int", help: "Quantas vezes o anúncio apareceu.", value: (c) => c.impressions },
  { id: "reach", label: "Alcance (soma dos dias)", group: "entrega", format: "int", help: "Pessoas alcançadas em cada dia, somadas: a mesma pessoa conta em dias diferentes.", value: (c) => c.reach },
  { id: "frequency", label: "Frequência", group: "entrega", format: "decimal", help: "Impressões por pessoa alcançada, dia a dia.", value: (c) => c.frequency },
  { id: "cpm", label: "CPM", group: "entrega", format: "money", spendDerived: true, help: "Custo por mil impressões.", value: (c) => c.cpm },
  { id: "linkClicks", label: "Cliques no link", group: "clique", format: "int", help: "Cliques que levam para fora do anúncio.", value: (c) => c.linkClicks },
  { id: "linkCtr", label: "CTR (link)", group: "clique", format: "pct", help: "Cliques no link por impressão.", value: (c) => c.linkCtr },
  { id: "cpc", label: "CPC", group: "clique", format: "money", spendDerived: true, help: "Investimento por clique no link.", value: (c) => c.cpc },
  { id: "thruplays", label: "ThruPlays", group: "video", format: "int", videoOnly: true, help: "Vídeos assistidos até o fim (ou 15 s).", value: (c) => c.thruplays },
  { id: "p25", label: "Retenção 25%", group: "video", format: "pct", videoOnly: true, help: "Parte de quem viu 3 s que chegou a 25% do vídeo.", value: (c) => c.p25 },
  { id: "p50", label: "Retenção 50%", group: "video", format: "pct", videoOnly: true, help: "Parte de quem viu 3 s que chegou à metade do vídeo.", value: (c) => c.p50 },
  { id: "p75", label: "Retenção 75%", group: "video", format: "pct", videoOnly: true, help: "Parte de quem viu 3 s que chegou a 75% do vídeo.", value: (c) => c.p75 },
  { id: "p100", label: "Retenção 100%", group: "video", format: "pct", videoOnly: true, help: "Parte de quem viu 3 s que chegou ao fim do vídeo.", value: (c) => c.p100 },
  { id: "hookRate", label: "Hook rate (3 s)", group: "video", format: "pct", videoOnly: true, help: "Visualizações de 3 s por impressão.", value: (c) => c.hookRate },
  { id: "result", label: "Resultado", group: "resultado", format: "int", help: "O resultado principal do objetivo da campanha (vendas, leads, conversas…).", value: (c) => c.result.value },
  { id: "costPerResult", label: "Custo por resultado", group: "resultado", format: "money", spendDerived: true, help: "Investimento por resultado. Sem resultado, fica em branco.", value: (c) => (c.result.value ? div(c.spend, c.result.value) : null) },
  { id: "convRate", label: "Taxa de conversão", group: "resultado", format: "pct", help: "Resultados por clique no link.", value: (c) => div(c.result.value, c.linkClicks) },
  { id: "revenue", label: "Receita", group: "resultado", format: "money", help: "Valor das compras atribuídas ao criativo.", value: (c) => c.revenue },
  { id: "roas", label: "ROAS", group: "resultado", format: "decimal", spendDerived: true, help: "Receita por real investido.", value: (c) => c.roas },
];

const BY_ID = new Map(CARD_METRICS.map((m) => [m.id, m]));
export const cardMetric = (id: string) => BY_ID.get(id);

export const CARD_MIN = 1;
export const CARD_MAX = 4;

/** O padrão de cada visual (antes de a pessoa mexer). */
export const CARD_DEFAULTS: Record<string, string[]> = {
  pulso: ["costPerResult", "linkCtr", "frequency"],
  noturno: ["result", "roas", "frequency"],
  areia: ["result", "costPerResult", "convRate"],
  fachada: ["result", "costPerResult", "linkCtr"],
  lavanda: ["result", "spend", "linkCtr"],
};
export const cardDefaults = (skin: string | undefined) => CARD_DEFAULTS[skin ?? ""] ?? ["result", "costPerResult", "linkCtr"];

/** A escolha salva, limpa: só ids do catálogo, sem repetir, de 1 a 4. Sem escolha válida, o padrão do visual. */
export function cardIds(saved: readonly string[] | undefined, skin: string | undefined, opts: { hideSpend?: boolean } = {}): string[] {
  const ok = (id: string) => BY_ID.has(id) && !(opts.hideSpend && BY_ID.get(id)!.spendDerived);
  const clean = [...new Set(saved ?? [])].filter(ok).slice(0, CARD_MAX);
  if (clean.length >= CARD_MIN) return clean;
  return cardDefaults(skin).filter(ok);
}

/** O nome que o card mostra: o resultado leva o nome do objetivo da campanha ("Leads", "Compras"). */
export function cardLabel(m: CardMetric, c?: CardCreative): string {
  if (!c) return m.label;
  const word = c.result.label ? c.result.label.charAt(0).toUpperCase() + c.result.label.slice(1) : m.label;
  if (m.id === "result") return word;
  if (m.id === "costPerResult" && c.result.label) return `Custo por ${singular(c.result.label)}`;
  return m.label;
}
function singular(label: string): string {
  const l = label.toLowerCase();
  if (l.endsWith("ões")) return `${l.slice(0, -3)}ão`;
  if (l.endsWith("s")) return l.slice(0, -1);
  return l;
}

/** Rótulo curto do card (cabe na coluna); o nome completo vai no tooltip e no detalhe. */
const SHORT: Record<string, string> = {
  spend: "Invest.",
  impressions: "Impressões",
  reach: "Alcance",
  frequency: "Freq.",
  cpm: "CPM",
  linkClicks: "Cliques",
  linkCtr: "CTR",
  cpc: "CPC",
  thruplays: "ThruPlays",
  p25: "Ret. 25%",
  p50: "Ret. 50%",
  p75: "Ret. 75%",
  p100: "Ret. 100%",
  hookRate: "Hook 3 s",
  convRate: "Conv. %",
  revenue: "Receita",
  roas: "ROAS",
};
/** Custo por resultado, curto, pelo resultado do objetivo: CPA (compra), CPL (lead), Custo/conversa. */
const COST_SHORT: [RegExp, string][] = [
  [/compra|venda|matr[íi]cula/i, "CPA"],
  [/lead/i, "CPL"],
  [/conversa/i, "Custo/conversa"],
  [/agendamento/i, "Custo/agend."],
];
export function cardShort(m: CardMetric, c?: CardCreative): string {
  const label = c?.result.label ?? "";
  if (m.id === "result") {
    const first = label.split(" ")[0] ?? "";
    return first ? first.charAt(0).toUpperCase() + first.slice(1) : "Resultado";
  }
  if (m.id === "costPerResult") return COST_SHORT.find(([re]) => re.test(label))?.[1] ?? "Custo/result.";
  return SHORT[m.id] ?? m.label;
}

/** As métricas do card deste criativo: as de vídeo saem do card de imagem. */
export const metricsFor = (ids: readonly string[], c: CardCreative) => ids.map((id) => BY_ID.get(id)).filter((m): m is CardMetric => !!m && !(m.videoOnly && !c.video));

/** O valor formatado ("—" sem dado). */
export function formatCard(m: CardMetric, c: CardCreative, fmt: { money: (v: number) => string; int: (v: number) => string; pct: (v: number) => string; decimal: (v: number) => string }): string {
  const v = m.value(c);
  if (v == null || !Number.isFinite(v)) return "—";
  return fmt[m.format](v);
}

// ---- de onde vêm os criativos -------------------------------------------------------------------

const isVideo = (format: string) => /v[íi]deo|reels|video/i.test(format);

/** Da galeria do servidor (valores em reais). */
export function fromGallery(list: readonly CreativeVM[]): CardCreative[] {
  return list.map((c) => ({
    id: c.id,
    name: c.name,
    campaignName: c.campaignName,
    format: c.format,
    video: isVideo(c.format) || c.hookRate != null,
    thumbnailUrl: c.thumbnailUrl,
    postUrl: c.postUrl ?? null,
    status: c.status,
    spend: c.spend,
    impressions: c.raw?.impressions ?? null,
    reach: c.raw?.reach ?? null,
    frequency: c.frequency,
    linkClicks: c.raw?.linkClicks ?? null,
    linkCtr: c.linkCtr,
    cpc: c.raw?.cpc ?? null,
    cpm: c.raw?.cpm ?? null,
    thruplays: c.raw?.thruplays ?? null,
    p25: c.raw?.p25 ?? null,
    p50: c.raw?.p50 ?? null,
    p75: c.raw?.p75 ?? null,
    p100: c.raw?.p100 ?? null,
    hookRate: c.hookRate,
    result: c.result,
    costPerResult: c.costPerResult,
    revenue: c.hasRevenue ? c.value : null,
    roas: c.hasRevenue ? c.roas : null,
    ctrSpark: c.ctrSpark,
    fatigue: c.fatigue,
    cents: false,
  }));
}

/** Do conjunto do dashboard (centavos), quando não há a galeria do servidor (amostra, miniatura). */
export function fromDataset(ds: Pick<Dataset, "creatives">, resultLabel: string): CardCreative[] {
  return ds.creatives.map((c) => {
    const v = c.video;
    return {
      id: c.id,
      name: c.name,
      campaignName: "",
      format: c.format,
      video: isVideo(c.format) || !!v,
      thumbnailUrl: c.imageUrl ?? null,
      postUrl: c.postUrl ?? null,
      status: "active",
      spend: c.spend,
      impressions: c.impressions,
      reach: null,
      frequency: c.frequency || null,
      linkClicks: c.clicks,
      linkCtr: div(c.clicks, c.impressions),
      cpc: div(c.spend, c.clicks),
      cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : null,
      thruplays: v ? v.p100 : null,
      p25: v ? div(v.p25, v.views) : null,
      p50: v ? div(v.p50, v.views) : null,
      p75: v ? div(v.p75, v.views) : null,
      p100: v ? div(v.p100, v.views) : null,
      hookRate: v ? div(v.views, c.impressions) : null,
      result: { label: resultLabel.toLowerCase(), value: c.conversions },
      costPerResult: c.conversions > 0 ? c.spend / c.conversions : null,
      // o conjunto do dashboard não tem a receita por criativo
      revenue: null,
      roas: null,
      cents: true,
    };
  });
}
