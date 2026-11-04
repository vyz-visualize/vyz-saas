// Métricas novas do Personalizar nos dashboards com dados reais: de onde vem cada
// uma, como é calculada e o texto que explica. Cards e tabelas leem daqui.
//
//   * Meta: contagens por anúncio vêm da soma de insights_ad_daily; página de destino,
//     carrinho e checkout vêm das linhas por campanha/conta, que já têm esses totais.
//   * Google: das campanhas. Performance Max e Shopping não têm linha de anúncio.
//   * Custo de vídeo usa só o investimento de vídeo. Tempo médio é segundos ÷ reproduções.

import type { MetricGroup } from "@/features/dashboards/metric-prefs";
import { metricById, sumsOf } from "./creatives/metrics";
import type { AdDayRow, CampaignDayRow, MetricRow, ValueFormat } from "./types";

export type Better = "up" | "down" | "neutral";

type Base = { id: string; label: string; group: MetricGroup; help: string; format: ValueFormat; better: Better; spendDerived?: boolean };
export type RowMetric = Base & { source: "rows"; value: (rows: readonly Pick<MetricRow, "spend" | "linkClicks" | "landingPageViews" | "addToCart" | "initiateCheckout">[]) => number | null };
export type AdMetric = Base & { source: "ads"; value: (rows: readonly AdDayRow[]) => number | null };
export type MetaExtra = RowMetric | AdMetric;
export type GoogleExtra = Base & { value: (rows: readonly CampaignDayRow[], isVideo: (campaignId: string) => boolean) => number | null };

const per = (a: number | null, b: number | null) => (a == null || b == null || b <= 0 ? null : a / b);
function total<T>(rows: readonly T[], pick: (r: T) => number | null | undefined): number | null {
  let any = false;
  let sum = 0;
  for (const r of rows) {
    const v = pick(r);
    if (v == null) continue;
    any = true;
    sum += Number(v);
  }
  return any ? sum : null;
}
const spendOf = (rows: readonly { spend: number | null }[]) => total(rows, (r) => r.spend);

/** Métrica que já existe por anúncio: mesma conta do comparativo. */
function fromAds(id: string, group: MetricGroup, help: string, label?: string): AdMetric {
  const metric = metricById(id);
  if (!metric) throw new Error(`Métrica de anúncio desconhecida: ${id}`);
  return {
    source: "ads",
    id,
    label: label ?? metric.label,
    group,
    help,
    format: metric.format,
    better: metric.better ?? "neutral",
    spendDerived: metric.spendDerived,
    value: (rows) => metric.value(sumsOf(rows)),
  };
}

export const META_EXTRA_METRICS: MetaExtra[] = [
  { source: "rows", id: "landingPageViews", label: "Visualizações da página de destino", group: "conversoes", format: "int", better: "up", help: "Vezes em que a página abriu depois do clique no anúncio.", value: (r) => total(r, (x) => x.landingPageViews) },
  { source: "rows", id: "initiateCheckout", label: "Iniciar checkout", group: "conversoes", format: "int", better: "up", help: "Quantas vezes começaram a finalizar a compra. Um só evento da Meta, sem contar em dobro.", value: (r) => total(r, (x) => x.initiateCheckout) },
  fromAds("leads", "conversoes", "Contatos gerados pelos anúncios. Um só evento da Meta (lead), que já reúne site e formulários."),
  fromAds("registrations", "conversoes", "Cadastros concluídos. Um só evento da Meta, sem contar em dobro."),
  { source: "rows", id: "cpcLink", label: "CPC do link", group: "custos", format: "money", better: "down", spendDerived: true, help: "Custo por clique no link = investimento ÷ cliques no link.", value: (r) => per(spendOf(r), total(r, (x) => x.linkClicks)) },
  { source: "rows", id: "costPerAddToCart", label: "Custo por carrinho", group: "custos", format: "money", better: "down", spendDerived: true, help: "Investimento ÷ vezes em que adicionaram ao carrinho.", value: (r) => per(spendOf(r), total(r, (x) => x.addToCart)) },
  { source: "rows", id: "costPerCheckout", label: "Custo por checkout", group: "custos", format: "money", better: "down", spendDerived: true, help: "Investimento ÷ checkouts iniciados.", value: (r) => per(spendOf(r), total(r, (x) => x.initiateCheckout)) },
  fromAds("cpl", "custos", "Investimento ÷ leads."),
  fromAds("costPerRegistration", "custos", "Investimento ÷ cadastros."),
  fromAds("costPerThruplay", "custos", "Investimento só dos anúncios de vídeo ÷ ThruPlays. O gasto de quem não é vídeo não entra."),
  fromAds("videoViews", "video", "Vezes em que o vídeo foi assistido por pelo menos 3 segundos."),
  fromAds("thruplays", "video", "Vezes em que o vídeo foi assistido até o fim ou por pelo menos 15 segundos."),
  fromAds("p25", "video", "Reproduções que chegaram a 25% do vídeo."),
  fromAds("p50", "video", "Reproduções que chegaram a 50% do vídeo."),
  fromAds("p75", "video", "Reproduções que chegaram a 75% do vídeo."),
  fromAds("p95", "video", "Reproduções que chegaram a 95% do vídeo."),
  fromAds("p100", "video", "Reproduções que chegaram ao fim do vídeo."),
  fromAds("avgWatch", "video", "Segundos totais assistidos ÷ reproduções. Não é média de médias."),
  fromAds("engagement", "engajamento", "Total de interações com o post, como reações, comentários e compartilhamentos."),
  fromAds("reactions", "engajamento", "Curtidas e outras reações no post."),
  fromAds("comments", "engajamento", "Comentários no post."),
  fromAds("shares", "engajamento", "Vezes em que o post foi compartilhado."),
  fromAds("saves", "engajamento", "Vezes em que o post foi salvo."),
];

/** Já existia como coluna: como card, entra com a mesma definição nos dados reais e nas amostras. */
export const ADD_TO_CART_METRIC: RowMetric = { source: "rows", id: "addToCart", label: "Adicionar ao carrinho", group: "conversoes", format: "int", better: "up", help: "Quantas vezes adicionaram produto ao carrinho. Um só evento da Meta, sem contar em dobro.", value: (r) => total(r, (x) => x.addToCart) };

/** Ids de Resultados: dependem do objetivo de cada campanha (aggregate.ts). */
export const RESULT_METRICS = [
  { id: "results", label: "Resultados", group: "conversoes" as const, format: "int" as const, better: "up" as const, help: "O resultado principal do objetivo de cada campanha: compras em vendas, leads em geração de leads, interações em engajamento. Como card, só com um tipo de resultado no período." },
  { id: "costPerResult", label: "Custo por resultado", group: "custos" as const, format: "money" as const, better: "down" as const, spendDerived: true, help: "Investimento ÷ resultados. Como card, só com um tipo de resultado no período." },
];

export const RESULTS_MIXED_REASON = "tipos de resultado diferentes no período";

const videoOnly = (rows: readonly CampaignDayRow[], isVideo: (id: string) => boolean) => rows.filter((r) => isVideo(r.campaignId));

/** Média ponderada pelas impressões, só nas linhas que têm o dado (campanhas de pesquisa). */
function weightedByImpressions(rows: readonly CampaignDayRow[], pick: (r: CampaignDayRow) => number | null | undefined): number | null {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    const v = pick(r);
    if (v == null) continue;
    num += v * r.impressions;
    den += r.impressions;
  }
  return den > 0 ? num / den : null;
}

/** Perda de parcela: pondera pelas impressões elegíveis (impressões ÷ parcela), como a parcela de impressões. */
function lostShare(rows: readonly CampaignDayRow[], pick: (r: CampaignDayRow) => number | null): number | null {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    const v = pick(r);
    if (v == null || !r.searchImpressionShare) continue;
    const eligible = r.impressions / r.searchImpressionShare;
    num += v * eligible;
    den += eligible;
  }
  return den > 0 ? num / den : null;
}

export const GOOGLE_EXTRA_METRICS: GoogleExtra[] = [
  { id: "interactions", label: "Interações", group: "gerais", format: "int", better: "up", help: "Cliques e outras ações principais do anúncio, como visualizações de vídeo.", value: (r) => total(r, (x) => x.interactions) },
  { id: "allConversions", label: "Todas as conversões", group: "conversoes", format: "decimal", better: "up", help: "Inclui as conversões que ficam fora da coluna Conversões.", value: (r) => total(r, (x) => x.allConversions) },
  { id: "cpv", label: "CPV", group: "custos", format: "money", better: "down", spendDerived: true, help: "Custo por visualização = custo só das campanhas de vídeo ÷ visualizações.", value: (r, isVideo) => { const v = videoOnly(r, isVideo); return per(spendOf(v), total(v, (x) => x.videoViews)); } },
  { id: "convRate", label: "Taxa de conversão", group: "taxas", format: "pct", better: "up", help: "Conversões ÷ interações.", value: (r) => per(total(r, (x) => x.conversions), total(r, (x) => x.interactions)) },
  { id: "lostBudget", label: "Parcela perdida por orçamento", group: "taxas", format: "pct", better: "down", help: "Só nas campanhas de pesquisa: impressões perdidas por falta de orçamento, ponderadas pelas impressões elegíveis.", value: (r) => lostShare(r, (x) => x.searchLostIsBudget) },
  { id: "lostRank", label: "Parcela perdida por classificação", group: "taxas", format: "pct", better: "down", help: "Só nas campanhas de pesquisa: impressões perdidas por classificação do anúncio, ponderadas pelas impressões elegíveis.", value: (r) => lostShare(r, (x) => x.searchLostIsRank) },
  { id: "topPct", label: "% de impressões no topo", group: "taxas", format: "pct", better: "up", help: "Só nas campanhas de pesquisa: impressões acima dos resultados orgânicos, ponderadas pelas impressões.", value: (r) => weightedByImpressions(r, (x) => x.topImpressionPct) },
  { id: "absoluteTopPct", label: "% no topo absoluto", group: "taxas", format: "pct", better: "up", help: "Só nas campanhas de pesquisa: impressões na primeira posição, ponderadas pelas impressões.", value: (r) => weightedByImpressions(r, (x) => x.absoluteTopImpressionPct) },
  { id: "videoViews", label: "Visualizações de vídeo", group: "video", format: "int", better: "up", help: "Visualizações nas campanhas de vídeo.", value: (r, isVideo) => total(videoOnly(r, isVideo), (x) => x.videoViews) },
  { id: "viewRate", label: "Taxa de visualização", group: "video", format: "pct", better: "up", help: "Visualizações ÷ impressões, só nas campanhas de vídeo.", value: (r, isVideo) => { const v = videoOnly(r, isVideo); return per(total(v, (x) => x.videoViews), total(v, (x) => x.impressions)); } },
];

/** Ids de custo: a regra do investimento oculto sai daqui, então custo novo já nasce coberto. */
export const EXTRA_SPEND_FIELDS: string[] = [...META_EXTRA_METRICS, ...RESULT_METRICS, ...GOOGLE_EXTRA_METRICS].flatMap((m) => (m.spendDerived ? [m.id] : []));
