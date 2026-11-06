import type { DashboardTemplate } from "../../types";

export default {
  id: "painel-lavanda",
  name: "Lavanda · Receita e campanhas",
  category: "E-commerce",
  tier: "base",
  profile: "ecommerce",
  sources: ["meta", "google", "ga4"],
  pages: ["visao-geral", "campanhas", "por-plataforma", "funil"],
  description: "Visual lilás e escuro: custo por compra, receita por semana, ROAS e investimento por plataforma no topo, e a lista de campanhas com o detalhe da escolhida.",
  skin: "lavanda",
} satisfies DashboardTemplate;
