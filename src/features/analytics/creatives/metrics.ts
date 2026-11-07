// Métricas por anúncio: a soma dos dias e a conta de cada métrica. Fonte única do
// comparativo e dos cards e tabelas do Personalizar. Tempo médio = segundos totais ÷
// reproduções, e custo por ThruPlay só com o investimento dos dias com vídeo.

import type { CompareAd, ValueFormat } from "../types";

export type CompareGroup = "delivery" | "clicks" | "video" | "engagement";
type Day = Partial<CompareAd["days"][number]> & Pick<CompareAd["days"][number], "impressions" | "clicks">;

export type Sums = {
  days: number;
  spend: number | null;
  /** Só o investimento dos dias com vídeo: custo por ThruPlay não leva o gasto de quem não é vídeo. */
  videoSpend: number | null;
  impressions: number;
  /** Soma do alcance diário e quantos dias têm alcance: dá a média por dia, nunca pessoas únicas. */
  reachSum: number | null;
  reachDays: number;
  clicks: number;
  linkClicks: number | null;
  conversions: number;
  value: number | null;
  videoViews: number | null;
  thruplays: number | null;
  leads: number | null;
  registrations: number | null;
  engagement: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  profileVisits: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p95: number | null;
  p100: number | null;
  watchSeconds: number | null;
};

function sumOf(days: readonly Day[], pick: (d: Day) => number | null | undefined): number | null {
  let any = false;
  let total = 0;
  for (const d of days) {
    const v = pick(d);
    if (v == null) continue;
    any = true;
    total += Number(v);
  }
  return any ? total : null;
}

export function sumsOf(days: readonly Day[]): Sums {
  return {
    days: days.length,
    spend: sumOf(days, (d) => d.spend),
    videoSpend: sumOf(
      days.filter((d) => d.videoViews != null),
      (d) => d.spend,
    ),
    impressions: sumOf(days, (d) => d.impressions) ?? 0,
    reachSum: sumOf(days, (d) => d.reach),
    reachDays: days.filter((d) => d.reach != null).length,
    clicks: sumOf(days, (d) => d.clicks) ?? 0,
    linkClicks: sumOf(days, (d) => d.linkClicks),
    conversions: sumOf(days, (d) => d.conversions) ?? 0,
    value: sumOf(days, (d) => d.conversionValue),
    videoViews: sumOf(days, (d) => d.videoViews),
    thruplays: sumOf(days, (d) => d.videoThruplays),
    leads: sumOf(days, (d) => d.leads),
    registrations: sumOf(days, (d) => d.registrations),
    engagement: sumOf(days, (d) => d.postEngagement),
    reactions: sumOf(days, (d) => d.postReactions),
    comments: sumOf(days, (d) => d.postComments),
    shares: sumOf(days, (d) => d.postShares),
    saves: sumOf(days, (d) => d.postSaves),
    profileVisits: sumOf(days, (d) => d.profileVisits),
    p25: sumOf(days, (d) => d.videoP25),
    p50: sumOf(days, (d) => d.videoP50),
    p75: sumOf(days, (d) => d.videoP75),
    p95: sumOf(days, (d) => d.videoP95),
    p100: sumOf(days, (d) => d.videoP100),
    watchSeconds: sumOf(days, (d) => d.videoWatchSeconds),
  };
}

const per = (a: number | null, b: number | null) => (a == null || b == null || b <= 0 ? null : a / b);

export type CompareMetric = {
  id: string;
  label: string;
  group: CompareGroup;
  format: ValueFormat;
  /** "down" = menor é melhor; null = sem vencedor (depende do plano de mídia). */
  better: "up" | "down" | null;
  /** Soma entre dias: em "Média/dia", divide pelos dias de veiculação. */
  additive: boolean;
  /** O investimento dá para recalcular a partir dela: some no link com investimento oculto. */
  spendDerived?: boolean;
  value: (s: Sums) => number | null;
  /** Explicação ao passar o mouse. */
  help?: string;
};

/** Explicação da Retenção 3 s, na galeria e no comparativo. */
export const RETENTION_HELP = "% de quem assistiu pelo menos 3 segundos";

/** Explicação da Retenção até o fim (ThruPlays ÷ reproduções de 3 s), no comparativo. */
export const RETENTION_END_HELP = "Das pessoas que assistiram 3 segundos, quantas foram até o fim do vídeo (ou até 15 segundos, nos vídeos mais longos)";

const count = (id: string, label: string, group: CompareGroup, value: (s: Sums) => number | null): CompareMetric => ({ id, label, group, format: "int", better: "up", additive: true, value });
const rate = (id: string, label: string, group: CompareGroup, value: (s: Sums) => number | null): CompareMetric => ({ id, label, group, format: "pct", better: "up", additive: false, value });
const cost = (id: string, label: string, group: CompareGroup, value: (s: Sums) => number | null): CompareMetric => ({ id, label, group, format: "money", better: "down", additive: false, spendDerived: true, value });

export const COMPARE_METRICS: CompareMetric[] = [
  { id: "spend", label: "Investimento", group: "delivery", format: "money", better: null, additive: true, spendDerived: true, value: (s) => s.spend },
  count("impressions", "Impressões", "delivery", (s) => s.impressions),
  { id: "reach", label: "Alcance médio por dia", group: "delivery", format: "int", better: "up", additive: false, value: (s) => per(s.reachSum, s.reachDays) },
  { id: "frequency", label: "Frequência média por dia", group: "delivery", format: "decimal", better: null, additive: false, value: (s) => per(s.impressions, s.reachSum) },
  cost("cpm", "CPM", "delivery", (s) => (s.spend == null || s.impressions <= 0 ? null : (s.spend / s.impressions) * 1000)),

  count("clicks", "Cliques (todos)", "clicks", (s) => s.clicks),
  count("linkClicks", "Cliques no link", "clicks", (s) => s.linkClicks),
  rate("ctr", "CTR (todos)", "clicks", (s) => per(s.clicks, s.impressions)),
  rate("linkCtr", "CTR do link", "clicks", (s) => per(s.linkClicks, s.impressions)),
  cost("cpc", "CPC (todos)", "clicks", (s) => per(s.spend, s.clicks)),
  cost("cpcLink", "CPC do link", "clicks", (s) => per(s.spend, s.linkClicks)),
  count("conversions", "Compras", "clicks", (s) => s.conversions),
  cost("cpa", "Custo por compra", "clicks", (s) => per(s.spend, s.conversions)),
  { id: "value", label: "Valor de conversão", group: "clicks", format: "money", better: "up", additive: true, value: (s) => s.value },
  { id: "roas", label: "ROAS", group: "clicks", format: "ratio", better: "up", additive: false, spendDerived: true, value: (s) => per(s.value, s.spend) },
  rate("convRate", "Conversão do clique", "clicks", (s) => per(s.conversions, s.linkClicks)),
  count("leads", "Leads", "clicks", (s) => s.leads),
  cost("cpl", "Custo por lead", "clicks", (s) => per(s.spend, s.leads)),
  count("registrations", "Cadastros", "clicks", (s) => s.registrations),
  cost("costPerRegistration", "Custo por cadastro", "clicks", (s) => per(s.spend, s.registrations)),

  count("videoViews", "Reproduções de 3 s", "video", (s) => s.videoViews),
  count("thruplays", "ThruPlays", "video", (s) => s.thruplays),
  { ...rate("hookRate", "Retenção 3 s", "video", (s) => per(s.videoViews, s.impressions)), help: RETENTION_HELP },
  { ...rate("holdRate", "Retenção até o fim", "video", (s) => per(s.thruplays, s.videoViews)), help: RETENTION_END_HELP },
  cost("costPerThruplay", "Custo por ThruPlay", "video", (s) => per(s.videoSpend, s.thruplays)),
  count("p25", "Vídeo até 25%", "video", (s) => s.p25),
  count("p50", "Vídeo até 50%", "video", (s) => s.p50),
  count("p75", "Vídeo até 75%", "video", (s) => s.p75),
  count("p95", "Vídeo até 95%", "video", (s) => s.p95),
  count("p100", "Vídeo até 100%", "video", (s) => s.p100),
  { id: "avgWatch", label: "Tempo médio de reprodução", group: "video", format: "seconds", better: "up", additive: false, value: (s) => per(s.watchSeconds, s.videoViews) },
  count("profileVisits", "Visitas ao perfil", "video", (s) => s.profileVisits),

  count("engagement", "Engajamento no post", "engagement", (s) => s.engagement),
  rate("engagementRate", "Taxa de engajamento", "engagement", (s) => per(s.engagement, s.impressions)),
  count("reactions", "Reações", "engagement", (s) => s.reactions),
  count("comments", "Comentários", "engagement", (s) => s.comments),
  count("shares", "Compartilhamentos", "engagement", (s) => s.shares),
  count("saves", "Salvamentos", "engagement", (s) => s.saves),
  cost("costPerEngagement", "Custo por engajamento", "engagement", (s) => (s.engagement == null ? null : per(s.spend, s.engagement))),
];

export const metricById = (id: string) => COMPARE_METRICS.find((m) => m.id === id);

