import type { PlatformId } from "@/features/accounts/platforms";
import type { MetricId, Profile } from "@/features/metrics/definitions";
import type { Tier } from "@/features/pricing/entitlements";

/** Largura num grid de 4 colunas (em telas estreitas, tudo vira 1 ou 2). */
export type Span = 1 | 2 | 3 | 4;

export type KpiSub = "delta" | "split" | "breakEven" | "ofLeads" | "budget" | "goal";
export type KpiSpec = { metric: MetricId; sub?: KpiSub; highlight?: boolean };

export type WidgetSpec = { span?: Span; title?: string } & (
  | { type: "line"; metric: MetricId; goal?: boolean }
  | { type: "funnel" }
  | { type: "bars"; source: "campaigns" | "platforms" | "clients"; metric: "roas" | "cpa" | "conversions" | "spend"; reference?: "breakEven" | "goal" }
  | { type: "scatter" }
  | { type: "split" }
  | { type: "platforms" }
  | { type: "table"; source: "campaigns" | "products" | "clients" }
  | { type: "creatives" }
  | { type: "goals" }
  | { type: "audience" }
  | { type: "compare" }
  | { type: "crm" }
  | { type: "alerts" }
  | { type: "audio" }
);

export type PageLayout = { kpis: KpiSpec[]; widgets: WidgetSpec[] };

export type PageId =
  | "visao-geral"
  | "por-plataforma"
  | "campanhas"
  | "funil"
  | "criativos"
  | "metas"
  | "publico"
  | "comparativo"
  | "leads-crm"
  | "produtos"
  | "audio"
  | "carteira"
  | "canais"
  | "saude-conta"
  | "executivo"
  | "termos"
  | "organico"
  | "conteudo"
  // páginas montadas pelas plataformas escolhidas (modelos novos: visual + objetivo + contas)
  | "meta-ads"
  | "google-ads"
  | "site"
  | "canais-site"
  | "instagram"
  | "pagina-facebook"
  | "crm"
  // recursos do Avançado, escolhidos no novo dashboard (desenhados pelos visuais deles)
  | "criativos-ao-vivo"
  | "previsao"
  | "mmm";

export type BuildContext = { profile: Profile; sources: PlatformId[] };

export type PageDef = {
  id: PageId;
  name: string;
  /** Plano mínimo para usar a página. */
  tier: "base" | "pro" | "avancado";
  description: string;
  /** Só aparece nos templates que já a trazem. */
  templateOnly?: boolean;
  soon?: boolean;
  build: (ctx: BuildContext) => PageLayout;
};

export type DashboardCategory = "E-commerce" | "Leads" | "Imobiliário" | "Negócio local" | "Agência" | "Mídia" | "Executivo";

/** Visual próprio da primeira aba (features/dashboards/skins). */
export type SkinId = "lavanda" | "pulso" | "monocromo" | "noturno" | "areia" | "criativos-ao-vivo" | "previsao" | "mmm";

export type DashboardTemplate = {
  id: string;
  name: string;
  category: DashboardCategory;
  tier: Exclude<Tier, "personalizado">;
  profile: Profile;
  sources: PlatformId[];
  pages: PageId[];
  description: string;
  /** live = lê os dados sincronizados das contas; sample (padrão) = dados de exemplo. */
  dataMode?: "sample" | "live";
  /** Com visual próprio, a primeira aba é desenhada no estilo dele. */
  skin?: SkinId;
  /** Modelo antigo: continua abrindo os dashboards que já existem, mas não é mais oferecido. */
  legacy?: boolean;
  /** Modelo novo (visual + objetivo): as páginas saem das contas escolhidas (compose.ts). */
  composed?: { visual: string; objective: string };
};
