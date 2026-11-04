import type { DashboardTemplate } from "../../types";

export default {
  id: "ecommerce-visao-geral",
  name: "E-commerce · Visão geral",
  category: "E-commerce",
  tier: "pro",
  profile: "ecommerce",
  sources: ["meta", "google", "ga4"],
  pages: ["visao-geral", "por-plataforma", "campanhas", "funil"],
  description: "Custo por venda, vendas confirmadas sem dupla contagem, receita, ROAS com equilíbrio e funil até a compra.",
} satisfies DashboardTemplate;
