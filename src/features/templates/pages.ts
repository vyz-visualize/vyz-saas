// Biblioteca de páginas do dashboard. Cada página monta a lista de widgets a
// partir do perfil do negócio e das fontes conectadas.

import type { Profile } from "@/features/metrics/definitions";
import type { BuildContext, PageDef, PageId, PageLayout } from "./types";

const OVERVIEW: Record<Profile, (ctx: BuildContext) => PageLayout> = {
  ecommerce: () => ({
    kpis: [{ metric: "cpa", sub: "delta" }, { metric: "conversions", sub: "split" }, { metric: "revenue", sub: "delta" }, { metric: "roas", sub: "breakEven", highlight: true }],
    widgets: [
      { type: "line", metric: "cpa", goal: true, span: 2, title: "Custo por venda · média móvel 7 dias" },
      { type: "funnel", span: 1, title: "Onde o cliente desiste" },
      { type: "bars", source: "campaigns", metric: "roas", reference: "breakEven", span: 1, title: "ROAS por campanha" },
    ],
  }),
  executivo: () => ({
    kpis: [{ metric: "spend", sub: "delta" }, { metric: "revenue", sub: "delta" }, { metric: "roas", sub: "breakEven", highlight: true }, { metric: "cpa", sub: "delta" }],
    widgets: [
      { type: "line", metric: "roas", span: 2, title: "ROAS · média móvel 7 dias" },
      { type: "compare", span: 2, title: "Este período × anterior" },
    ],
  }),
  marketplace: () => ({
    kpis: [{ metric: "conversions", sub: "delta" }, { metric: "revenue", sub: "delta" }, { metric: "spend", sub: "delta" }, { metric: "roas", sub: "breakEven", highlight: true }],
    widgets: [
      { type: "line", metric: "roas", span: 2, title: "ROAS · média móvel 7 dias" },
      { type: "table", source: "products", span: 2, title: "Produtos que mais vendem" },
    ],
  }),
  site: () => ({
    kpis: [{ metric: "sessions", sub: "delta" }, { metric: "convRate", sub: "delta" }, { metric: "conversions", sub: "delta" }, { metric: "revenue", sub: "delta", highlight: true }],
    widgets: [
      { type: "line", metric: "sessions", span: 2, title: "Sessões · média móvel 7 dias" },
      { type: "funnel", span: 2, title: "Funil do site" },
    ],
  }),
  infoproduto: () => ({
    kpis: [{ metric: "leads", sub: "delta" }, { metric: "cpl", sub: "delta" }, { metric: "conversions", sub: "delta" }, { metric: "roas", sub: "breakEven", highlight: true }],
    widgets: [
      { type: "line", metric: "cpa", goal: true, span: 2, title: "Custo por venda · média móvel 7 dias" },
      { type: "funnel", span: 2, title: "Do lead à compra" },
    ],
  }),
  leads: () => ({
    kpis: [{ metric: "cpl", sub: "delta" }, { metric: "leads", sub: "split" }, { metric: "qualified", sub: "ofLeads" }, { metric: "spend", sub: "budget", highlight: true }],
    widgets: [
      { type: "line", metric: "cpl", goal: true, span: 2, title: "Custo por lead · média móvel 7 dias" },
      { type: "funnel", span: 1, title: "Do clique ao lead qualificado" },
      { type: "bars", source: "campaigns", metric: "cpa", reference: "goal", span: 1, title: "CPL por campanha" },
    ],
  }),
  imob: () => ({
    kpis: [{ metric: "cplq", sub: "delta", highlight: true }, { metric: "qualified", sub: "ofLeads" }, { metric: "visits", sub: "delta" }, { metric: "spend", sub: "budget" }],
    widgets: [
      { type: "scatter", span: 2, title: "Investimento × custo por lead, por empreendimento" },
      { type: "funnel", span: 2, title: "Lead → visita → proposta" },
    ],
  }),
  local: () => ({
    kpis: [{ metric: "cpa", sub: "delta" }, { metric: "conversions", sub: "split" }, { metric: "calls", sub: "delta" }, { metric: "spend", sub: "budget", highlight: true }],
    widgets: [
      { type: "line", metric: "cpa", goal: true, span: 2, title: "Custo por conversa · média móvel 7 dias" },
      { type: "bars", source: "campaigns", metric: "conversions", span: 2, title: "Conversas por campanha" },
    ],
  }),
  midia: () => ({
    kpis: [{ metric: "conversions", sub: "delta" }, { metric: "cpa", sub: "delta" }, { metric: "ctr", sub: "delta" }, { metric: "cpm", sub: "delta", highlight: true }],
    widgets: [
      { type: "line", metric: "cpa", goal: true, span: 2, title: "Custo por resultado · média móvel 7 dias" },
      { type: "bars", source: "campaigns", metric: "cpa", reference: "goal", span: 2, title: "Custo por resultado, por campanha" },
    ],
  }),
  pesquisa: () => ({
    kpis: [{ metric: "conversions", sub: "delta" }, { metric: "cpa", sub: "delta" }, { metric: "ctr", sub: "delta" }, { metric: "cpc", sub: "delta", highlight: true }],
    widgets: [
      { type: "line", metric: "cpa", goal: true, span: 2, title: "Custo por conversão · média móvel 7 dias" },
      { type: "table", source: "campaigns", span: 2, title: "Campanhas de pesquisa" },
    ],
  }),
  agencia: () => ({
    kpis: [{ metric: "spend", sub: "delta" }, { metric: "conversions", sub: "delta" }, { metric: "cpa", sub: "delta", highlight: true }, { metric: "ctr", sub: "delta" }],
    widgets: [
      { type: "table", source: "clients", span: 2, title: "Clientes e alvo de CPA" },
      { type: "bars", source: "clients", metric: "spend", span: 2, title: "Investimento por cliente" },
    ],
  }),
  saude: () => ({
    kpis: [{ metric: "cpa", sub: "delta", highlight: true }, { metric: "conversions", sub: "delta" }, { metric: "leads", sub: "split" }, { metric: "spend", sub: "budget" }],
    widgets: [
      { type: "line", metric: "cpa", goal: true, span: 2, title: "Custo por agendamento · média móvel 7 dias" },
      { type: "funnel", span: 2, title: "Do lead à consulta" },
    ],
  }),
  educacao: () => ({
    kpis: [{ metric: "conversions", sub: "delta" }, { metric: "cpa", sub: "delta", highlight: true }, { metric: "leads", sub: "split" }, { metric: "cpl", sub: "delta" }],
    widgets: [
      { type: "line", metric: "cpa", goal: true, span: 2, title: "Custo por matrícula · média móvel 7 dias" },
      { type: "funnel", span: 2, title: "Do lead à matrícula" },
    ],
  }),
  video: () => ({
    kpis: [{ metric: "views", sub: "delta" }, { metric: "cpv", sub: "delta", highlight: true }, { metric: "viewRate", sub: "delta" }, { metric: "clicks", sub: "delta" }],
    widgets: [
      { type: "line", metric: "cpv", span: 2, title: "Custo por visualização · média móvel 7 dias" },
      { type: "bars", source: "campaigns", metric: "conversions", span: 2, title: "Visualizações por formato" },
    ],
  }),
};

export const PAGES: Record<PageId, PageDef> = {
  "visao-geral": { id: "visao-geral", name: "Visão geral", tier: "base", description: "Os números que decidem o mês no topo.", build: (ctx) => OVERVIEW[ctx.profile](ctx) },
  "por-plataforma": {
    id: "por-plataforma",
    name: "Por plataforma",
    tier: "base",
    description: "Meta, Google Ads e GA4 lado a lado, com o que cada uma atribui.",
    build: () => ({
      kpis: [{ metric: "spend", sub: "delta" }, { metric: "ctr", sub: "delta" }, { metric: "cpc", sub: "delta" }, { metric: "conversions", sub: "split" }],
      widgets: [
        { type: "platforms", span: 4, title: "Cada plataforma" },
        { type: "split", span: 2, title: "Atribuído pelas plataformas × confirmado" },
        { type: "bars", source: "platforms", metric: "cpa", span: 2, title: "Custo por conversão atribuída" },
      ],
    }),
  },
  campanhas: {
    id: "campanhas",
    name: "Campanhas",
    tier: "base",
    description: "Tabela de campanhas com custo, resultado e eficiência.",
    build: ({ profile }) => ({
      kpis: [{ metric: "spend", sub: "delta" }, { metric: "conversions", sub: "delta" }, { metric: "cpa", sub: "delta" }, { metric: "ctr", sub: "delta" }],
      widgets: [
        profile === "ecommerce" || profile === "marketplace" || profile === "executivo" || profile === "infoproduto"
          ? { type: "bars", source: "campaigns", metric: "roas", reference: "breakEven", span: 4, title: "ROAS por campanha · linha de equilíbrio" }
          : { type: "bars", source: "campaigns", metric: "cpa", reference: "goal", span: 4, title: "Custo por conversão, por campanha · alvo" },
        { type: "table", source: "campaigns", span: 4, title: "Todas as campanhas" },
      ],
    }),
  },
  funil: {
    id: "funil",
    name: "Funil",
    tier: "base",
    description: "A passagem entre etapas e onde está a maior queda.",
    build: () => ({
      kpis: [{ metric: "sessions", sub: "delta" }, { metric: "convRate", sub: "delta" }, { metric: "conversions", sub: "delta" }, { metric: "cpa", sub: "delta" }],
      widgets: [
        { type: "funnel", span: 2, title: "Funil do período" },
        { type: "line", metric: "convRate", span: 2, title: "Taxa de conversão · média móvel 7 dias" },
      ],
    }),
  },
  criativos: {
    id: "criativos",
    name: "Criativos",
    // a página é de todos os planos; o que muda é a profundidade (ENTITLEMENTS.creatives)
    tier: "base",
    description: "Grade de anúncios com CTR, CPA e frequência.",
    build: () => ({
      kpis: [{ metric: "ctr", sub: "delta" }, { metric: "cpa", sub: "delta" }, { metric: "frequency", sub: "delta" }, { metric: "cpm", sub: "delta" }],
      widgets: [{ type: "creatives", span: 4, title: "Anúncios do período" }],
    }),
  },
  // orgânico (Instagram e Página do Facebook): só nos modelos com dados reais do Meta
  organico: {
    id: "organico",
    name: "Orgânico",
    tier: "base",
    templateOnly: true,
    description: "Seguidores, visualizações, alcance e engajamento do Instagram e da Página.",
    build: () => ({ kpis: [], widgets: [] }),
  },
  conteudo: {
    id: "conteudo",
    name: "Conteúdo",
    tier: "base",
    templateOnly: true,
    description: "Ranking de posts, reels e stories por interações, e o que cada formato entrega.",
    build: () => ({ kpis: [], widgets: [] }),
  },
  // ---- páginas por plataforma (montadas pelas contas escolhidas) ----
  "meta-ads": {
    id: "meta-ads",
    name: "Meta Ads",
    tier: "base",
    templateOnly: true,
    description: "Só os números da Meta: investimento, resultado e as campanhas dela.",
    build: (ctx) => {
      const base = OVERVIEW[ctx.profile]({ ...ctx, sources: ["meta"] });
      return { kpis: base.kpis, widgets: [...base.widgets.filter((w) => w.type !== "platforms" && w.type !== "split"), { type: "table", source: "campaigns", span: 4, title: "Campanhas da Meta" }] };
    },
  },
  "google-ads": {
    id: "google-ads",
    name: "Google Ads",
    tier: "base",
    templateOnly: true,
    description: "Só os números do Google Ads: investimento, resultado e as campanhas dele.",
    build: (ctx) => {
      const base = OVERVIEW[ctx.profile]({ ...ctx, sources: ["google"] });
      return { kpis: base.kpis, widgets: [...base.widgets.filter((w) => w.type !== "platforms" && w.type !== "split"), { type: "table", source: "campaigns", span: 4, title: "Campanhas do Google Ads" }] };
    },
  },
  site: {
    id: "site",
    name: "Site (GA4)",
    tier: "base",
    templateOnly: true,
    description: "Sessões, usuários, conversões e receita do site, por dia e por canal.",
    build: () => ({ kpis: [], widgets: [] }),
  },
  "canais-site": {
    id: "canais-site",
    name: "Força dos canais",
    tier: "base",
    templateOnly: true,
    description: "Cada canal do GA4 com o investimento das plataformas: quem traz conversão e a que custo.",
    build: () => ({ kpis: [], widgets: [] }),
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    tier: "base",
    templateOnly: true,
    description: "Seguidores, visualizações, alcance, interações e os posts do perfil.",
    build: () => ({ kpis: [], widgets: [] }),
  },
  "pagina-facebook": {
    id: "pagina-facebook",
    name: "Página do Facebook",
    tier: "base",
    templateOnly: true,
    description: "Seguidores, visualizações, alcance, interações e os posts da Página.",
    build: () => ({ kpis: [], widgets: [] }),
  },
  metas: {
    id: "metas",
    name: "Metas e progresso",
    tier: "pro",
    description: "Barras de progresso, pacing de verba e projeção do mês.",
    build: () => ({
      kpis: [{ metric: "spend", sub: "budget", highlight: true }, { metric: "conversions", sub: "delta" }, { metric: "cpa", sub: "goal" }, { metric: "roas", sub: "breakEven" }],
      widgets: [
        { type: "goals", span: 2, title: "Metas do mês" },
        { type: "line", metric: "cpa", goal: true, span: 2, title: "Custo por conversão × alvo" },
      ],
    }),
  },
  publico: {
    id: "publico",
    name: "Público",
    tier: "pro",
    description: "Idade e gênero, com o custo por conversão de cada faixa.",
    build: () => ({ kpis: [], widgets: [{ type: "audience", span: 4, title: "Quem converte" }] }),
  },
  comparativo: {
    id: "comparativo",
    name: "Comparativo de períodos",
    tier: "pro",
    description: "Este período contra o anterior, métrica por métrica.",
    build: ({ profile }) => ({
      kpis: [],
      widgets: [
        { type: "compare", span: 2, title: "Este período × anterior" },
        { type: "line", metric: profile === "site" ? "sessions" : "cpa", span: 2, title: "Tendência · média móvel 7 dias" },
      ],
    }),
  },
  "leads-crm": {
    id: "leads-crm",
    name: "Leads e CRM",
    tier: "avancado",
    description: "Do lead à venda, com as etapas do CRM e o valor em cada uma.",
    build: () => ({
      kpis: [{ metric: "leads", sub: "delta" }, { metric: "cpl", sub: "delta" }, { metric: "qualified", sub: "ofLeads" }, { metric: "conversions", sub: "delta", highlight: true }],
      widgets: [{ type: "crm", span: 4, title: "Etapas do CRM" }],
    }),
  },
  produtos: {
    id: "produtos",
    name: "Produtos",
    tier: "avancado",
    description: "Os produtos que vendem e o retorno de cada um.",
    build: () => ({ kpis: [], widgets: [{ type: "table", source: "products", span: 4, title: "Produtos" }] }),
  },
  audio: {
    id: "audio",
    name: "Análise por áudio",
    tier: "avancado",
    soon: true,
    description: "Pergunte em voz alta e ouça a leitura dos números.",
    build: () => ({ kpis: [], widgets: [{ type: "audio", span: 4, title: "Análise por áudio" }] }),
  },
  carteira: {
    id: "carteira",
    name: "Carteira de clientes",
    tier: "pro",
    templateOnly: true,
    description: "Todos os clientes da agência, com status contra a meta.",
    build: () => ({
      kpis: [{ metric: "spend", sub: "delta" }, { metric: "conversions", sub: "delta" }, { metric: "cpa", sub: "delta", highlight: true }, { metric: "ctr", sub: "delta" }],
      widgets: [{ type: "table", source: "clients", span: 4, title: "Carteira" }],
    }),
  },
  canais: {
    id: "canais",
    name: "Comparativo de canais",
    tier: "avancado",
    templateOnly: true,
    description: "Custo e retorno de cada canal, na mesma régua.",
    build: () => ({
      kpis: [{ metric: "spend", sub: "delta" }, { metric: "conversions", sub: "split" }, { metric: "cpa", sub: "delta" }, { metric: "roas", sub: "breakEven", highlight: true }],
      widgets: [
        { type: "bars", source: "platforms", metric: "cpa", span: 2, title: "Custo por conversão atribuída, por canal" },
        { type: "split", span: 2, title: "Atribuído × confirmado" },
        { type: "platforms", span: 4, title: "Cada canal" },
      ],
    }),
  },
  "saude-conta": {
    id: "saude-conta",
    name: "Saúde da conta",
    tier: "avancado",
    templateOnly: true,
    description: "Alertas de CPA, frequência, maturação e tags.",
    build: () => ({
      kpis: [{ metric: "cpa", sub: "goal" }, { metric: "frequency", sub: "delta" }, { metric: "ctr", sub: "delta" }, { metric: "spend", sub: "budget" }],
      widgets: [
        { type: "alerts", span: 2, title: "Alertas" },
        { type: "line", metric: "cpa", goal: true, span: 2, title: "CPA × alvo" },
      ],
    }),
  },
  executivo: {
    id: "executivo",
    name: "Resumo executivo",
    tier: "avancado",
    templateOnly: true,
    description: "Uma página para a diretoria: quatro números e a tendência.",
    build: (ctx) => OVERVIEW.executivo(ctx),
  },
  termos: {
    id: "termos",
    name: "Termos de pesquisa",
    tier: "pro",
    templateOnly: true,
    description: "O que as pessoas buscaram antes de clicar, com custo e conversões.",
    build: () => ({
      kpis: [{ metric: "clicks", sub: "delta" }, { metric: "cpc", sub: "delta" }, { metric: "conversions", sub: "delta" }, { metric: "cpa", sub: "delta", highlight: true }],
      widgets: [{ type: "table", source: "campaigns", span: 4, title: "Campanhas de pesquisa" }],
    }),
  },
};

/** Páginas que aparecem na biblioteca do fluxo, por nível. */
export const PAGE_LIBRARY: PageId[] = ["visao-geral", "por-plataforma", "campanhas", "funil", "criativos", "metas", "publico", "comparativo", "leads-crm", "produtos", "audio"];
