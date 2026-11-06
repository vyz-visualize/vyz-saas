import type { DashboardTemplate } from "../../types";

export default {
  id: "previsao-kpis",
  name: "Previsão de KPIs · Análise preditiva",
  category: "Executivo",
  tier: "avancado",
  profile: "ecommerce",
  sources: ["meta", "google", "ga4"],
  pages: ["visao-geral", "metas", "comparativo", "campanhas"],
  description: "Projeção de receita, conversões e investimento até o fim do mês com faixa de confiança, chance de bater a meta, simulador de verba e dias fora do padrão.",
  skin: "previsao",
} satisfies DashboardTemplate;
