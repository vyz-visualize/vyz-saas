// Blocos que a pessoa pede no editor ("Pedir ao Vyz"), além dos do template. O bloco inteiro
// mora no id, como os cards de métrica (m:meta:ctr): c:rank:products:revenue:desc,
// c:trend:revenue, c:breakdown:region:meta... A disposição guarda só id, lugar, tamanho e o
// nome que a pessoa deu (title). Painel, servidor e testes leem o id com as mesmas funções.

import type { PlatformId } from "@/features/accounts/platforms";
import { metric, type MetricId, type Profile } from "@/features/metrics/definitions";
import { defaultDir, RANK_BY_PLATFORM, RANK_METRICS, RANK_NOUN, rankMetric } from "@/features/metrics/rank";
import type { RankEntity, RankMetric, WidgetSpec } from "@/features/templates/types";

export const CUSTOM_PREFIX = "c:";
/** Blocos pedidos que cabem numa aba. */
export const CUSTOM_BLOCKS_MAX = 8;
/** Nome que a pessoa dá ao bloco (ou que o pedido sugere). */
export const CUSTOM_TITLE_MAX = 60;

export const isCustomId = (id: string) => id.startsWith(CUSTOM_PREFIX);

const ENTITIES = Object.keys(RANK_METRICS) as RankEntity[];
const TREND_METRICS: readonly MetricId[] = ["revenue", "roas", "conversions", "cpa", "spend", "ctr", "clicks", "cpc", "cpm", "impressions", "ticket", "leads", "cpl"];
const SPEND_METRICS: ReadonlySet<string> = new Set(["spend", "roas", "cpa", "cpc", "cpm", "cpl", "profit"]);
const DIMENSIONS = ["placement", "device", "region", "hour"] as const;
const TERM_VIEWS = ["table", "waste", "match", "words"] as const;
const AD_PLATFORMS: readonly PlatformId[] = ["meta", "google", "tiktok", "linkedin", "youtube"];

/** As listas do formato dos ids (o prompt do "Pedir ao Vyz" com IA descreve o catálogo a partir delas). */
export const CUSTOM_GRAMMAR = { trend: TREND_METRICS, dimensions: DIMENSIONS, termViews: TERM_VIEWS, platforms: AD_PLATFORMS } as const;

type Custom = Extract<WidgetSpec, { type: "rank" | "trend" | "breakdown" | "searchTerms" | "videos" | "table" | "funnel" | "audience" | "compare" | "goals" | "creatives" }>;

const isPlatform = (p: string | undefined): p is PlatformId => !!p && (AD_PLATFORMS as string[]).includes(p);

/** O bloco que o id descreve (null = id inválido). */
export function customSpec(id: string): Custom | null {
  if (!isCustomId(id) || id.length > 64) return null;
  const [kind, a, b, c, d, ...rest] = id.slice(CUSTOM_PREFIX.length).split(":");
  if (rest.length) return null;
  switch (kind) {
    case "rank": {
      const entity = a as RankEntity;
      const m = b as RankMetric;
      if (!ENTITIES.includes(entity) || !RANK_METRICS[entity].includes(m) || (c !== "asc" && c !== "desc")) return null;
      if (d !== undefined && (!isPlatform(d) || !RANK_BY_PLATFORM.has(entity))) return null;
      return { type: "rank", entity, metric: m, dir: c, ...(d ? { platform: d } : {}) };
    }
    case "trend":
      return TREND_METRICS.includes(a as MetricId) && b === undefined ? { type: "trend", metrics: [a as MetricId] } : null;
    case "breakdown":
      if (!(DIMENSIONS as readonly string[]).includes(a) || c !== undefined || (b !== undefined && !isPlatform(b))) return null;
      return { type: "breakdown", dimension: a as (typeof DIMENSIONS)[number], ...(b ? { platform: b as PlatformId } : {}) };
    case "terms":
      return (TERM_VIEWS as readonly string[]).includes(a) && b === undefined ? { type: "searchTerms", view: a as (typeof TERM_VIEWS)[number] } : null;
    case "videos":
      if (b !== undefined || (a !== undefined && !isPlatform(a))) return null;
      return { type: "videos", ...(a ? { platform: a as PlatformId } : {}) };
    case "table":
      return (a === "products" || a === "campaigns") && b === undefined ? { type: "table", source: a } : null;
    case "funnel":
    case "audience":
    case "compare":
    case "goals":
    case "creatives":
      return a === undefined ? { type: kind } : null;
    default:
      return null;
  }
}

/** O id de um bloco (o inverso de customSpec). */
export function customId(spec: Custom): string {
  switch (spec.type) {
    case "rank":
      return `c:rank:${spec.entity}:${spec.metric}:${spec.dir ?? "desc"}${spec.platform ? `:${spec.platform}` : ""}`;
    case "trend":
      return `c:trend:${spec.metrics[0]}`;
    case "breakdown":
      return `c:breakdown:${spec.dimension}${spec.platform ? `:${spec.platform}` : ""}`;
    case "searchTerms":
      return `c:terms:${spec.view}`;
    case "videos":
      return `c:videos${spec.platform ? `:${spec.platform}` : ""}`;
    case "table":
      return `c:table:${spec.source}`;
    default:
      return `c:${spec.type}`;
  }
}

/** A aba aceita o bloco? (id válido, com as contas que ele precisa e sem mostrar investimento escondido) */
export function customAllowed(id: string, sources: readonly PlatformId[], hideSpend?: boolean): boolean {
  const spec = customSpec(id);
  if (!spec) return false;
  // o YouTube anda pela conta do Google Ads
  const has = (p: PlatformId) => sources.includes(p) || (p === "google" && sources.includes("youtube")) || (p === "youtube" && sources.includes("google"));
  switch (spec.type) {
    case "rank":
      if (hideSpend && rankMetric(spec.metric, "ecommerce").spendDerived) return false;
      if (spec.platform && !has(spec.platform)) return false;
      if (spec.entity === "terms") return has("google");
      if (spec.entity === "placements") return has("meta");
      return true;
    case "trend":
      return !(hideSpend && SPEND_METRICS.has(spec.metrics[0]));
    case "breakdown":
      return !spec.platform || has(spec.platform);
    case "searchTerms":
      return has("google");
    case "videos":
      return !spec.platform || has(spec.platform);
    default:
      return true;
  }
}

/** Opções do seletor da linha por dia pedida: a métrica do pedido primeiro, depois as do objetivo. */
export function trendOptions(first: MetricId, sales: boolean): MetricId[] {
  const rest: MetricId[] = sales ? ["revenue", "roas", "spend", "conversions", "cpa", "ctr"] : ["conversions", "cpa", "spend", "ctr", "clicks"];
  return [first, ...rest.filter((m) => m !== first)];
}

/** Tamanho com que o bloco entra na grade (12 colunas). */
export function customSize(spec: Custom): { w: number; h: number } {
  switch (spec.type) {
    case "rank":
    case "breakdown":
    case "videos":
    case "compare":
      return { w: 6, h: 11 };
    case "trend":
      return { w: 12, h: 12 };
    case "searchTerms":
      return spec.view === "table" ? { w: 12, h: 14 } : { w: 6, h: 11 };
    case "table":
    case "creatives":
      return { w: 12, h: 13 };
    case "audience":
      return { w: 6, h: 10 };
    default:
      return { w: 6, h: 9 };
  }
}

const PLATFORM_OF: Partial<Record<PlatformId, string>> = { meta: "da Meta", google: "do Google", tiktok: "do TikTok", linkedin: "do LinkedIn", youtube: "do YouTube" };

/** "que mais faturam", "com menor custo por venda"... */
function rankPhrase(m: RankMetric, dir: "asc" | "desc", profile: Profile, female: boolean): string {
  const up = dir === "desc";
  const def = rankMetric(m, profile);
  const lower = /^[A-Z]{2,}/.test(def.label) ? def.label : def.label.toLowerCase();
  switch (m) {
    case "revenue":
      return up ? "que mais faturam" : "que menos faturam";
    case "sold":
      return `${up ? "mais" : "menos"} ${female ? "vendidas" : "vendidos"}`;
    case "roas":
      return up ? "com melhor retorno (ROAS)" : "com pior retorno (ROAS)";
    case "profit":
      return up ? "que mais dão lucro" : "que menos dão lucro";
    case "spend":
    case "conversions":
    case "clicks":
    case "impressions":
      return `com ${up ? "mais" : "menos"} ${lower}`;
    default:
      return `com ${up ? "maior" : "menor"} ${lower}`;
  }
}

/** Nome do bloco quando a pessoa não deu um. `noun` troca "Produtos" pelo que ela vende ("Cosméticos"). */
export function customTitle(spec: Custom, profile: Profile, noun?: string): string {
  switch (spec.type) {
    case "rank": {
      const n = RANK_NOUN[spec.entity];
      const name = noun ?? n.many;
      const where = spec.platform ? ` ${PLATFORM_OF[spec.platform] ?? ""}`.trimEnd() : "";
      return `${name}${where} ${rankPhrase(spec.metric, spec.dir ?? defaultDir(spec.metric, profile), profile, !noun && !!n.female)}`;
    }
    case "trend":
      return `${metric(spec.metrics[0], profile).label} por dia`;
    case "breakdown": {
      const where = spec.platform ? ` ${PLATFORM_OF[spec.platform] ?? ""}`.trimEnd() : "";
      return `${{ placement: "Por posicionamento", device: "Por dispositivo", region: "Por estado", hour: "Por hora do dia" }[spec.dimension]}${where}`;
    }
    case "searchTerms":
      return { table: "Termos de pesquisa", waste: "Termos que gastam sem converter", match: "Tipos de correspondência", words: "Palavras que mais aparecem" }[spec.view];
    case "videos":
      return "Retenção dos vídeos";
    case "table":
      return spec.source === "products" ? `Todos os ${(noun ?? "produtos").toLowerCase()}` : "Todas as campanhas";
    case "funnel":
      return "Funil";
    case "audience":
      return "Idade e gênero";
    case "compare":
      return "Este período × anterior";
    case "goals":
      return "Metas";
    case "creatives":
      return "Criativos";
  }
}

/** Nome guardado: texto curto, sem quebra de linha nem caractere de controle. */
export function cleanTitle(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, CUSTOM_TITLE_MAX);
  return t || undefined;
}

export type { Custom as CustomSpec };
