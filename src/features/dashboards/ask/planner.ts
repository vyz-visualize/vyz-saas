// "Pedir ao Vyz" no editor: a pessoa escreve o que quer ver ("tenho uma loja de cosméticos e
// quero saber qual cosmético teve o maior rendimento e a maior receita") e o painel propõe
// blocos para a aba (rankings, linha por dia, quebras, termos...) e os cards que faltam.
//
// Hoje a leitura é local, por palavras em português: na hora, sem API e sem custo. O ponto de
// troca para um planejador com LLM é este: a mesma entrada (texto + PlanContext) e a mesma
// saída (LayoutPlan), com os ids validados pela mesma regra da aba (accepts).

import type { PlatformId } from "@/features/accounts/platforms";
import { isSalesProfile, type MetricId, type Profile } from "@/features/metrics/definitions";
import { defaultDir, RANK_BY_PLATFORM, RANK_METRICS, RANK_NOUN, rankMetric } from "@/features/metrics/rank";
import type { RankEntity, RankMetric } from "@/features/templates/types";
import { customId, customTitle, type CustomSpec } from "../layout/custom-blocks";

export type PlanContext = {
  profile: Profile;
  /** A aba aceita o bloco? (mesma regra do servidor: contas do dashboard, investimento oculto) */
  accepts: (id: string) => boolean;
  /** O dataset tem produtos (loja ligada ou amostra). */
  hasProducts: boolean;
  /** Cards que dá para ligar nesta aba e os que já estão na tela. */
  kpiIds: readonly string[];
  visibleKpis: readonly string[];
};

export type PlannedBlock = { id: string; title: string; /** O que o bloco mostra, numa frase. */ why: string; spec: CustomSpec };

export type LayoutPlan = {
  understood: boolean;
  /** Frase de volta: o que foi entendido. */
  summary: string;
  blocks: PlannedBlock[];
  /** Cards a ligar (ainda não estão na tela). */
  kpis: string[];
  /** Como algo foi lido ou por que ficou de fora. */
  notes: string[];
  /** Pedidos que funcionam (quando nada foi entendido, e para ir além). */
  examples: string[];
};

export const PLAN_MAX = 6;

// ---- texto ------------------------------------------------------------------------------

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Pedaços do pedido: "qual produto vende mais e qual campanha rende mais" vira dois. */
function clauses(text: string): string[] {
  return text
    .split(/[,;.!?\n]+|\s+(?:e|tambem|também|alem disso|além disso|mais tambem|depois)\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

// ---- vocabulário -------------------------------------------------------------------------

type Special = "days" | "hours" | "audience" | "funnel" | "compare" | "goals" | "videos" | "table" | "waste" | "words" | "match";

const ENTITY_RULES: [RankEntity, RegExp][] = [
  ["terms", /\b(termos?|pesquisas?|buscas?|palavras?[- ]chaves?|keywords?|pesquisaram|buscaram|pesquisou|buscou)\b/],
  ["campaigns", /\bcampanhas?\b/],
  ["creatives", /\b(criativos?|anuncios?|artes?|imagens?|videos?|posts?|pecas? de anuncio)\b/],
  ["placements", /\b(posicionamentos?|stories|story|reels|feed|explorar)\b/],
  ["devices", /\b(dispositivos?|celular(es)?|mobile|desktop|computador(es)?|aparelhos?|tablets?)\b/],
  ["regions", /\b(estados?|regioes|regiao|cidades?|ufs?|localidades?)\b|\bonde (mais |menos )?(vend|compr|convert|fatur)/],
  ["platforms", /\b(plataformas?|canal|canais|redes?)\b|\b(meta|facebook|google|tiktok) (x|vs|versus|ou|contra) (meta|facebook|google|tiktok)\b/],
  // "onde estou gastando mais": as campanhas
  ["campaigns", /\bonde\b/],
  ["products", /\b(produtos?|itens|item|skus?|mercadorias?|catalogo)\b|\b(mais|menos) vendid/],
];

const SPECIAL_RULES: [Special, RegExp][] = [
  ["waste", /\b(desperdicio|sem converter|sem vend|sem result|jogando dinheiro|gast\w* (a toa|sem))/],
  ["words", /\bpalavras? (que mais|mais usad|mais comu)/],
  ["match", /\bcorrespondencia\b|\btipo de busca\b/],
  ["videos", /\b(retencao|assist\w*|quartil|ate o fim|ate o final|porcentagem de (visualizacao|video)|quanto (do video|veem))/],
  ["days", /\b(por dia|dia a dia|diari[oa]s?|evolucao|ao longo|tendencia|historico|linha do tempo|cada dia|todo dia|por semana|semana a semana|qual dia|que dia|quais dias|melhor dia|pior dia|dias? da semana|dia para)\b/],
  ["hours", /\b(horas?|horarios?|periodo do dia|madrugada|que horas)\b/],
  ["audience", /\b(idade|idades|genero|faixa etaria|homens|mulheres|sexo|publico)\b/],
  ["funnel", /\b(funil|jornada|etapas)\b/],
  ["compare", /\b(periodo anterior|mes passado|mes anterior|semana passada|ano passado)\b|\bcompar\w* com (o |a )?(periodo|mes|semana|ano|antes)/],
  ["goals", /\bmetas\b|\b(bater|atingir|alcancar|cumprir|chegar n)\w* (a |na |minha |as )?meta\b|\bminha meta\b|\bmeta (de|do|da|mensal|do mes)\b/],
  ["table", /\b(tabela|lista completa|todos os|todas as|lista de)\b/],
];

/** Ordem importa: o mais específico primeiro (custo por clique antes de custo, taxa de clique antes de clique). */
const METRIC_RULES: [RankMetric, RegExp, string?][] = [
  ["cpc", /\bcpc\b|custo por clique/],
  ["ctr", /\bctr\b|taxa de cliques?/],
  ["roas", /custo[- ]beneficio|\broas\b|\broi\b|rendiment\w*|\brend(e|eu|em|eram|ido)\b|retorno|eficien\w*|performance|desempenho/, "rendimento"],
  ["cpa", /\bcpa\b|\bcpl\b|custo por (venda|compra|lead|resultado|conversao|cadastro|conversa|agendamento|matricula)|mais barat\w*|mais car[oa]s?|\bcusto\b/],
  ["profit", /\blucr\w*|\bmargem\b|\bganh(o|os|ei|amos)\b/],
  ["revenue", /\breceitas?\b|fatur\w*|valor vendido|em reais/],
  ["sold", /\b(mais|menos) vendid\w*|\b(mais|menos) vend(e|eu|em|eram)\b|\bvend(e|eu|em|eram) (mais|menos)\b|\bunidades\b|\bquantidade\b|\bvolume\b|\bsaida\b/],
  ["ticket", /\bticket\b|valor medio|preco medio/],
  ["spend", /investiment\w*|investid\w*|\bgast\w*|\bverba\b|orcamento|custo total/],
  ["conversions", /\bvendas?\b|\bvend(e|eu|em|eram)\b|\bcompras?\b|\bconvers(ao|oes)\b|\bconvert\w*|\bresultados?\b|\bleads?\b|\bcadastros?\b|\bagendamentos?\b|\bmatriculas?\b|\bconversas?\b/],
  ["clicks", /\bcliques?\b|\bclicad\w*|\bclique\b/],
  ["impressions", /\bimpress\w*|\balcance\b|\bvistos?\b|\baparec\w*/],
  ["frequency", /\bfrequencia\b|\bcansad\w*|\bcansaco\b|\bsaturad\w*|\bfadiga\b|\brepetid\w*/],
];

const PLATFORM_RULES: [PlatformId, RegExp][] = [
  ["youtube", /\byoutube\b/],
  ["google", /\bgoogle\b|\badwords\b|rede de pesquisa/],
  ["meta", /\bmeta ads\b|\bfacebook\b|\binstagram\b|\binsta\b|\b(do|no|pelo|pela|da) meta\b(?! de)/],
  ["tiktok", /\btik ?tok\b/],
  ["linkedin", /\blinkedin\b/],
];

/** Palavras que não são o nome do que a pessoa vende ("qual MAIS vende", "qual TIPO de"). */
const STOP = new Set(
  "o a os as um uma de do da dos das que qual quais mais menos maior menor melhor pior melhores piores foi foram teve tiveram tem tinha esta estao e eu meu minha meus minhas seu sua nosso nossa tipo tipos coisa coisas parte tanto cada dia dias mes semana horas hora deu dao da vende vendem vendeu vendeu traz trouxe gera gerou rende rendeu ta to vai ser".split(" "),
);

type Dir = "high" | "low" | "good" | "bad" | null;
function directionOf(f: string): Dir {
  if (/\b(pior|piores|ruins?|fracos?|fracas?|caindo|queda)\b/.test(f)) return "bad";
  if (/\bmais barat|\b(menor|menores|menos|baix[oa]s?)\b/.test(f)) return "low";
  if (/\b(melhor|melhores|campe\w*|lider\w*|destaques?|top)\b/.test(f)) return "good";
  if (/\bmais car|\b(maior|maiores|mais|alt[oa]s?)\b/.test(f)) return "high";
  return null;
}

function dirFor(m: RankMetric, d: Dir, profile: Profile): "asc" | "desc" {
  const better = rankMetric(m, profile).better;
  if (d === "high") return "desc";
  if (d === "low") return "asc";
  if (d === "bad") return better === "down" ? "desc" : better === "up" ? "asc" : "desc";
  return defaultDir(m, profile);
}

/** Plural simples em português (cosmético → cosméticos, colchão → colchões, anel → anéis não: aneis). */
function plural(word: string): string {
  const w = word.toLowerCase();
  if (/s$/.test(fold(w))) return w;
  if (/ão$/.test(w)) return w.replace(/ão$/, "ões");
  if (/[rz]$/.test(w)) return `${w}es`;
  if (/m$/.test(w)) return w.replace(/m$/, "ns");
  if (/l$/.test(w)) return w.replace(/([aeou])l$/, "$1is").replace(/il$/, "is");
  return `${w}s`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** O nome do que a pessoa vende, como ela escreveu (com acento): "qual cosmético" → "Cosméticos". */
function nounOf(text: string): string | null {
  const words = text.split(/[^\p{L}\p{N}-]+/u).filter(Boolean);
  const f = words.map(fold);
  const known = (w: string) => STOP.has(w) || ENTITY_RULES.some(([, r]) => r.test(w)) || METRIC_RULES.some(([, r]) => r.test(w)) || SPECIAL_RULES.some(([, r]) => r.test(w));
  for (let i = 0; i < f.length; i++) {
    // "qual cosmético", "quais perfumes", "qual o sabor"
    if (f[i] === "qual" || f[i] === "quais") {
      let j = i + 1;
      while (j < f.length && ["o", "a", "os", "as", "dos", "das", "de", "meu", "minha", "meus", "minhas"].includes(f[j])) j++;
      if (j < f.length && f[j].length >= 3 && !known(f[j])) return cap(plural(words[j]));
    }
    // "loja de cosméticos", "venda de perfumes", "vendo roupas"
    const at = f[i] === "loja" || f[i] === "venda" || f[i] === "vendas" ? (f[i + 1] === "de" ? i + 2 : f[i + 1] === "online" && f[i + 2] === "de" ? i + 3 : -1) : f[i] === "vendo" || f[i] === "vendemos" ? i + 1 : -1;
    if (at > 0 && at < f.length && f[at].length >= 3 && !known(f[at])) return cap(plural(words[at]));
  }
  return null;
}

// ---- leitura de cada pedaço ----------------------------------------------------------------

type Clause = { /** O pedaço sem acento, em minúsculas. */ f: string; entity: RankEntity | null; metrics: { m: RankMetric; word?: string }[]; dir: Dir; platforms: PlatformId[]; special: Special[] };

function read(text: string): Clause {
  let f = fold(text);
  const special = SPECIAL_RULES.filter(([, r]) => r.test(f)).map(([s]) => s);
  // "metas" de objetivo não é a plataforma Meta, e vice-versa
  const platforms = PLATFORM_RULES.filter(([, r]) => r.test(f)).map(([p]) => p);
  const entity = ENTITY_RULES.find(([, r]) => r.test(f))?.[0] ?? null;
  const metrics: Clause["metrics"] = [];
  for (const [m, r, word] of METRIC_RULES) {
    const hit = r.exec(f);
    if (!hit) continue;
    metrics.push({ m, word: word && hit[0] });
    // o trecho lido não conta de novo ("custo por clique" não vira também "custo" e "clique")
    f = f.replace(r, " ");
  }
  return { f: fold(text), entity, metrics, dir: directionOf(fold(text)), platforms, special };
}

// ---- montagem ---------------------------------------------------------------------------

/** Rank → card de KPI com o mesmo número. */
const KPI_OF: Partial<Record<RankMetric, MetricId>> = { revenue: "revenue", roas: "roas", spend: "spend", cpa: "cpa", ctr: "ctr", clicks: "clicks", cpc: "cpc", ticket: "ticket", conversions: "conversions", sold: "conversions", impressions: "impressions", frequency: "frequency" };
/** Rank → métrica da linha por dia. */
const TREND_OF: Partial<Record<RankMetric, MetricId>> = { revenue: "revenue", roas: "roas", spend: "spend", cpa: "cpa", ctr: "ctr", clicks: "clicks", cpc: "cpc", ticket: "ticket", conversions: "conversions", sold: "conversions", impressions: "impressions", profit: "revenue" };

const DEFAULT_METRIC: Record<RankEntity, (sales: boolean) => RankMetric> = {
  products: () => "revenue",
  campaigns: (s) => (s ? "roas" : "cpa"),
  platforms: (s) => (s ? "roas" : "cpa"),
  creatives: () => "cpa",
  regions: () => "conversions",
  devices: () => "conversions",
  placements: () => "conversions",
  terms: () => "conversions",
};

/** Objetivo de lead: o que pede receita vira o resultado do objetivo. */
function forProfile(m: RankMetric, sales: boolean): RankMetric | null {
  if (sales) return m;
  if (m === "roas") return "cpa";
  if (m === "revenue" || m === "sold") return "conversions";
  if (m === "profit" || m === "ticket") return null;
  return m;
}

const PLATFORM_NAME: Partial<Record<PlatformId, string>> = { meta: "a Meta", google: "o Google", youtube: "o YouTube", tiktok: "o TikTok", linkedin: "o LinkedIn" };

function whyOf(spec: CustomSpec, profile: Profile): string {
  switch (spec.type) {
    case "rank": {
      const label = rankMetric(spec.metric, profile).label;
      const order = (spec.dir ?? defaultDir(spec.metric, profile)) === "desc" ? "do maior para o menor" : "do menor para o maior";
      const where = spec.platform ? ` Só ${PLATFORM_NAME[spec.platform] ?? spec.platform}.` : "";
      return `Por ${/^[A-Z]{2,}/.test(label) ? label : label.toLowerCase()} no período, ${order}.${where}`;
    }
    case "trend":
      return "Linha dia a dia, uma por plataforma, com a média de 7 dias.";
    case "breakdown":
      return "Investimento, resultados e custo em cada faixa.";
    case "searchTerms":
      return spec.view === "waste" ? "Termos com gasto e nenhuma conversão: candidatos a palavra negativa." : "O que as pessoas buscaram antes de clicar, com custo e conversões.";
    case "videos":
      return "Quanto de cada vídeo as pessoas assistem (25%, 50%, 75% e 100%).";
    case "audience":
      return "Idade e gênero de quem converte, com o custo de cada faixa.";
    case "funnel":
      return "As etapas, da impressão à conversão.";
    case "compare":
      return "Este período contra o anterior, métrica por métrica.";
    case "goals":
      return "Quanto falta para cada meta do dashboard.";
    case "table":
      return "A lista completa, com todas as colunas.";
    default:
      return "";
  }
}

const EXAMPLES_SALES = ["Quais produtos dão mais receita e mais retorno", "Campanhas do Google com melhor ROAS", "Receita por dia em cada plataforma", "Criativos com maior CTR", "Estados que mais vendem", "Termos que gastam sem converter"];
const EXAMPLES_LEADS = ["Campanhas com menor custo por lead", "Leads por dia", "Criativos com mais leads", "Horários com mais leads", "Estados com mais leads", "Idade e gênero de quem converte"];

export function examplesFor(profile: Profile): string[] {
  return isSalesProfile(profile) ? EXAMPLES_SALES : EXAMPLES_LEADS;
}

export function planLayout(text: string, ctx: PlanContext): LayoutPlan {
  const sales = isSalesProfile(ctx.profile);
  const notes = new Set<string>();
  const specs: { spec: CustomSpec; noun: string | null }[] = [];
  const kpis = new Set<MetricId>();
  const add = (spec: CustomSpec, noun: string | null = null) => specs.push({ spec, noun });

  const parts = clauses(text).map(read);
  const noun = nounOf(text);
  const whole = fold(text);
  // uma plataforma só no pedido vale para todos os pedaços ("o que funciona melhor no instagram, stories ou feed")
  const named = PLATFORM_RULES.filter(([, r]) => r.test(whole)).map(([p]) => p);
  // "comparar Meta e Google", "Meta x Google": as plataformas lado a lado
  const brands = new Set([...whole.matchAll(/\b(meta|facebook|instagram|google|youtube|tiktok|linkedin)\b/g)].map((m) => (m[1] === "facebook" || m[1] === "instagram" ? "meta" : m[1] === "youtube" ? "google" : m[1])));
  const versus = brands.size > 1 && !ENTITY_RULES.some(([e, r]) => e !== "platforms" && r.test(whole));
  const commerce = sales && (ctx.hasProducts || /\b(loja|vend|produt|ecommerce|e-commerce)/.test(fold(text)));

  const resolved: (RankEntity | null)[] = [];
  if (versus) {
    const asked = parts.flatMap((c) => c.metrics.map((x) => forProfile(x.m, sales))).filter((x): x is RankMetric => !!x && RANK_METRICS.platforms.includes(x));
    const main = asked[0] ?? (sales ? "roas" : "cpa");
    for (const m of asked.length ? asked : [main, "spend" as const]) {
      add({ type: "rank", entity: "platforms", metric: m, dir: dirFor(m, null, ctx.profile) });
      if (KPI_OF[m]) kpis.add(KPI_OF[m]!);
    }
    const t = TREND_OF[main];
    if (t) add({ type: "trend", metrics: [t] });
  }
  if (!versus) parts.forEach((c, i) => {
    const prev = parts.slice(0, i).reverse();
    const next = parts.slice(i + 1);
    // o que falta no pedaço vem do vizinho ("maior rendimento e maior receita": o segundo herda o produto)
    let entity = c.entity ?? [...resolved].reverse().find(Boolean) ?? null;
    if (!entity && !c.special.length) entity = next.find((p) => p.entity)?.entity ?? null;
    let useNoun = false;
    // "qual cosmético teve...": o que a pessoa vende vira os produtos ("tenho uma loja de cosméticos" sozinho é só contexto)
    if (!entity && noun && (c.metrics.length || /\b(qual|quais)\b/.test(c.f))) {
      if (commerce) {
        entity = "products";
        useNoun = true;
      } else notes.add(`Não achei "${noun.toLowerCase()}" separado nos dados: mostrei por campanha.`);
      entity ??= "campaigns";
    } else if (entity === "products" && noun) useNoun = true;
    if (c.platforms.length > 1 && !entity) entity = "platforms";
    resolved.push(entity);
    const metrics = c.metrics.length ? c.metrics : (prev.find((p) => p.metrics.length && !p.special.includes("days"))?.metrics ?? []);
    const platform = c.platforms.length === 1 ? c.platforms[0] : c.platforms.length === 0 && named.length === 1 ? named[0] : undefined;
    // pedaço só de contexto ("sou dentista", "tenho uma loja"): nada a montar
    if (!c.entity && !c.metrics.length && !c.platforms.length && !c.special.length && !(noun && /\b(qual|quais)\b/.test(c.f))) return;

    for (const m of c.metrics) if (m.word && m.m === "roas" && sales && !/^(roas|roi|retorno)$/.test(m.word)) notes.add(`Li "${m.word}" como retorno (ROAS): receita ÷ investimento em anúncios.`);

    // pedidos que viram um bloco próprio
    const before = specs.length;
    if (c.special.includes("videos")) add({ type: "videos", ...(platform ? { platform } : {}) });
    if (c.special.includes("audience")) add({ type: "audience" });
    if (c.special.includes("funnel")) add({ type: "funnel" });
    if (c.special.includes("compare")) add({ type: "compare" });
    if (c.special.includes("goals")) add({ type: "goals" });
    if (c.special.includes("hours")) add({ type: "breakdown", dimension: "hour", ...(platform ? { platform } : {}) });
    // "retenção dos vídeos", "melhor horário": o bloco próprio já responde (sem ranking a mais)
    if (specs.length > before && (!c.entity || !c.metrics.length || c.special.includes("videos"))) return;
    if (entity === "terms" && (c.special.includes("waste") || c.special.includes("words") || c.special.includes("match") || c.special.includes("table"))) {
      add({ type: "searchTerms", view: c.special.includes("waste") ? "waste" : c.special.includes("words") ? "words" : c.special.includes("match") ? "match" : "table" });
      return;
    }
    if (c.special.includes("days")) {
      const ms = metrics.map((x) => forProfile(x.m, sales)).filter((x): x is RankMetric => !!x);
      const ids = [...new Set((ms.length ? ms : [sales ? "revenue" : "conversions"]).map((x) => TREND_OF[x as RankMetric]).filter((x): x is MetricId => !!x))];
      for (const id of ids) add({ type: "trend", metrics: [id] });
      if (entity === "products") notes.add("Os produtos ainda não têm o dia a dia: a linha mostra o total da loja.");
      for (const id of ids) kpis.add(id);
      return;
    }
    if (c.special.includes("table") && (entity === "products" || entity === "campaigns")) {
      add({ type: "table", source: entity }, useNoun ? noun : null);
      return;
    }
    if (!entity) {
      // só métricas ("quero ver receita e ROAS"): os cards e a linha por dia da primeira
      if (metrics.length && !c.special.length) {
        const ms = metrics.map((x) => forProfile(x.m, sales)).filter((x): x is RankMetric => !!x);
        for (const m of ms) if (KPI_OF[m]) kpis.add(KPI_OF[m]!);
        const t = ms.map((m) => TREND_OF[m]).find(Boolean);
        if (t) add({ type: "trend", metrics: [t] });
      }
      return;
    }

    const asked = metrics.length ? metrics.map((x) => x.m) : [DEFAULT_METRIC[entity](sales)];
    for (const raw of asked) {
      let m = forProfile(raw, sales);
      if (!m) {
        notes.add(`${rankMetric(raw, ctx.profile).label} só existe em objetivos de venda.`);
        continue;
      }
      if (entity === "products" && m === "conversions") m = "sold";
      if (!RANK_METRICS[entity].includes(m)) {
        notes.add(`${RANK_NOUN[entity].many} não têm ${rankMetric(m, ctx.profile).label.toLowerCase()}: usei ${rankMetric(DEFAULT_METRIC[entity](sales), ctx.profile).label.toLowerCase()}.`);
        m = DEFAULT_METRIC[entity](sales);
      }
      const p = platform && RANK_BY_PLATFORM.has(entity) ? platform : undefined;
      add({ type: "rank", entity, metric: m, dir: dirFor(m, c.dir, ctx.profile), ...(p ? { platform: p } : {}) }, useNoun ? noun : null);
      if (KPI_OF[m]) kpis.add(KPI_OF[m]!);
    }
  });

  // só o negócio ("tenho uma loja de cosméticos"): um começo pronto para ele
  if (!specs.length && noun && commerce) {
    for (const m of ["revenue", "sold", "roas"] as const) add({ type: "rank", entity: "products", metric: m, dir: "desc" }, noun);
    add({ type: "trend", metrics: ["revenue"] });
    kpis.add("revenue");
    kpis.add("roas");
  }

  // o que a aba aceita, sem repetir
  const seen = new Set<string>();
  const blocks: PlannedBlock[] = [];
  for (const { spec, noun: n } of specs) {
    const id = customId(spec);
    if (seen.has(id)) continue;
    seen.add(id);
    if (!ctx.accepts(id)) {
      notes.add(
        spec.type === "searchTerms" || (spec.type === "rank" && spec.entity === "terms")
          ? "Termos de pesquisa precisam de uma conta do Google Ads neste dashboard."
          : spec.type === "rank" && spec.entity === "placements"
            ? "Posicionamentos precisam de uma conta da Meta neste dashboard."
            : `"${customTitle(spec, ctx.profile, n ?? undefined)}" não vale neste dashboard.`,
      );
      continue;
    }
    if (blocks.length >= PLAN_MAX) continue;
    blocks.push({ id, title: customTitle(spec, ctx.profile, n ?? undefined), why: whyOf(spec, ctx.profile), spec });
  }
  if (blocks.some((b) => b.spec.type === "rank" && b.spec.entity === "products") && !ctx.hasProducts) notes.add("Os produtos aparecem quando a loja estiver ligada ao dashboard. O bloco já fica pronto.");

  const cards = [...kpis].filter((k) => ctx.kpiIds.includes(k) && !ctx.visibleKpis.includes(k));
  const understood = blocks.length > 0 || cards.length > 0;
  const list = blocks.map((b) => b.title);
  const summary = !understood
    ? "Não entendi bem o pedido. Tente dizer o que quer ver e por qual número, como nos exemplos."
    : list.length
      ? `Entendi. Montei ${list.length === 1 ? "este bloco" : `estes ${list.length} blocos`} para a aba:`
      : "Entendi. Isso já cabe nos cards:";

  return { understood, summary, blocks, kpis: cards, notes: [...notes], examples: examplesFor(ctx.profile) };
}
