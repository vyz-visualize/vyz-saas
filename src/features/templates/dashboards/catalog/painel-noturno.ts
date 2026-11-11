import type { DashboardTemplate } from "../../types";

export default {
  id: "painel-noturno",
  name: "Noturno · Vendas da loja",
  category: "E-commerce",
  tier: "avancado",
  profile: "ecommerce",
  sources: ["meta", "google", "ga4"],
  pages: ["visao-geral", "produtos", "campanhas", "por-plataforma", "funil"],
  description: "Visual escuro em azul-noite e âmbar: receita, investimento, ROAS e custo por venda com a tendência, receita por dia, canais em anéis, funil de compra, produtos e campanhas.",
  skin: "noturno",
} satisfies DashboardTemplate;
