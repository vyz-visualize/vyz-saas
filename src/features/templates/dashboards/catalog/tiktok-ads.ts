import type { DashboardTemplate } from "../../types";

export default {
  id: "tiktok-ads",
  name: "TikTok Ads",
  category: "Mídia",
  tier: "avancado",
  profile: "midia",
  sources: ["tiktok"],
  pages: ["visao-geral", "criativos", "publico"],
  description: "Resultados, custo por resultado e criativos do TikTok, com o público que converte.",
} satisfies DashboardTemplate;
