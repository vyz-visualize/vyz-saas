import type { DashboardTemplate } from "../../types";

export default {
  id: "relatorio-executivo",
  name: "Relatório executivo",
  category: "Executivo",
  tier: "avancado",
  profile: "executivo",
  sources: ["meta", "google", "ga4"],
  pages: ["executivo", "comparativo", "metas"],
  description: "Uma página para a diretoria: investimento, receita, ROAS e CPA com a tendência.",
} satisfies DashboardTemplate;
