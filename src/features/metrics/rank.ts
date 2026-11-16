// Ranking de qualquer coisa do dataset por uma métrica: produtos por receita, campanhas por
// ROAS, estados por vendas, termos por conversões... É o que os blocos pedidos no editor
// ("Pedir ao Vyz") mostram. Funções puras: o bloco, a prévia do pedido e os testes usam as mesmas.

import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import type { RankEntity, RankMetric } from "@/features/templates/types";
import { formatValue, metric, type Format, type MetricId, type Profile } from "./definitions";
import type { Dataset } from "./source";
import { breakEvenOf, hasMargin } from "./targets";

/** Números de uma linha (valores em centavos). */
type Base = { spend: number; impressions: number; clicks: number; conversions: number; revenue: number; sold?: number; frequency?: number };

export type RankRow = { key: string; label: string; /** Segunda linha (formato do criativo, campanha do termo). */ sub?: string; platform?: PlatformId; value: number };

export type RankMetricDef = { label: string; format: Format; better: "up" | "down" | "neutral"; /** Dá para recalcular o investimento a partir dela (some no link com investimento oculto). */ spendDerived?: boolean; /** Só faz sentido com receita (objetivos de venda). */ sales?: boolean };

const OWN: Partial<Record<RankMetric, Omit<RankMetricDef, "spendDerived" | "sales">>> = {
  sold: { label: "Unidades vendidas", format: "int", better: "up" },
  profit: { label: "Lucro", format: "brlCompact", better: "up" },
};

const SPEND_DERIVED: ReadonlySet<RankMetric> = new Set(["spend", "roas", "profit", "cpa", "cpc"]);
const SALES: ReadonlySet<RankMetric> = new Set(["revenue", "roas", "profit", "ticket", "sold"]);

export function rankMetric(m: RankMetric, profile: Profile): RankMetricDef {
  const def = OWN[m] ?? metric(m as MetricId, profile);
  return { label: def.label, format: def.format, better: def.better, spendDerived: SPEND_DERIVED.has(m), sales: SALES.has(m) };
}

/** Métricas que cada coisa tem (o que não existe na linha não vira ranking). */
export const RANK_METRICS: Record<RankEntity, readonly RankMetric[]> = {
  products: ["revenue", "sold", "roas", "profit", "spend", "ticket"],
  campaigns: ["revenue", "roas", "profit", "conversions", "cpa", "spend", "ctr", "clicks", "cpc", "impressions", "ticket"],
  creatives: ["conversions", "cpa", "spend", "ctr", "clicks", "cpc", "impressions", "frequency"],
  platforms: ["revenue", "roas", "profit", "conversions", "cpa", "spend", "ctr", "clicks", "cpc", "impressions"],
  regions: ["revenue", "roas", "conversions", "cpa", "spend", "ctr", "clicks", "impressions"],
  devices: ["revenue", "roas", "conversions", "cpa", "spend", "ctr", "clicks", "impressions"],
  placements: ["revenue", "roas", "conversions", "cpa", "spend", "ctr", "clicks", "impressions"],
  terms: ["revenue", "roas", "conversions", "cpa", "spend", "ctr", "clicks"],
};

/** Coisas que se separam por plataforma (os produtos não têm plataforma). */
export const RANK_BY_PLATFORM: ReadonlySet<RankEntity> = new Set(["campaigns", "creatives", "regions", "devices", "placements", "terms"]);

/** Nome da coisa, no plural e no singular (títulos e textos do pedido). */
export const RANK_NOUN: Record<RankEntity, { many: string; one: string; female?: boolean }> = {
  products: { many: "Produtos", one: "produto" },
  campaigns: { many: "Campanhas", one: "campanha", female: true },
  creatives: { many: "Criativos", one: "criativo" },
  platforms: { many: "Plataformas", one: "plataforma", female: true },
  regions: { many: "Estados", one: "estado" },
  devices: { many: "Dispositivos", one: "dispositivo" },
  placements: { many: "Posicionamentos", one: "posicionamento" },
  terms: { many: "Termos de pesquisa", one: "termo" },
};

/** Sentido padrão: o melhor primeiro (custo: o menor; investimento e frequência: o maior). */
export const defaultDir = (m: RankMetric, profile: Profile): "asc" | "desc" => (rankMetric(m, profile).better === "down" ? "asc" : "desc");

const margin = (ds: Dataset) => (hasMargin(ds) ? 1 / breakEvenOf(ds) : null);

function valueOf(b: Base, m: RankMetric, ds: Dataset): number {
  const sold = b.sold ?? b.conversions;
  switch (m) {
    case "revenue":
      return b.revenue;
    case "sold":
      return sold;
    case "roas":
      return b.spend > 0 ? b.revenue / b.spend : NaN;
    case "profit": {
      const mg = margin(ds);
      return mg == null ? NaN : b.revenue * mg - b.spend;
    }
    case "spend":
      return b.spend;
    case "conversions":
      return b.conversions;
    case "cpa":
      return b.conversions > 0 ? b.spend / b.conversions : NaN;
    case "ctr":
      return b.impressions > 0 ? b.clicks / b.impressions : NaN;
    case "clicks":
      return b.clicks;
    case "cpc":
      return b.clicks > 0 ? b.spend / b.clicks : NaN;
    case "impressions":
      return b.impressions;
    case "ticket":
      return sold > 0 ? b.revenue / sold : NaN;
    case "frequency":
      return b.frequency ?? NaN;
  }
}

type Source = { key: string; label: string; sub?: string; platform?: PlatformId; base: Base };

function sum(into: Base, b: Base) {
  into.spend += b.spend;
  into.impressions += b.impressions;
  into.clicks += b.clicks;
  into.conversions += b.conversions;
  into.revenue += b.revenue;
}

const empty = (): Base => ({ spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 });

function sourcesOf(ds: Dataset, entity: RankEntity, platform?: PlatformId): Source[] | null {
  const only = <T extends { platform: PlatformId }>(rows: readonly T[]) => (platform ? rows.filter((r) => r.platform === platform) : rows);
  switch (entity) {
    case "products":
      return ds.products.map((p) => ({ key: p.name, label: p.name, base: { spend: p.spend, impressions: 0, clicks: 0, conversions: p.sold, revenue: p.revenue, sold: p.sold } }));
    case "campaigns":
      return only(ds.campaigns).map((c) => ({ key: c.id, label: c.name, platform: c.platform, base: c }));
    case "creatives":
      return only(ds.creatives).map((c) => ({ key: c.id, label: c.name, sub: c.format, platform: c.platform, base: { ...c, revenue: 0 } }));
    case "platforms": {
      const by = new Map<PlatformId, Base>();
      for (const c of ds.campaigns) sum(by.get(c.platform) ?? by.set(c.platform, empty()).get(c.platform)!, c);
      return [...by].map(([p, base]) => ({ key: p, label: PLATFORMS[p]?.name ?? p, platform: p, base }));
    }
    case "regions":
    case "devices":
    case "placements": {
      const dim = entity === "regions" ? "region" : entity === "devices" ? "device" : "placement";
      const rows = ds.breakdowns?.[dim];
      if (!rows) return null;
      // a mesma chave em plataformas diferentes vira uma linha só (sem filtro de plataforma)
      const by = new Map<string, Source>();
      for (const r of only(rows)) {
        const s = by.get(r.key) ?? by.set(r.key, { key: r.key, label: r.label, platform: platform ?? r.platform, base: empty() }).get(r.key)!;
        if (!platform && s.platform !== r.platform) s.platform = undefined;
        sum(s.base, r);
      }
      return [...by.values()];
    }
    case "terms": {
      const rows = ds.searchTerms;
      if (!rows) return null;
      return rows.map((t) => ({ key: `${t.term}|${t.campaign}|${t.matchType}`, label: t.term, sub: t.campaign, platform: "google", base: t }));
    }
  }
}

/**
 * As linhas do ranking, já na ordem. null = o dado não chegou (sem quebras, sem termos);
 * [] = chegou, mas não há nada com essa métrica no período.
 */
export function rankRows(ds: Dataset, entity: RankEntity, m: RankMetric, opts: { dir?: "asc" | "desc"; platform?: PlatformId; profile: Profile }): RankRow[] | null {
  const src = sourcesOf(ds, entity, opts.platform);
  if (!src) return null;
  const dir = opts.dir ?? defaultDir(m, opts.profile);
  return src
    .map((s) => ({ key: s.key, label: s.label, sub: s.sub, platform: s.platform, value: valueOf(s.base, m, ds) }))
    .filter((r) => Number.isFinite(r.value) && !(r.value === 0 && (m === "revenue" || m === "sold" || m === "conversions" || m === "spend")))
    .sort((a, b) => (dir === "desc" ? b.value - a.value : a.value - b.value));
}

export const formatRank = (v: number, m: RankMetric, profile: Profile) => formatValue(v, rankMetric(m, profile).format);

/** O lucro precisa da margem do dashboard. */
export const needsMargin = (m: RankMetric, ds: Dataset) => m === "profit" && margin(ds) == null;
