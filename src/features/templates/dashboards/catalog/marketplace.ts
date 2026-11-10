import type { DashboardTemplate } from "../../types";

export default {
  id: "marketplace",
  name: "Marketplace · Shopee Ads",
  category: "E-commerce",
  tier: "avancado",
  profile: "marketplace",
  sources: ["shopee"],
  pages: ["visao-geral", "produtos", "campanhas"],
  description: "Vendas, receita e ROAS dos anúncios dentro das lojas, produto a produto.",
} satisfies DashboardTemplate;
