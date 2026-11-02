import type { DashboardTemplate } from "../../types";

export default {
  id: "comparativo-canais",
  name: "Comparativo de canais",
  category: "Executivo",
  tier: "avancado",
  profile: "ecommerce",
  sources: ["meta", "google", "tiktok", "ga4"],
  pages: ["canais", "por-plataforma", "comparativo"],
  description: "Meta, Google e TikTok na mesma régua: custo, retorno e o que cada um atribui.",
} satisfies DashboardTemplate;
