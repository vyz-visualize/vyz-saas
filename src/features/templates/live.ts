// Templates com dados reais: leem o que a sincronização grava das contas
// conectadas (insights_* no banco). Os de DASHBOARD_TEMPLATES usam dados de
// exemplo. Os dois juntos formam o catálogo (npm run db:catalog).

import { IMPORT_PLATFORMS } from "@/features/accounts/connection-modes";
import { DASHBOARD_TEMPLATES } from "./dashboards";
import type { DashboardTemplate } from "./types";

export const LIVE_TEMPLATES: DashboardTemplate[] = [
  {
    id: "meta-ecommerce",
    name: "Meta Ads · E-commerce",
    category: "E-commerce",
    tier: "base",
    profile: "ecommerce",
    sources: ["meta"],
    pages: ["visao-geral", "campanhas", "funil", "criativos", "publico"],
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
];

/** Todos os templates (exemplo + dados reais). */
export const ALL_DASHBOARD_TEMPLATES: DashboardTemplate[] = [...LIVE_TEMPLATES, ...DASHBOARD_TEMPLATES];

export function anyDashboardTemplate(id: string): DashboardTemplate | undefined {
  return ALL_DASHBOARD_TEMPLATES.find((t) => t.id === id);
}

export const isLiveTemplate = (id: string) => LIVE_TEMPLATES.some((t) => t.id === id);
