import type { DashboardTemplate } from "../../types";

export default {
  id: "mmm-mix-midia",
  name: "MMM · Mix de mídia",
  category: "Executivo",
  tier: "avancado",
  profile: "ecommerce",
  sources: ["meta", "google", "tiktok", "youtube", "ga4"],
  pages: ["visao-geral", "por-plataforma", "comparativo", "metas"],
  description: "Marketing mix modeling: quanto cada canal gera de fato além da base, curvas de saturação, ROI marginal e a redistribuição da mesma verba que rende mais.",
  skin: "mmm",
} satisfies DashboardTemplate;
