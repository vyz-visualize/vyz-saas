// Sugestão de modelo a partir de uma frase ("loja virtual com Meta e Google",
// "relatório para a diretoria"). Roda no navegador, sem IA: compara a frase com
// as palavras de cada modelo, da categoria e das plataformas. Usada no popup do
// assistente ao criar um dashboard.

import { PLATFORMS, type PlatformId } from "@/features/accounts/platforms";
import { canUse, type Tier } from "@/features/pricing/entitlements";
import { ALL_DASHBOARD_TEMPLATES } from "./live";
import type { DashboardCategory, DashboardTemplate } from "./types";

/** Minúsculas e sem acento, para comparar. */
export const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Palavras que apontam para a categoria inteira. */
export const CATEGORY_WORDS: Record<DashboardCategory, string[]> = {
  "E-commerce": ["e-commerce", "ecommerce", "loja virtual", "loja online", "loja", "vendas online", "roas", "receita", "compras", "carrinho", "pedidos", "faturamento", "shopify", "nuvemshop"],
  Leads: ["lead", "captação", "formulário", "cadastros", "cpl", "custo por lead", "orçamentos", "contatos"],
  Imobiliário: ["imobiliária", "imobiliário", "imóveis", "imóvel", "corretor", "incorporadora", "construtora", "loteamento", "empreendimento", "apartamento"],
  "Negócio local": ["negócio local", "loja física", "restaurante", "salão", "academia", "delivery", "bairro", "whatsapp", "ligações"],
  Agência: ["agência", "carteira", "vários clientes", "meus clientes", "todos os clientes", "gestor de tráfego"],
  Mídia: ["mídia", "campanhas", "anúncios", "tráfego", "ctr", "cpm", "cpc"],
  Executivo: ["diretoria", "executivo", "resumo", "ceo", "chefe", "apresentação", "reunião", "sócio"],
};

/** Palavras que apontam para um modelo específico (pesam mais que as da categoria). */
export const TEMPLATE_WORDS: Record<string, string[]> = {
  "meta-ecommerce": ["dados reais", "minhas contas", "conta conectada", "facebook", "instagram"],
  "meta-organico": ["organico", "seguidores", "engajamento", "posts", "reels", "stories", "perfil do instagram"],
  "meta-organico-pago": ["organico e pago", "pago e organico", "organico com anuncios", "seguidores e vendas"],
  "google-ecommerce": ["dados reais", "minhas contas", "conta conectada", "shopping", "pmax", "termos de pesquisa"],
  "agencia-carteira": ["carteira", "todos os clientes", "vários clientes", "meus clientes"],
  "clinicas-saude": ["clínica", "saúde", "médico", "dentista", "consulta", "agendamento", "paciente", "odontologia", "estética"],
  "comparativo-canais": ["comparar", "comparativo", "canais", "qual canal", "lado a lado"],
  "criativos-ao-vivo": ["criativo", "tempo real", "ao vivo", "teste a/b", "duelo"],
  "criativos-meta": ["criativo", "frequência", "renovar"],
  "crm-lead-venda": ["crm", "mql", "sql", "proposta", "funil de vendas", "negócios", "rd station", "hubspot", "pipedrive", "kommo", "até a venda"],
  "ecommerce-completo": ["completo", "tudo", "produtos"],
  "ecommerce-visao-geral": ["visão geral", "custo por venda"],
  "educacao-matriculas": ["escola", "faculdade", "matrícula", "educação", "curso", "colégio", "universidade", "alunos"],
  "funil-ga4": ["funil", "site", "sessões", "taxa de conversão", "ga4", "analytics"],
  "google-pesquisa": ["pesquisa", "search", "palavra-chave", "palavras-chave"],
  "imobiliario-leads": ["visita", "proposta de imóvel"],
  "infoproduto-lancamento": ["lançamento", "infoproduto", "carrinho aberto", "webinar", "mentoria"],
  infoproduto: ["infoproduto", "curso online", "ebook", "mentoria"],
  "leads-visao-geral": ["visão geral", "leads qualificados"],
  "local-whatsapp": ["whatsapp", "conversas", "ligações", "mensagens"],
  marketplace: ["marketplace", "mercado livre", "shopee", "mercado ads"],
  "meta-essencial": ["essencial", "simples", "básico"],
  "metas-pacing": ["meta do mês", "metas", "pacing", "verba", "orçamento"],
  "mmm-mix-midia": ["mmm", "mix de mídia", "marketing mix", "saturação", "incremental", "realocar"],
  "planilha-midia": ["planilha", "csv", "google sheets", "excel", "importar", "importação", "shopee", "spotify", "globo", "chatgpt"],
  "painel-areia": ["areia", "terracota", "bege", "tons claros"],
  "painel-lavanda": ["lavanda", "lilás", "escuro"],
  "painel-monocromo": ["monocromo", "preto e branco", "minimalista", "linha do tempo"],
  "painel-noturno": ["noturno", "escuro", "dark", "modo escuro", "âmbar"],
  "painel-pulso": ["pulso", "roxo", "rosa", "colorido"],
  "previsao-kpis": ["previsão", "projeção", "prever", "fim do mês", "bater a meta"],
  "relatorio-executivo": ["relatório", "uma página", "diretoria"],
  "saude-conta": ["saúde da conta", "alertas", "diagnóstico", "auditoria", "problemas"],
  "tiktok-ads": ["tiktok", "tik tok"],
  "varejo-local": ["loja física", "varejo", "rota", "como chegar"],
  "youtube-video": ["youtube", "vídeo", "visualizações"],
};

/** Como cada plataforma aparece numa frase. "meta" sozinho tem regra própria (ver mentionsMeta). */
const PLATFORM_WORDS: Partial<Record<PlatformId, string[]>> = {
  meta: ["meta ads", "facebook", "instagram"],
  google: ["google ads", "google", "adwords"],
  ga4: ["ga4", "analytics"],
  tiktok: ["tiktok", "tik tok"],
  youtube: ["youtube"],
  crm: ["crm", "rd station", "hubspot", "pipedrive", "kommo"],
  mercado: ["mercado livre", "mercado ads"],
  shopee: ["shopee"],
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** A frase (já sem acento) traz o termo no começo de uma palavra, com plural opcional. */
function mentions(query: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escape(plain(term))}(s|es)?($|[^a-z0-9])`).test(query);
}

/** "Meta" como plataforma, não "a meta do mês" nem "metas". */
const mentionsMeta = (query: string) => /(^|[^a-z0-9])meta(?! (do|de|da|mensal|batida)\b)($|[^a-z0-9])/.test(query);

const STOP = new Set(["quero", "preciso", "para", "pra", "com", "sem", "uma", "um", "dos", "das", "que", "meu", "minha", "meus", "minhas", "dashboard", "dashboards", "painel", "modelo", "sobre", "como", "mais", "ver", "acompanhar", "cliente", "clientes", "dados"]);

export type Recommendation = {
  template: DashboardTemplate;
  score: number;
  /** Termos da frase que levaram ao modelo (como a pessoa lê: com acento). */
  reasons: string[];
  locked: boolean;
  /** Modelo com dados reais sem conta ativa da plataforma. */
  needsAccount: boolean;
};

export type RecommendOptions = { tier: Tier; enabledAccounts?: Partial<Record<PlatformId, number>>; limit?: number };

const usable = (t: DashboardTemplate, o: RecommendOptions) => ({
  locked: !canUse(o.tier, t.tier),
  needsAccount: t.dataMode === "live" && !t.sources.some((s) => (o.enabledAccounts?.[s] ?? 0) > 0),
});

/** Até `limit` modelos que combinam com a frase, do mais ao menos provável. Sem sinal claro, lista vazia. */
export function recommendTemplates(text: string, o: RecommendOptions): Recommendation[] {
  const query = plain(text);
  if (query.length < 2) return [];
  const platforms = (Object.keys(PLATFORM_WORDS) as PlatformId[]).filter((p) => (p === "meta" && mentionsMeta(query)) || PLATFORM_WORDS[p]!.some((w) => mentions(query, w)));
  const tokens = query.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w));

  const scored = ALL_DASHBOARD_TEMPLATES.map((t): Recommendation => {
    const reasons: string[] = [];
    let score = 0;

    const own = (TEMPLATE_WORDS[t.id] ?? []).filter((w) => mentions(query, w));
    score += Math.min(own.length, 2) * 4;
    reasons.push(...own.slice(0, 2));

    const cat = CATEGORY_WORDS[t.category].filter((w) => mentions(query, w));
    if (cat.length) {
      score += 2 + (cat.length > 1 ? 1 : 0);
      reasons.push(t.category);
    }

    if (platforms.length) {
      const hit = platforms.filter((p) => t.sources.includes(p));
      if (hit.length === 0) score -= 2;
      else {
        score += hit.length * 1.5;
        // modelo feito só para aquela plataforma (Instagram e Página, opcionais nos modelos do Meta, não contam)
        if (t.sources.filter((src) => PLATFORMS[src].kind !== "social").length === 1) score += 2;
        // pediu só o que o modelo cobre, sem sobrar plataforma
        if (hit.length === platforms.length) score += 0.5;
        reasons.push(...hit.map((p) => PLATFORMS[p].name));
      }
    }

    const hay = plain(`${t.name} ${t.description}`);
    score += tokens.filter((w) => new RegExp(`(^|[^a-z0-9])${escape(w)}`).test(hay)).length * 0.5;

    const u = usable(t, o);
    if (t.dataMode === "live" && !u.needsAccount && score > 0) score += 0.75;
    score += u.locked ? -0.5 : u.needsAccount ? -0.25 : 0.25;
    return { template: t, score, reasons: [...new Set(reasons)], ...u };
  });

  return scored
    .filter((r) => r.score >= 2 && r.reasons.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, o.limit ?? 3);
}

/** Quando a frase não aponta para nenhum modelo: os que funcionam já (dados reais com conta ativa, depois os do plano). */
export function fallbackTemplates(o: RecommendOptions): Recommendation[] {
  return ALL_DASHBOARD_TEMPLATES.map((t) => ({ template: t, score: 0, reasons: [], ...usable(t, o) }))
    .filter((r) => !r.locked && !r.needsAccount)
    .sort((a, b) => Number(b.template.dataMode === "live") - Number(a.template.dataMode === "live"))
    .slice(0, o.limit ?? 3);
}

const haystacks = new Map<string, string>();

/**
 * Busca da galeria: cada palavra digitada precisa aparecer no nome, na descrição,
 * na categoria, nas plataformas ou nas palavras do modelo. Sem acento, então
 * "imobiliaria" acha Imobiliário e "clinica" acha Clínicas.
 */
export function matchesSearch(t: DashboardTemplate, query: string): boolean {
  const words = plain(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  let hay = haystacks.get(t.id);
  if (!hay) {
    hay = plain([t.name, t.description, t.category, ...t.sources.map((s) => PLATFORMS[s].name), ...(TEMPLATE_WORDS[t.id] ?? []), ...CATEGORY_WORDS[t.category]].join(" "));
    haystacks.set(t.id, hay);
  }
  return words.every((w) => hay.includes(w));
}

/** Frases de exemplo do popup. */
export const EXAMPLE_REQUESTS = [
  "Loja virtual com Meta e Google",
  "Geração de leads com CRM",
  "Imobiliária: custo por lead e visitas",
  "Relatório para a diretoria",
  "Quais criativos renovar",
  "Todos os clientes da agência numa tela",
];
