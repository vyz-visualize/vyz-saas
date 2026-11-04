// O que o gerador simula: uma loja de moda e casa com o mesmo catálogo nas duas
// plataformas, as campanhas típicas de e-commerce no Meta e no Google, os
// criativos, os termos de pesquisa e o perfil do público. Faixas de números
// por campanha (ROAS, CTR, CPM/CPC) em BRL; a conta sorteia dentro delas.

import type { AdFormat, CampaignChannel, FunnelStage, MatchType } from "../dataset";

type Range = readonly [number, number];

// ---- catálogo -----------------------------------------------------------------------

export type ProductSpec = { sku: string; title: string; category: string; price: number; popularity: number };

export const PRODUCTS: readonly ProductSpec[] = [
  { sku: "VES-MIDI-0142", title: "Vestido midi floral", category: "Vestidos", price: 189.9, popularity: 1 },
  { sku: "VES-LINH-0217", title: "Vestido de linho com botões", category: "Vestidos", price: 239.9, popularity: 0.55 },
  { sku: "BLU-TRIC-0331", title: "Blusa de tricô canelada", category: "Blusas", price: 129.9, popularity: 0.6 },
  { sku: "CAM-LINH-0408", title: "Camisa de linho masculina", category: "Camisas", price: 159.9, popularity: 0.35 },
  { sku: "CAL-WIDE-0519", title: "Calça wide leg de alfaiataria", category: "Calças", price: 199.9, popularity: 0.5 },
  { sku: "JAQ-JEAN-0623", title: "Jaqueta jeans oversized", category: "Casacos", price: 259.9, popularity: 0.3 },
  { sku: "TEN-COUR-0705", title: "Tênis casual de couro", category: "Calçados", price: 299.9, popularity: 0.65 },
  { sku: "BOL-COUR-0811", title: "Bolsa tiracolo de couro", category: "Acessórios", price: 279.9, popularity: 0.4 },
  { sku: "CAM-QUEE-0902", title: "Jogo de cama queen 400 fios", category: "Cama", price: 349.9, popularity: 0.8 },
  { sku: "TOA-BANH-1014", title: "Kit 4 toalhas de banho", category: "Banho", price: 149.9, popularity: 0.6 },
  { sku: "ALM-LINH-1120", title: "Capa de almofada de linho", category: "Decoração", price: 69.9, popularity: 0.45 },
  { sku: "MAN-SOFA-1236", title: "Manta para sofá em tricô", category: "Decoração", price: 179.9, popularity: 0.3 },
  { sku: "LUM-CERA-1309", title: "Luminária de mesa de cerâmica", category: "Decoração", price: 229.9, popularity: 0.25 },
  { sku: "PAN-INOX-1418", title: "Conjunto de panelas inox 5 peças", category: "Cozinha", price: 489.9, popularity: 0.35 },
  { sku: "VAS-CERA-1527", title: "Vaso de cerâmica artesanal", category: "Decoração", price: 89.9, popularity: 0.2 },
];

// ---- Meta Ads ------------------------------------------------------------------------

export type MetaAdSpec = {
  key: string;
  name: string;
  format: Extract<AdFormat, "image" | "video" | "carousel" | "collection">;
  /** Parte da verba da campanha (relativa às outras). */
  weight: number;
  ctr: number;
  cvr: number;
  /** Multiplicador da frequência da campanha. */
  frequency?: number;
  /** Vídeo: reproduções de 3 s ÷ impressões. */
  hook?: Range;
  /** Dia em que entrou no ar, relativo à âncora (negativo = antes). Sem valor: antigo. */
  launch?: number;
  /** Pausado a partir deste dia (relativo à âncora). */
  end?: number;
  story?: "fatigue";
  headline: string;
  body: string;
  cta: string;
  path: string;
};

export type MetaCampaignSpec = {
  key: string;
  name: string;
  funnelStage: FunnelStage;
  /** Objetivo na Meta. Sem valor: vendas. Só rótulo: não muda nenhum número da campanha. */
  objective?: string;
  /** Parte da verba da conta. */
  share: number;
  roas: Range;
  /** CTR do link (cliques no link ÷ impressões). */
  ctr: Range;
  /** Multiplicador do CPM da conta (remarketing paga mais caro por impressão). */
  cpm: Range;
  /** Frequência diária (impressões ÷ alcance). */
  frequency: Range;
  /** Visualizações da página ÷ cliques no link. */
  lpv: Range;
  /** Catálogo: as vendas se dividem por produto. */
  catalog?: boolean;
  story?: "below_break_even";
  ads: readonly MetaAdSpec[];
};

export const META_CAMPAIGNS: readonly MetaCampaignSpec[] = [
  {
    key: "asc",
    name: "Prospecção · Advantage+ Shopping",
    funnelStage: "prospecting",
    share: 0.32,
    roas: [2.6, 3.4],
    ctr: [0.0105, 0.0135],
    cpm: [0.95, 1.05],
    frequency: [1.08, 1.2],
    lpv: [0.7, 0.8],
    ads: [
      { key: "asc-ugc", name: "VID · UGC provador 15s", format: "video", weight: 1, ctr: 1.15, cvr: 1.05, hook: [0.27, 0.34], headline: "Provou, amou: veja no corpo real", body: "Peças leves para a estação, com troca sem custo em 30 dias.", cta: "Comprar agora", path: "/novidades" },
      { key: "asc-reels", name: "VID · Reels bastidores", format: "video", weight: 0.7, ctr: 0.95, cvr: 0.95, hook: [0.22, 0.29], headline: "Do ateliê para o seu guarda-roupa", body: "Conheça quem faz cada peça.", cta: "Saiba mais", path: "/sobre" },
      { key: "asc-frete", name: "IMG · Frete zero acima de R$ 299", format: "image", weight: 0.55, ctr: 0.9, cvr: 1, headline: "Frete zero acima de R$ 299", body: "Para todo o Brasil, em até 10x sem juros.", cta: "Comprar agora", path: "/ofertas" },
      { key: "asc-maisvendidos", name: "CAR · Mais vendidos da semana", format: "carousel", weight: 0.8, ctr: 1.05, cvr: 1.1, headline: "Os mais vendidos da semana", body: "Os favoritos de quem já comprou.", cta: "Comprar agora", path: "/mais-vendidos" },
      { key: "asc-primavera", name: "VID · Coleção Primavera", format: "video", weight: 0.75, ctr: 1.2, cvr: 1, hook: [0.3, 0.37], launch: -9, headline: "Chegou a coleção Primavera", body: "Cores e tecidos para os dias mais quentes.", cta: "Ver mais", path: "/colecao-primavera" },
    ],
  },
  {
    key: "lal",
    name: "Prospecção · Lookalike 1% compradores",
    funnelStage: "prospecting",
    share: 0.15,
    roas: [2.2, 2.9],
    ctr: [0.01, 0.013],
    cpm: [1, 1.1],
    frequency: [1.1, 1.25],
    lpv: [0.7, 0.8],
    ads: [
      { key: "lal-depoimento", name: "VID · Depoimento de cliente 30s", format: "video", weight: 1, ctr: 1, cvr: 1.15, hook: [0.2, 0.27], headline: "Quem compra, volta", body: "Mais de 20 mil clientes avaliam com nota 4,9.", cta: "Comprar agora", path: "/avaliacoes" },
      { key: "lal-looks", name: "COL · Looks da semana", format: "collection", weight: 0.7, ctr: 1.1, cvr: 0.95, headline: "Looks prontos para a semana", body: "Combinações pensadas pelo nosso time de estilo.", cta: "Ver mais", path: "/looks" },
      { key: "lal-inverno", name: "IMG · Coleção Inverno", format: "image", weight: 0.6, ctr: 0.85, cvr: 0.9, end: -21, headline: "Últimas peças de inverno", body: "Tricôs e casacos com até 40% off.", cta: "Comprar agora", path: "/inverno" },
      { key: "lal-nota", name: "IMG · Avaliação 4,9 de 5", format: "image", weight: 0.6, ctr: 0.95, cvr: 1.05, headline: "Nota 4,9 de 5", body: "Veja o que dizem as clientes.", cta: "Saiba mais", path: "/avaliacoes" },
    ],
  },
  {
    key: "interesses",
    name: "Prospecção · Interesses moda e casa",
    objective: "OUTCOME_LEADS",
    funnelStage: "prospecting",
    share: 0.15,
    roas: [1, 1.3],
    ctr: [0.008, 0.0105],
    cpm: [0.9, 1],
    frequency: [1.08, 1.18],
    lpv: [0.66, 0.76],
    story: "below_break_even",
    ads: [
      { key: "int-tendencias", name: "VID · Tendências da estação", format: "video", weight: 1, ctr: 0.95, cvr: 0.9, hook: [0.17, 0.24], headline: "O que vai bombar nesta estação", body: "As tendências que você vai ver por aí.", cta: "Saiba mais", path: "/tendencias" },
      { key: "int-casa", name: "CAR · Casa nova, lar novo", format: "carousel", weight: 0.8, ctr: 1.05, cvr: 0.95, headline: "Casa nova, lar novo", body: "Cama, banho e decoração com o seu jeito.", cta: "Ver mais", path: "/casa" },
      { key: "int-primeira", name: "IMG · Desconto na primeira compra", format: "image", weight: 0.6, ctr: 1, cvr: 1.1, headline: "10% off na primeira compra", body: "Use o cupom BEMVINDA no carrinho.", cta: "Comprar agora", path: "/primeira-compra" },
    ],
  },
  {
    key: "remarketing",
    name: "Remarketing · Visitantes 30 dias",
    funnelStage: "retargeting",
    share: 0.14,
    roas: [4.2, 5.6],
    ctr: [0.0145, 0.019],
    cpm: [1.3, 1.45],
    frequency: [1.35, 1.6],
    lpv: [0.78, 0.86],
    ads: [
      { key: "rmk-oferta", name: "IMG · Oferta 15% OFF", format: "image", weight: 1.3, ctr: 1.3, cvr: 1.1, frequency: 0.85, launch: -34, story: "fatigue", headline: "15% OFF só esta semana", body: "Aquela peça que você viu está com desconto.", cta: "Comprar agora", path: "/ofertas" },
      { key: "rmk-carrinho", name: "CAR · Você esqueceu no carrinho", format: "carousel", weight: 0.8, ctr: 1, cvr: 1.1, headline: "Ainda está aqui", body: "Os itens do seu carrinho estão esperando.", cta: "Comprar agora", path: "/carrinho" },
      { key: "rmk-depoimentos", name: "VID · Depoimentos 15s", format: "video", weight: 0.6, ctr: 0.9, cvr: 0.95, hook: [0.24, 0.32], headline: "Quem comprou, recomenda", body: "Avaliações reais de clientes.", cta: "Saiba mais", path: "/avaliacoes" },
      { key: "rmk-troca", name: "IMG · Troca sem custo em 30 dias", format: "image", weight: 0.5, ctr: 0.85, cvr: 0.9, headline: "Troca sem custo em 30 dias", body: "Compre sem medo de errar o tamanho.", cta: "Comprar agora", path: "/trocas" },
    ],
  },
  {
    key: "catalogo",
    name: "Catálogo · Remarketing dinâmico",
    funnelStage: "retargeting",
    share: 0.17,
    roas: [5, 7.2],
    ctr: [0.0135, 0.018],
    cpm: [1.25, 1.4],
    frequency: [1.3, 1.55],
    lpv: [0.8, 0.88],
    catalog: true,
    ads: [
      { key: "dpa-vistos", name: "CAR · Catálogo · Produtos vistos", format: "carousel", weight: 1, ctr: 1.05, cvr: 1.05, headline: "Os produtos que você viu", body: "Com frete zero acima de R$ 299.", cta: "Comprar agora", path: "/catalogo" },
      { key: "dpa-colecao", name: "COL · Catálogo · Coleção", format: "collection", weight: 0.6, ctr: 0.95, cvr: 0.95, headline: "Combine com o que você viu", body: "Peças que combinam com o seu estilo.", cta: "Ver mais", path: "/catalogo" },
      { key: "dpa-item", name: "IMG · Catálogo · Item único", format: "image", weight: 0.5, ctr: 0.95, cvr: 1, headline: "Volte e garanta o seu", body: "Estoque limitado.", cta: "Comprar agora", path: "/catalogo" },
    ],
  },
  {
    key: "retencao",
    name: "Retenção · Clientes 180 dias",
    objective: "OUTCOME_ENGAGEMENT",
    funnelStage: "retention",
    share: 0.07,
    roas: [3.8, 5.2],
    ctr: [0.012, 0.0165],
    cpm: [1.15, 1.3],
    frequency: [1.4, 1.75],
    lpv: [0.8, 0.88],
    ads: [
      { key: "ret-novidades", name: "CAR · Novidades para você", format: "carousel", weight: 1, ctr: 1.05, cvr: 1.05, headline: "Novidades escolhidas para você", body: "Com base nas suas últimas compras.", cta: "Ver mais", path: "/novidades" },
      { key: "ret-vip", name: "IMG · Acesso antecipado VIP", format: "image", weight: 0.7, ctr: 1, cvr: 1.1, headline: "Acesso antecipado para clientes", body: "A nova coleção abre para você 48 h antes.", cta: "Comprar agora", path: "/vip" },
      { key: "ret-bastidores", name: "VID · Bastidores da coleção", format: "video", weight: 0.5, ctr: 0.9, cvr: 0.85, hook: [0.25, 0.33], headline: "Como nasce uma coleção", body: "Do desenho à costura.", cta: "Saiba mais", path: "/sobre" },
    ],
  },
];

// ---- Google Ads ------------------------------------------------------------------------

export type GoogleAdSpec = {
  key: string;
  name: string;
  format: Extract<AdFormat, "text" | "responsive" | "shopping" | "video">;
  weight: number;
  ctr: number;
  cvr: number;
  headline: string;
  body: string;
  path: string;
};

export type GoogleCampaignSpec = {
  key: string;
  name: string;
  channel: CampaignChannel;
  funnelStage: FunnelStage | null;
  share: number;
  roas: Range;
  /** Cobrança por clique (pesquisa, Shopping, PMax) ou por mil impressões (display, vídeo). */
  billing: "cpc" | "cpm";
  /** CPC ou CPM, conforme a cobrança. */
  cost: Range;
  ctr: Range;
  /** Pesquisa: parcela de impressões e perda por orçamento (o resto é perda por classificação). */
  impressionShare?: { share: Range; lostBudget: Range };
  /** Vídeo: visualizações ÷ impressões e quem assiste até o fim ÷ visualizações. */
  video?: { viewRate: Range; thruRate: Range };
  /** Shopping e PMax: as vendas se dividem por produto. */
  products?: boolean;
  searchTerms?: "brand" | "generic";
  story?: "below_break_even";
  ads: readonly GoogleAdSpec[];
};

export const GOOGLE_CAMPAIGNS: readonly GoogleCampaignSpec[] = [
  {
    key: "pmax",
    name: "Performance Max · Coleção completa",
    channel: "performance_max",
    funnelStage: null,
    share: 0.36,
    roas: [3.6, 4.6],
    billing: "cpc",
    cost: [0.85, 1.35],
    ctr: [0.03, 0.042],
    products: true,
    ads: [
      { key: "pmax-moda", name: "Grupo de recursos · Moda feminina", format: "responsive", weight: 1, ctr: 1.05, cvr: 1, headline: "Moda feminina com frete zero", body: "Vestidos, blusas e calças em até 10x sem juros.", path: "/moda-feminina" },
      { key: "pmax-casa", name: "Grupo de recursos · Casa e decoração", format: "responsive", weight: 0.8, ctr: 0.95, cvr: 1, headline: "Cama, banho e decoração", body: "Deixe a casa com a sua cara.", path: "/casa" },
    ],
  },
  {
    key: "shopping",
    name: "Shopping · Catálogo inteiro",
    channel: "shopping",
    funnelStage: null,
    share: 0.17,
    roas: [3, 4],
    billing: "cpc",
    cost: [0.6, 0.95],
    ctr: [0.018, 0.026],
    products: true,
    ads: [{ key: "shop-catalogo", name: "Anúncio do Shopping · Catálogo", format: "shopping", weight: 1, ctr: 1, cvr: 1, headline: "Catálogo completo", body: "Todos os produtos da loja.", path: "/catalogo" }],
  },
  {
    key: "marca",
    name: "Pesquisa · Marca",
    channel: "search",
    funnelStage: null,
    share: 0.07,
    roas: [14, 22],
    billing: "cpc",
    cost: [0.35, 0.75],
    ctr: [0.17, 0.27],
    impressionShare: { share: [0.86, 0.94], lostBudget: [0, 0.015] },
    searchTerms: "brand",
    ads: [
      { key: "marca-inst", name: "RSA · Marca · Site oficial", format: "text", weight: 1, ctr: 1.05, cvr: 1, headline: "Site oficial · Frete zero acima de R$ 299", body: "Moda e casa com troca sem custo em 30 dias. Compre em até 10x.", path: "/" },
      { key: "marca-frete", name: "RSA · Marca · Ofertas", format: "text", weight: 0.6, ctr: 0.95, cvr: 1, headline: "Ofertas da semana no site oficial", body: "Peças selecionadas com até 30% off.", path: "/ofertas" },
    ],
  },
  {
    key: "genericas",
    name: "Pesquisa · Categorias genéricas",
    channel: "search",
    funnelStage: null,
    share: 0.25,
    roas: [1.25, 1.6],
    billing: "cpc",
    cost: [1.3, 2.3],
    ctr: [0.042, 0.062],
    impressionShare: { share: [0.38, 0.52], lostBudget: [0.16, 0.27] },
    searchTerms: "generic",
    story: "below_break_even",
    ads: [
      { key: "gen-vestidos", name: "RSA · Vestidos", format: "text", weight: 1, ctr: 1.05, cvr: 1, headline: "Vestidos midi e longos", body: "Tecidos leves e caimento perfeito. Troca sem custo.", path: "/vestidos" },
      { key: "gen-cama", name: "RSA · Cama e banho", format: "text", weight: 0.8, ctr: 0.95, cvr: 1.05, headline: "Jogos de cama 400 fios", body: "Algodão egípcio com entrega rápida.", path: "/cama-e-banho" },
      { key: "gen-decor", name: "RSA · Decoração", format: "text", weight: 0.6, ctr: 0.95, cvr: 0.95, headline: "Decoração artesanal", body: "Vasos, almofadas e luminárias.", path: "/decoracao" },
    ],
  },
  {
    key: "display",
    name: "Display · Remarketing 30 dias",
    channel: "display",
    funnelStage: "retargeting",
    share: 0.09,
    roas: [2.4, 3.4],
    billing: "cpm",
    cost: [9, 14],
    ctr: [0.007, 0.011],
    ads: [
      { key: "disp-volte", name: "Display responsivo · Volte e ganhe 10%", format: "responsive", weight: 1, ctr: 1.05, cvr: 1.05, headline: "Volte e ganhe 10% off", body: "Cupom VOLTEI no carrinho.", path: "/ofertas" },
      { key: "disp-maisvendidos", name: "Display responsivo · Mais vendidos", format: "responsive", weight: 0.7, ctr: 0.95, cvr: 0.95, headline: "Os mais vendidos", body: "Os favoritos das clientes.", path: "/mais-vendidos" },
    ],
  },
  {
    key: "youtube",
    name: "YouTube · Vídeo da coleção",
    channel: "video",
    funnelStage: "prospecting",
    share: 0.06,
    roas: [0.6, 1.1],
    billing: "cpm",
    cost: [14, 20],
    ctr: [0.0025, 0.0045],
    video: { viewRate: [0.18, 0.3], thruRate: [0.28, 0.42] },
    ads: [
      { key: "yt-colecao", name: "YouTube · Coleção 30s", format: "video", weight: 1, ctr: 1, cvr: 1, headline: "A nova coleção chegou", body: "Assista e descubra as peças da estação.", path: "/colecao-primavera" },
      { key: "yt-shorts", name: "Shorts · Looks 15s", format: "video", weight: 0.8, ctr: 1.1, cvr: 0.9, headline: "3 looks em 15 segundos", body: "Inspirações para a semana.", path: "/looks" },
    ],
  },
];

export type SearchTermSpec = {
  /** "{marca}" vira o nome da loja. */
  term: string;
  /** Semente dos sorteios, quando o texto mudou: trocar a redação não muda os números. */
  seed?: string;
  matchType: MatchType;
  weight: number;
  ctr: number;
  /** 0 = não converte (desperdício). */
  cvr: number;
  /** Chance de aparecer num dia (termos pequenos somem em alguns dias). */
  presence: number;
};

export const BRAND_TERMS: readonly SearchTermSpec[] = [
  { term: "{marca}", matchType: "exact", weight: 1, ctr: 1.1, cvr: 1.05, presence: 1 },
  { term: "{marca} site oficial", matchType: "phrase", weight: 0.35, ctr: 1.05, cvr: 1.1, presence: 1 },
  { term: "site {marca}", matchType: "near_exact", weight: 0.2, ctr: 1, cvr: 1, presence: 0.95 },
  { term: "{marca} cupom", matchType: "phrase", weight: 0.25, ctr: 0.95, cvr: 1.15, presence: 0.95 },
  { term: "{marca} vestido", matchType: "phrase", weight: 0.18, ctr: 0.9, cvr: 0.9, presence: 0.9 },
  { term: "{marca} frete zero", seed: "{marca} frete gr\u00e1tis", matchType: "near_phrase", weight: 0.12, ctr: 0.9, cvr: 0.85, presence: 0.8 },
];

export const GENERIC_TERMS: readonly SearchTermSpec[] = [
  { term: "vestido midi floral", matchType: "phrase", weight: 1, ctr: 1.1, cvr: 1.25, presence: 1 },
  { term: "vestido de linho", matchType: "phrase", weight: 0.7, ctr: 1.05, cvr: 1.1, presence: 1 },
  { term: "jogo de cama queen 400 fios", matchType: "exact", weight: 0.75, ctr: 1.15, cvr: 1.3, presence: 1 },
  { term: "kit toalha de banho", matchType: "broad", weight: 0.5, ctr: 0.95, cvr: 1, presence: 1 },
  { term: "blusa de tricô feminina", matchType: "broad", weight: 0.55, ctr: 1, cvr: 0.95, presence: 1 },
  { term: "calça wide leg", matchType: "phrase", weight: 0.6, ctr: 1.05, cvr: 1, presence: 1 },
  { term: "camisa de linho masculina", matchType: "broad", weight: 0.35, ctr: 0.95, cvr: 0.9, presence: 0.95 },
  { term: "jaqueta jeans oversized", matchType: "phrase", weight: 0.3, ctr: 1, cvr: 0.9, presence: 0.9 },
  { term: "tênis casual de couro", matchType: "broad", weight: 0.45, ctr: 0.9, cvr: 0.85, presence: 1 },
  { term: "bolsa tiracolo couro", matchType: "phrase", weight: 0.35, ctr: 1, cvr: 0.95, presence: 0.95 },
  { term: "capa de almofada linho", matchType: "broad", weight: 0.3, ctr: 1, cvr: 1, presence: 0.9 },
  { term: "manta para sofá", matchType: "phrase", weight: 0.3, ctr: 0.95, cvr: 0.9, presence: 0.9 },
  { term: "luminária de mesa", matchType: "broad", weight: 0.3, ctr: 0.9, cvr: 0.8, presence: 0.85 },
  { term: "conjunto de panelas inox", matchType: "phrase", weight: 0.35, ctr: 0.95, cvr: 0.95, presence: 0.9 },
  { term: "vaso de cerâmica", matchType: "broad", weight: 0.25, ctr: 0.95, cvr: 0.85, presence: 0.85 },
  { term: "roupa feminina", matchType: "broad", weight: 0.65, ctr: 0.75, cvr: 0.6, presence: 1 },
  { term: "loja de decoração online", matchType: "broad", weight: 0.35, ctr: 0.8, cvr: 0.7, presence: 0.9 },
  { term: "vestido para casamento de dia", matchType: "near_phrase", weight: 0.3, ctr: 0.95, cvr: 0.8, presence: 0.8 },
  { term: "vestido de noiva aluguel", matchType: "broad", weight: 0.4, ctr: 0.85, cvr: 0, presence: 0.95 },
  { term: "molde de vestido para baixar", seed: "molde de vestido gr\u00e1tis", matchType: "broad", weight: 0.35, ctr: 0.9, cvr: 0, presence: 0.9 },
  { term: "como fazer capa de almofada", matchType: "broad", weight: 0.25, ctr: 0.8, cvr: 0, presence: 0.85 },
  { term: "panela de pressão elétrica", matchType: "broad", weight: 0.3, ctr: 0.7, cvr: 0, presence: 0.85 },
  { term: "vaga de emprego loja de roupas", matchType: "broad", weight: 0.2, ctr: 0.75, cvr: 0, presence: 0.8 },
  { term: "vestido usado barato", matchType: "broad", weight: 0.25, ctr: 0.85, cvr: 0, presence: 0.8 },
];

// ---- público e contexto ---------------------------------------------------------------

/** Multiplicadores de uma fatia do público: volume, custo, CTR, conversão e ticket. */
export type Slice = { value: string; weight: number; cost?: number; ctr?: number; cvr?: number; aov?: number };

export const AGES: readonly Slice[] = [
  { value: "18-24", weight: 0.11, ctr: 1.15, cvr: 0.7, aov: 0.85 },
  { value: "25-34", weight: 0.29, ctr: 1.08, cvr: 0.95, aov: 0.95 },
  { value: "35-44", weight: 0.27, ctr: 1, cvr: 1.1, aov: 1.05 },
  { value: "45-54", weight: 0.18, ctr: 0.95, cvr: 1.15, aov: 1.1 },
  { value: "55-64", weight: 0.11, ctr: 0.9, cvr: 1.05, aov: 1.1 },
  { value: "65+", weight: 0.04, ctr: 0.85, cvr: 0.9, aov: 1 },
];

export const GENDER_SHAPE: readonly Slice[] = [
  { value: "female", weight: 0.65, ctr: 1.05, cvr: 1.05, aov: 1 },
  { value: "male", weight: 0.32, ctr: 0.92, cvr: 0.9, aov: 1.05 },
  { value: "unknown", weight: 0.03, ctr: 0.9, cvr: 0.8, aov: 1 },
];

export const META_PLACEMENTS: readonly Slice[] = [
  { value: "instagram_feed", weight: 0.25, cost: 1.15, ctr: 1.1, cvr: 1.05 },
  { value: "instagram_stories", weight: 0.2, cost: 0.85, ctr: 0.9, cvr: 0.95 },
  { value: "instagram_reels", weight: 0.16, cost: 0.8, ctr: 0.85, cvr: 0.9 },
  { value: "facebook_feed", weight: 0.2, cost: 1.1, ctr: 1.15, cvr: 1.1 },
  { value: "facebook_reels", weight: 0.05, cost: 0.75, ctr: 0.8, cvr: 0.8 },
  { value: "instagram_explore", weight: 0.03, cost: 0.95, ctr: 0.95, cvr: 0.9 },
  { value: "facebook_marketplace", weight: 0.04, cost: 0.9, ctr: 1, cvr: 0.95 },
  { value: "audience_network", weight: 0.05, cost: 0.45, ctr: 0.6, cvr: 0.35 },
  { value: "messenger_inbox", weight: 0.02, cost: 0.7, ctr: 0.7, cvr: 0.6 },
];

export const META_DEVICES: readonly Slice[] = [
  { value: "android", weight: 0.64, cost: 0.92, ctr: 1, cvr: 0.9, aov: 0.95 },
  { value: "iphone", weight: 0.29, cost: 1.25, ctr: 1.02, cvr: 1.2, aov: 1.12 },
  { value: "desktop", weight: 0.05, cost: 1.35, ctr: 0.9, cvr: 1.3, aov: 1.08 },
  { value: "tablet", weight: 0.02, cost: 1, ctr: 0.95, cvr: 1, aov: 1 },
];

export const GOOGLE_DEVICES: readonly Slice[] = [
  { value: "mobile", weight: 0.63, cost: 0.95, ctr: 1, cvr: 0.85, aov: 0.95 },
  { value: "desktop", weight: 0.31, cost: 1.15, ctr: 1.05, cvr: 1.35, aov: 1.1 },
  { value: "tablet", weight: 0.05, cost: 0.95, ctr: 0.95, cvr: 1, aov: 1 },
  { value: "connected_tv", weight: 0.01, cost: 1, ctr: 0.1, cvr: 0.1, aov: 1 },
];

/** Peso de cada UF nas compras online (aproximado) e a conversão relativa. */
export const REGIONS: readonly Slice[] = [
  { value: "SP", weight: 0.33, cvr: 1.06 },
  { value: "RJ", weight: 0.12, cvr: 1.02 },
  { value: "MG", weight: 0.1, cvr: 1.03 },
  { value: "RS", weight: 0.06, cvr: 1.05 },
  { value: "PR", weight: 0.06, cvr: 1.05 },
  { value: "SC", weight: 0.04, cvr: 1.06 },
  { value: "BA", weight: 0.05, cvr: 0.9 },
  { value: "DF", weight: 0.03, cvr: 1.08, aov: 1.1 },
  { value: "GO", weight: 0.03, cvr: 0.97 },
  { value: "PE", weight: 0.03, cvr: 0.9 },
  { value: "CE", weight: 0.03, cvr: 0.9 },
  { value: "ES", weight: 0.02, cvr: 1 },
  { value: "PA", weight: 0.02, cvr: 0.85 },
  { value: "MT", weight: 0.015, cvr: 0.95 },
  { value: "MS", weight: 0.012, cvr: 0.97 },
  { value: "AM", weight: 0.012, cvr: 0.85 },
  { value: "PB", weight: 0.01, cvr: 0.88 },
  { value: "RN", weight: 0.01, cvr: 0.88 },
  { value: "MA", weight: 0.01, cvr: 0.82 },
  { value: "AL", weight: 0.008, cvr: 0.85 },
  { value: "PI", weight: 0.007, cvr: 0.82 },
  { value: "SE", weight: 0.006, cvr: 0.86 },
  { value: "RO", weight: 0.005, cvr: 0.85 },
  { value: "TO", weight: 0.004, cvr: 0.85 },
  { value: "AC", weight: 0.002, cvr: 0.8 },
  { value: "AP", weight: 0.002, cvr: 0.8 },
  { value: "RR", weight: 0.002, cvr: 0.8 },
];

/** Volume por hora do dia (picos no almoço e à noite) e conversão relativa. */
export const HOUR_SHAPE: readonly { weight: number; cvr: number }[] = [
  { weight: 0.025, cvr: 0.85 },
  { weight: 0.015, cvr: 0.75 },
  { weight: 0.009, cvr: 0.7 },
  { weight: 0.006, cvr: 0.65 },
  { weight: 0.005, cvr: 0.65 },
  { weight: 0.007, cvr: 0.7 },
  { weight: 0.015, cvr: 0.75 },
  { weight: 0.028, cvr: 0.85 },
  { weight: 0.04, cvr: 0.9 },
  { weight: 0.05, cvr: 0.95 },
  { weight: 0.055, cvr: 1 },
  { weight: 0.057, cvr: 1.02 },
  { weight: 0.056, cvr: 1.05 },
  { weight: 0.055, cvr: 1 },
  { weight: 0.054, cvr: 0.98 },
  { weight: 0.053, cvr: 0.97 },
  { weight: 0.052, cvr: 0.97 },
  { weight: 0.052, cvr: 0.98 },
  { weight: 0.055, cvr: 1.02 },
  { weight: 0.06, cvr: 1.08 },
  { weight: 0.064, cvr: 1.15 },
  { weight: 0.066, cvr: 1.18 },
  { weight: 0.058, cvr: 1.12 },
  { weight: 0.043, cvr: 1 },
];
