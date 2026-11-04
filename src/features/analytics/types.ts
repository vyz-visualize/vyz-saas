// Tipos dos dashboards com dados reais: as linhas que saem do armazém
// (insights_* em camelCase, já filtradas por conta e período) e os view models
// que a tela desenha. A agregação (aggregate.ts) liga um ao outro.

import type { Tier } from "@/features/pricing/entitlements";
import type { AdCreativeMetrics, BreakdownDimension, CampaignExtraMetrics } from "@/features/sync/dataset";

export type LivePlatform = "meta" | "google";

export type DateRange = { from: string; to: string; days: number };

// ---- linhas de entrada ----------------------------------------------------------------

export type MetricRow = {
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
  videoViews: number | null;
  videoThruplays: number | null;
  searchImpressionShare: number | null;
  searchLostIsBudget: number | null;
  searchLostIsRank: number | null;
};

export type AccountDayRow = MetricRow & { date: string };
export type CampaignDayRow = MetricRow & CampaignExtraMetrics & { campaignId: string; date: string };
export type AdDayRow = Pick<MetricRow, "spend" | "impressions" | "reach" | "clicks" | "linkClicks" | "conversions" | "conversionValue" | "videoViews" | "videoThruplays"> &
  AdCreativeMetrics & {
    adId: string;
    date: string;
  };
export type BasicRow = Pick<MetricRow, "spend" | "impressions" | "clicks" | "conversions" | "conversionValue">;
export type BreakdownDayRow = BasicRow & { date: string; dimension: BreakdownDimension | string; value: string };
export type SearchTermDayRow = BasicRow & { campaignId: string; date: string; searchTerm: string; matchType: string };
export type ProductDayRow = BasicRow & { productId: string; date: string };

export type CampaignInfo = { id: string; name: string; objective?: string | null; status: string; channel: string | null; funnelStage: string | null; dailyBudget: number | null };
export type AdInfo = { id: string; campaignId: string; postUrl?: string | null; name: string; format: string; status: string; headline: string | null; thumbnailUrl: string | null };
export type ProductInfo = { id: string; title: string; category: string | null; imageUrl: string | null; price: number | null };

/** Tudo o que a agregação precisa, já filtrado pelas contas do dashboard. */
export type WarehouseRows = {
  platform: LivePlatform;
  current: DateRange;
  previous: DateRange;
  /** Dias de current e previous. */
  accountDaily: AccountDayRow[];
  campaigns: CampaignInfo[];
  /** Períodos atual e anterior (o anterior dá a parcela de impressões de antes). */
  campaignDaily: CampaignDayRow[];
  ads: AdInfo[];
  adDaily: AdDayRow[];
  breakdownDaily: BreakdownDayRow[];
  searchTermDaily: SearchTermDayRow[];
  products: ProductInfo[];
  productDaily: ProductDayRow[];
};

export type AggregateOptions = {
  /** ROAS de equilíbrio (1 ÷ margem). Sem margem, null. */
  breakEvenRoas: number | null;
  /** Dias do fim do período com conversões ainda chegando. */
  maturingDays?: number;
};

// ---- view models ------------------------------------------------------------------------

export type ValueFormat = "money" | "int" | "decimal" | "pct" | "ratio" | "seconds";
export type Better = "up" | "down" | "neutral";

export type Kpi = {
  id: string;
  label: string;
  /** null = sem dado (ou investimento oculto). */
  value: number | null;
  previous: number | null;
  /** Variação relativa (0,08 = +8%). null quando não dá para comparar. */
  delta: number | null;
  format: ValueFormat;
  better: Better;
  /** Série diária para a sparkline (null = sem dado no dia). */
  spark: (number | null)[];
  /** Texto curto embaixo do número (ex.: "equilíbrio 2,5"). */
  note?: string;
  help?: string;
  /** Envolve investimento (some com hideSpend). */
  spendBased?: boolean;
};

export type DailyPoint = {
  date: string;
  spend: number | null;
  value: number;
  conversions: number;
  roas: number | null;
  maturing: boolean;
};

export type Totals = {
  /** null só com o investimento oculto. */
  spend: number | null;
  impressions: number;
  clicks: number;
  linkClicks: number | null;
  conversions: number;
  value: number;
  ctr: number | null;
  linkCtr: number | null;
  cpc: number | null;
  cpm: number | null;
  roas: number | null;
  cpa: number | null;
  ticket: number | null;
  frequency: number | null;
};

export type CampaignRowVM = {
  id: string;
  name: string;
  status: string;
  /** Meta: etapa do funil; Google: tipo de campanha. */
  kind: string | null;
  spend: number | null;
  /** Fatia do investimento do período (0–1). */
  spendShare: number;
  value: number;
  conversions: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
  linkCtr: number | null;
  cpc: number | null;
  cpm: number | null;
  frequency: number | null;
  impressions: number;
  /** Google, pesquisa: parcela e perdas ponderadas pelas impressões elegíveis. */
  impressionShare: number | null;
  lostBudget: number | null;
  lostRank: number | null;
  /** Abaixo do equilíbrio. */
  belowBreakEven: boolean;
  /** Métricas opcionais do Personalizar, por id. */
  extra?: Record<string, number | null>;
  /** O que conta como resultado no objetivo desta campanha ("compras", "leads"). */
  resultLabel?: string;
};

export type FunnelStep = { id: string; label: string; count: number; /** Passagem desde a etapa anterior. */ rate: number | null; /** Custo por etapa. */ cost: number | null };

export type FunnelByStage = { stage: string; label: string; spend: number | null; linkClicks: number; addToCart: number; conversions: number; convRate: number | null; roas: number | null };

export type CreativeVM = {
  id: string;
  name: string;
  campaignName: string;
  format: string;
  status: string;
  headline: string | null;
  thumbnailUrl: string | null;
  spend: number | null;
  value: number;
  conversions: number;
  roas: number | null;
  linkCtr: number | null;
  frequency: number | null;
  /** Visualizações de 3 s ÷ impressões (só vídeo). */
  hookRate: number | null;
  /** ThruPlays ÷ visualizações de 3 s. */
  holdRate: number | null;
  /** Frequência subindo e CTR caindo entre a 1ª e a 2ª metade do período. */
  fatigue: { frequencyChange: number; ctrChange: number } | null;
  /** CTR do link por dia (sparkline). */
  ctrSpark: (number | null)[];
};

/** Linha da lista de criativos (todos os planos). */
export type CreativeListVM = {
  id: string;
  name: string;
  campaignName: string;
  status: string;
  spend: number | null;
  /** Resultado principal do objetivo da campanha. */
  result: { label: string; value: number };
};

/** Um anúncio com os dias dele, para o comparativo (só Avançado, só na aba Comparativo). */
export type CompareAd = {
  id: string;
  name: string;
  campaignName: string;
  objective: string | null;
  format: string;
  status: string;
  headline: string | null;
  thumbnailUrl: string | null;
  postUrl: string | null;
  days: Omit<AdDayRow, "adId">[];
};

/** Métrica nova num dashboard de amostra: o valor vem do servidor, na escala do modelo. */
export type SampleExtraMetric = { id: string; label: string; format: ValueFormat; better: "up" | "down" | "neutral"; value: number | null; previous: number | null };

export type CreativesTab = "galeria" | "comparativo";
export type CreativesLevel = "list" | "gallery" | "compare";

/** O que a página de Criativos recebe: só o que o plano cobre. */
export type CreativesData = {
  level: CreativesLevel;
  tab: CreativesTab;
  list: CreativeListVM[];
  gallery: CreativeVM[];
  compare: CompareAd[];
  initialAds: string[];
  hideSpend: boolean;
  currency: string;
  breakEvenRoas: number | null;
  /** Plano para a amostra com blur. null = sem oferta (link compartilhado, prévias). */
  upsellTier: Tier | null;
};

export type SliceVM = { key: string; label: string; spend: number | null; spendShare: number; value: number; valueShare: number; conversions: number; roas: number | null; cpa: number | null; ctr: number | null };

export type AgeGenderCell = { age: string; gender: string; spend: number | null; value: number; conversions: number; roas: number | null; valueShare: number };

/** Mapa de calor dia da semana × hora (0 = domingo). */
export type HeatCell = { weekday: number; hour: number; conversions: number; value: number; spend: number | null };

export type SearchTermVM = {
  term: string;
  matchType: string;
  campaignName: string;
  spend: number | null;
  clicks: number;
  impressions: number;
  conversions: number;
  value: number;
  roas: number | null;
  cpa: number | null;
  ctr: number | null;
};

export type ProductVM = {
  id: string;
  title: string;
  category: string | null;
  price: number | null;
  imageUrl: string | null;
  spend: number | null;
  value: number;
  valueShare: number;
  conversions: number;
  roas: number | null;
  ctr: number | null;
};

export type ChannelVM = { channel: string; label: string; spend: number | null; spendShare: number; value: number; valueShare: number; conversions: number; roas: number | null; cpa: number | null };

export type ImpressionShareVM = {
  /** Ponderadas pelas impressões elegíveis (impressões ÷ parcela). */
  share: number | null;
  lostBudget: number | null;
  lostRank: number | null;
  previousShare: number | null;
  daily: { date: string; share: number | null }[];
};

type ViewBase = {
  /** Cards padrão (é o que o app desenha). */
  kpis: Kpi[];
  /** Cards que o usuário pode ligar em "Personalizar". */
  extraKpis?: Kpi[];
  daily: DailyPoint[];
  totals: Totals;
  previousTotals: Totals;
  campaigns: CampaignRowVM[];
  breakEvenRoas: number | null;
  /** Há dados no período atual. */
  hasData: boolean;
};

export type MetaView = ViewBase & {
  platform: "meta";
  funnel: FunnelStep[];
  funnelByStage: FunnelByStage[];
  creatives: CreativeVM[];
  creativeList: CreativeListVM[];
  creativeDays: CompareAd[];
  /** As campanhas do período têm tipos de resultado diferentes: sem card de Resultados. */
  resultsMixed?: boolean;
  ageGender: AgeGenderCell[];
  placements: SliceVM[];
  devices: SliceVM[];
  regions: SliceVM[];
};

export type GoogleView = ViewBase & {
  platform: "google";
  channels: ChannelVM[];
  devices: SliceVM[];
  heatmap: HeatCell[];
  impressionShare: ImpressionShareVM;
  searchTerms: SearchTermVM[];
  wastedTerms: SearchTermVM[];
  wastedSpend: number | null;
  /** Fatia do investimento em termos que gastaram sem converter (0–1). */
  wastedShare: number;
  products: ProductVM[];
  productCategories: SliceVM[];
};

export type DashboardView = MetaView | GoogleView;

export type LiveAccount = { id: string; name: string; currency: string; timeZone: string; lastSyncedAt: string | null };

/** O que o servidor manda para o componente cliente. */
export type LiveDashboardData = {
  dashboard: { id: string; name: string; clientName: string; templateId: string };
  platform: LivePlatform;
  /** "ok" | sem contas ativas ligadas | sem nenhuma linha no período. */
  status: "ok" | "no_accounts" | "no_data";
  accounts: LiveAccount[];
  currency: string;
  timeZone: string;
  current: DateRange;
  previous: DateRange;
  /** Primeiro dia em maturação (inclusive), ou null. */
  maturingFrom: string | null;
  hideSpend: boolean;
  /** Prévia com dados do gerador (galeria/onboarding). */
  sample: boolean;
  /** Página de Criativos já cortada pelo plano (servidor). Sem isso: prévia, com a galeria. */
  creatives?: CreativesData;
  view: DashboardView;
};
