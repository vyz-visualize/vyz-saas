// Detalhes das páginas de plataforma: quebras (posicionamento, dispositivo, estado, hora),
// termos de pesquisa do Google e retenção dos vídeos. Os dados reais já chegam do armazém
// (insights_breakdown_daily, insights_search_term_daily, quartis do vídeo em insights_ad_daily);
// a amostra gera os mesmos formatos aqui, com uma semente própria (não mexe nos outros números
// do exemplo). Sem o detalhe no Dataset, o bloco mostra que o dado ainda não chegou.

import type { PlatformId } from "@/features/accounts/platforms";
import { BR_STATES, DEVICE_LABEL, PLACEMENT_LABEL } from "@/features/sync/breakdowns";
import { hash, rng } from "@/lib/random";
import type { Campaign, Creative, DayRow } from "./source";

export type DetailDimension = "placement" | "device" | "region" | "hour";

/** Uma linha de quebra no período (valores em centavos). */
export type BreakdownRow = { key: string; label: string; platform: PlatformId; spend: number; impressions: number; clicks: number; conversions: number; revenue: number };

/** Termo de pesquisa no período (valores em centavos). */
export type SearchTermRow = { term: string; matchType: string; campaign: string; spend: number; impressions: number; clicks: number; conversions: number; revenue: number };

/** Retenção de um vídeo: quantas pessoas chegaram a cada quarto (visualizações = início). */
export type VideoRetention = { views: number; p25: number; p50: number; p75: number; p100: number };

export type DatasetDetail = {
  breakdowns?: Partial<Record<DetailDimension, BreakdownRow[]>>;
  searchTerms?: SearchTermRow[];
};

export const MATCH_LABEL: Record<string, string> = { exact: "Exata", phrase: "Frase", broad: "Ampla", near_exact: "Exata (variação)", near_phrase: "Frase (variação)" };
export const matchLabel = (m: string) => MATCH_LABEL[m.toLowerCase()] ?? m;

// ---- amostra ----------------------------------------------------------------------------

const PLACEMENTS: [string, number][] = [
  ["instagram_reels", 1.3],
  ["instagram_feed", 1.1],
  ["instagram_stories", 0.9],
  ["facebook_feed", 0.8],
  ["facebook_reels", 0.45],
  ["instagram_explore", 0.25],
  ["audience_network", 0.18],
];
const META_DEVICES: [string, number][] = [["android", 1.2], ["iphone", 1], ["desktop", 0.18], ["tablet", 0.06]];
const GOOGLE_DEVICES: [string, number][] = [["mobile", 1.2], ["desktop", 0.7], ["tablet", 0.08], ["connected_tv", 0.05]];
const STATES: [string, number][] = [["SP", 1.6], ["RJ", 0.8], ["MG", 0.7], ["PR", 0.45], ["RS", 0.42], ["SC", 0.35], ["BA", 0.33], ["GO", 0.22], ["PE", 0.2], ["DF", 0.18]];
// pico à noite, vale de madrugada
const HOUR_WEIGHT = [0.25, 0.15, 0.1, 0.08, 0.08, 0.12, 0.25, 0.45, 0.65, 0.8, 0.9, 0.95, 1, 0.95, 0.9, 0.9, 0.95, 1, 1.1, 1.25, 1.35, 1.3, 1.05, 0.6];

const TERMS: Record<string, string[]> = {
  sales: [
    "loja verde",
    "loja verde site oficial",
    "comprar tênis de corrida",
    "tênis corrida feminino",
    "tênis corrida masculino promoção",
    "melhor tênis para correr",
    "tênis amortecimento",
    "tênis barato",
    "loja de tênis perto de mim",
    "tênis corrida frete grátis",
    "cupom loja verde",
    "tênis para academia",
    "como escolher tênis de corrida",
    "tênis corrida 42",
    "tênis de corrida vale a pena",
    "tênis corrida iniciante",
    "tênis trail",
    "tênis corrida black friday",
  ],
  leads: [
    "orçamento online",
    "empresa de confiança perto de mim",
    "quanto custa",
    "melhor empresa da região",
    "agendar avaliação",
    "preço consulta",
    "atendimento whatsapp",
    "avaliação gratuita",
    "como funciona",
    "telefone contato",
    "serviço emergencial",
    "empresa recomendada",
    "o que é melhor",
    "reclamação",
    "vaga de emprego",
    "curso grátis",
  ],
};
const MATCHES: [string, number][] = [["exact", 1], ["phrase", 0.8], ["broad", 1.1]];

/** Divide um total entre pesos com ruído. */
function split(r: ReturnType<typeof rng>, items: readonly [string, number][], noise = 0.3) {
  const w = items.map(([, x]) => x * r.range(1 - noise, 1 + noise));
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return items.map(([key], i) => ({ key, share: w[i] / sum, eff: r.range(0.6, 1.5) }));
}

type Totals = { spend: number; impressions: number; clicks: number; conversions: number; revenue: number };

function sumPlatform(rows: readonly DayRow[], id: PlatformId): Totals {
  const t = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
  const total = rows.reduce((a, d) => a + d.conversions, 0) || 1;
  const rev = rows.reduce((a, d) => a + d.revenue, 0);
  for (const d of rows) {
    const p = d.byPlatform[id];
    if (!p) continue;
    t.spend += p.spend;
    t.impressions += p.impressions;
    t.clicks += p.clicks;
    t.conversions += p.conv;
  }
  t.revenue = rev * Math.min(1, t.conversions / total);
  return t;
}

function breakdown(r: ReturnType<typeof rng>, items: readonly [string, number][], t: Totals, platform: PlatformId, label: (k: string) => string): BreakdownRow[] {
  const parts = split(r, items);
  const effSum = parts.reduce((a, p) => a + p.share * p.eff, 0) || 1;
  return parts.map((p) => {
    const conv = (t.conversions * p.share * p.eff) / effSum;
    return {
      key: p.key,
      label: label(p.key),
      platform,
      spend: Math.round(t.spend * p.share),
      impressions: Math.round(t.impressions * p.share * r.range(0.85, 1.15)),
      clicks: Math.round(t.clicks * p.share * r.range(0.8, 1.2)),
      conversions: Math.round(conv),
      revenue: Math.round(t.conversions ? (t.revenue * conv) / t.conversions : 0),
    };
  });
}

/** Detalhe de exemplo, na escala dos números do exemplo (mesmos totais por plataforma). */
export function sampleDetail(seed: string, current: readonly DayRow[], adPlatforms: readonly PlatformId[], campaigns: readonly Campaign[], sales: boolean): DatasetDetail {
  const r = rng(hash(`${seed}|detalhe`));
  const out: DatasetDetail = { breakdowns: {} };
  const b = out.breakdowns!;
  b.placement = [];
  b.device = [];
  b.region = [];
  b.hour = [];
  for (const id of adPlatforms) {
    const t = sumPlatform(current, id);
    if (!t.spend) continue;
    if (id === "meta") b.placement.push(...breakdown(r, PLACEMENTS, t, id, (k) => PLACEMENT_LABEL[k] ?? k));
    b.device.push(...breakdown(r, id === "google" ? GOOGLE_DEVICES : META_DEVICES, t, id, (k) => DEVICE_LABEL[k] ?? k));
    b.region.push(...breakdown(r, STATES, t, id, (k) => BR_STATES[k] ?? k));
    b.hour.push(...breakdown(r, HOUR_WEIGHT.map((w, h) => [String(h).padStart(2, "0"), w] as [string, number]), t, id, (k) => `${k}h`));
  }
  const google = adPlatforms.includes("google") ? sumPlatform(current, "google") : null;
  if (google?.spend) {
    const search = campaigns.filter((c) => c.platform === "google").map((c) => c.name);
    const pool = TERMS[sales ? "sales" : "leads"];
    // parte do Google vai para pesquisa; o resto (Shopping, PMax, YouTube) não tem termo
    const t = { ...google, spend: google.spend * 0.62, impressions: google.impressions * 0.3, clicks: google.clicks * 0.55, conversions: google.conversions * 0.6, revenue: google.revenue * 0.6 };
    const w = pool.map((_, i) => 1 / (1 + i * 0.35) * r.range(0.6, 1.4));
    const sum = w.reduce((a, x) => a + x, 0);
    out.searchTerms = pool.map((term, i) => {
      const share = w[i] / sum;
      // os últimos da lista gastam e convertem pouco ou nada (o desperdício que a página mostra)
      const eff = i >= pool.length - 3 ? r.range(0, 0.15) : r.range(0.55, 1.6);
      const conversions = Math.round(t.conversions * share * eff);
      return {
        term,
        matchType: i < 2 ? "exact" : r.pick(MATCHES.map(([m]) => m)),
        campaign: search.length ? search[i % search.length] : "Pesquisa",
        spend: Math.round(t.spend * share * r.range(0.8, 1.2)),
        impressions: Math.round(t.impressions * share * r.range(0.8, 1.2)),
        clicks: Math.max(1, Math.round(t.clicks * share * r.range(0.8, 1.2))),
        conversions,
        revenue: Math.round(t.conversions ? (t.revenue * conversions) / t.conversions : 0),
      };
    });
  }
  return out;
}

/** Retenção de exemplo para os vídeos da amostra (a curva cai mais no começo). */
export function sampleVideo(seed: string, c: Pick<Creative, "id" | "impressions">): VideoRetention {
  const r = rng(hash(`${seed}|video|${c.id}`));
  const views = Math.round(c.impressions * r.range(0.22, 0.45));
  const p25 = Math.round(views * r.range(0.48, 0.66));
  const p50 = Math.round(p25 * r.range(0.55, 0.72));
  const p75 = Math.round(p50 * r.range(0.62, 0.8));
  const p100 = Math.round(p75 * r.range(0.55, 0.78));
  return { views, p25, p50, p75, p100 };
}
