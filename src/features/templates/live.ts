// Templates com dados reais: leem o que a sincronização grava das contas
// conectadas (insights_* no banco). Os de DASHBOARD_TEMPLATES usam dados de
// exemplo. Os dois juntos formam o catálogo (npm run db:catalog).

import { IMPORT_PLATFORMS } from "@/features/accounts/connection-modes";
import { DASHBOARD_TEMPLATES } from "./dashboards";
import { COMPOSED_TEMPLATES } from "./dashboards/composed";
import type { DashboardTemplate } from "./types";

export const LIVE_TEMPLATES: DashboardTemplate[] = [
  {
    id: "meta-ecommerce",
    name: "Meta Ads · E-commerce",
    category: "E-commerce",
    tier: "base",
    profile: "ecommerce",
    // Instagram e Página entram opcionais: com eles, a aba Orgânico mostra os números deles
    sources: ["meta", "instagram", "facebook"],
    pages: ["visao-geral", "campanhas", "funil", "criativos", "publico", "organico"],
    description: "Receita, ROAS e custo por compra no topo, o funil do clique à compra, os criativos que vendem e quem compra.",
    dataMode: "live",
  },
  {
    id: "google-ecommerce",
    name: "Google Ads · E-commerce",
    category: "E-commerce",
    tier: "base",
    profile: "ecommerce",
    sources: ["google"],
    pages: ["visao-geral", "campanhas", "termos", "produtos"],
    description: "Valor de conversão e ROAS por tipo de campanha, parcela de impressões, termos de pesquisa e os produtos que mais vendem.",
    dataMode: "live",
  },
  {
    // plataformas sem API (Shopee, Spotify, Globo, ChatGPT Ads): os dados entram por planilha em Contas
    id: "planilha-midia",
    name: "Planilha · Mídia paga",
    category: "Mídia",
    tier: "avancado",
    profile: "midia",
    sources: IMPORT_PLATFORMS,
    pages: ["visao-geral", "campanhas"],
    description: "Para as plataformas que entram por planilha (CSV ou Google Sheets): investimento, receita, ROAS e custo por conversão por dia e por campanha.",
    dataMode: "live",
  },
  {
    id: "meta-organico",
    name: "Instagram e Página · Orgânico",
    category: "Mídia",
    tier: "base",
    profile: "midia",
    sources: ["instagram", "facebook"],
    pages: ["organico", "conteudo"],
    description: "Seguidores, visualizações, alcance e engajamento do Instagram e da Página do Facebook, com o ranking dos posts, reels e stories.",
    dataMode: "live",
  },
  {
    id: "meta-organico-pago",
    name: "Meta · Orgânico + Anúncios",
    category: "Mídia",
    tier: "base",
    profile: "ecommerce",
    sources: ["meta", "instagram", "facebook"],
    pages: ["visao-geral", "organico", "conteudo", "campanhas", "criativos"],
    description: "O resultado dos anúncios ao lado do orgânico: vendas e ROAS, seguidores, alcance e o conteúdo que mais engaja.",
    dataMode: "live",
  },
];

/** Todos os templates (exemplo + dados reais). */
export const ALL_DASHBOARD_TEMPLATES: DashboardTemplate[] = [...COMPOSED_TEMPLATES, ...LIVE_TEMPLATES, ...DASHBOARD_TEMPLATES];

export function anyDashboardTemplate(id: string): DashboardTemplate | undefined {
  return ALL_DASHBOARD_TEMPLATES.find((t) => t.id === id);
}

export const isLiveTemplate = (id: string) => LIVE_TEMPLATES.some((t) => t.id === id);

/** Plataformas que um modelo comum já lê das contas reais (as outras ficam na amostra). */
export const REAL_DATA_PLATFORMS = ["meta", "google", "ga4", "instagram", "facebook"] as const;

/** O modelo deixa escolher contas: os "ao vivo" sempre; os outros, se usam Meta ou Google. */
export const usesAccounts = (t: Pick<DashboardTemplate, "id" | "sources">) => isLiveTemplate(t.id) || t.sources.some((s) => (REAL_DATA_PLATFORMS as readonly string[]).includes(s));

