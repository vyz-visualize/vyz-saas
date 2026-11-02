import type { DashboardTemplate } from "../../types";

export default {
  id: "saude-conta",
  name: "Saúde da conta e alertas",
  category: "Agência",
  tier: "avancado",
  profile: "ecommerce",
  sources: ["meta", "google", "ga4"],
  pages: ["saude-conta", "por-plataforma", "campanhas"],
  description: "Alertas de CPA acima da meta, frequência alta, maturação e tags.",
} satisfies DashboardTemplate;
