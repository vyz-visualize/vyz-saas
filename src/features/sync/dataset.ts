// Dados de uma conta de anúncio no formato do armazém: o que a sincronização
// grava em ad_campaigns, ads, ad_products e insights_*. Vale para qualquer
// fonte (gerador simulado hoje; APIs do Meta e do Google depois).
//
// Convenções:
//   * ids são os externos (da plataforma); a gravação troca pelos uuids do banco;
//   * datas "YYYY-MM-DD" no fuso da conta;
//   * dinheiro na moeda da conta, com 2 casas;
//   * clicks = todos os cliques; link_clicks = cliques no link (só Meta);
//   * conversions = compras (Meta, inteiras) ou conversões (Google, até 2 casas,
//     por causa da atribuição baseada em dados);
//   * null = a plataforma não tem o dado (ex.: alcance no Google Ads).

/** Plataformas que importam dados automaticamente. */
export const SYNC_PLATFORMS = ["meta", "google"] as const;

export type SyncPlatform = (typeof SYNC_PLATFORMS)[number];

export const isSyncPlatform = (value: unknown): value is SyncPlatform => (SYNC_PLATFORMS as readonly unknown[]).includes(value);

export type EntityStatus = "active" | "paused" | "archived" | "removed";
export type CampaignChannel = "search" | "performance_max" | "shopping" | "display" | "video" | "demand_gen" | "app";
export type FunnelStage = "prospecting" | "retargeting" | "retention";
export type AdFormat = "image" | "video" | "carousel" | "collection" | "text" | "shopping" | "responsive";
export type BreakdownDimension = "age" | "gender" | "age_gender" | "placement" | "device" | "region" | "hour";
export type MatchType = "exact" | "phrase" | "broad" | "near_exact" | "near_phrase" | "unknown";

// ---- entidades ------------------------------------------------------------------

export type CampaignEntity = {
  externalId: string;
  name: string;
  status: EntityStatus;
  objective: string | null;
  /** Tipo de campanha do Google Ads. */
  channel: CampaignChannel | null;
  /** Etapa do funil (Meta e remarketing do Google). */
  funnelStage: FunnelStage | null;
  dailyBudget: number | null;
  startedOn: string | null;
};

export type AdEntity = {
  externalId: string;
  campaignExternalId: string;
  name: string;
  format: AdFormat;
  status: EntityStatus;
  headline: string | null;
  body: string | null;
  callToAction: string | null;
  thumbnailUrl: string | null;
  landingUrl: string | null;
  /** Link público do post (Instagram ou Facebook), quando houver. */
  postUrl?: string | null;
};

export type ProductEntity = {
  externalId: string;
  title: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  price: number | null;
};

// ---- fatos diários --------------------------------------------------------------------

/** Colunas de métrica de insights_campaign_daily e insights_account_daily. */
export type DailyMetrics = {
  spend: number;
  impressions: number;
  reach: number | null;
  clicks: number;
  linkClicks: number | null;
  landingPageViews: number | null;
  addToCart: number | null;
  initiateCheckout: number | null;
  conversions: number;
  conversionValue: number;
  /** Meta: reproduções de 3 s. Google: visualizações do YouTube. */
  videoViews: number | null;
  /** Meta: ThruPlays. Google: vídeos assistidos até o fim. */
  videoThruplays: number | null;
  /** Parcela de impressões na pesquisa (0–1) e o que se perdeu por orçamento e por classificação. */
  searchImpressionShare: number | null;
  searchLostIsBudget: number | null;
  searchLostIsRank: number | null;
};

export type AccountDay = DailyMetrics & { date: string };

/** Google por campanha: Performance Max e Shopping não têm linha de anúncio. Os cards leem daqui, sem passar pelo total da conta. */
export type CampaignExtraMetrics = {
  allConversions?: number | null;
  interactions?: number | null;
  /** % das impressões no topo e no topo absoluto (0 a 1). */
  topImpressionPct?: number | null;
  absoluteTopImpressionPct?: number | null;
};

export type CampaignDay = DailyMetrics & CampaignExtraMetrics & { campaignExternalId: string; date: string };

/** Métricas só do anúncio (página de Criativos). Sem o dado = null ou ausente: a tela esconde. */
export type AdCreativeMetrics = {
  leads?: number | null;
  registrations?: number | null;
  postEngagement?: number | null;
  postReactions?: number | null;
  postComments?: number | null;
  postShares?: number | null;
  postSaves?: number | null;
  /** Campo real na API da Meta ainda a confirmar; hoje só o gerador preenche. */
  profileVisits?: number | null;
  videoP25?: number | null;
  videoP50?: number | null;
  videoP75?: number | null;
  videoP95?: number | null;
  videoP100?: number | null;
  /** Segundos totais assistidos no dia (média não se soma). */
  videoWatchSeconds?: number | null;
};

export type AdDay = Pick<DailyMetrics, "spend" | "impressions" | "reach" | "clicks" | "linkClicks" | "conversions" | "conversionValue" | "videoViews" | "videoThruplays"> &
  AdCreativeMetrics & {
    adExternalId: string;
    date: string;
  };

/** Métricas das quebras, dos termos e dos produtos. */
export type BasicMetrics = Pick<DailyMetrics, "spend" | "impressions" | "clicks" | "conversions" | "conversionValue">;

export type BreakdownDay = BasicMetrics & { date: string; dimension: BreakdownDimension; value: string };

export type SearchTermDay = BasicMetrics & { campaignExternalId: string; date: string; searchTerm: string; matchType: MatchType };

export type ProductDay = BasicMetrics & { productExternalId: string; date: string };

export type AccountDataset = {
  platform: SyncPlatform;
  accountExternalId: string;
  currency: string;
  /** Período coberto pelos fatos (inclusive). */
  range: { from: string; to: string };
  campaigns: CampaignEntity[];
  ads: AdEntity[];
  products: ProductEntity[];
  /** Total da conta por dia: a soma das campanhas (o banco recalcula o mesmo em rollup_account_insights). */
  accountDaily: AccountDay[];
  campaignDaily: CampaignDay[];
  adDaily: AdDay[];
  breakdownDaily: BreakdownDay[];
  searchTermDaily: SearchTermDay[];
  productDaily: ProductDay[];
};
