import type { DashboardTemplate } from "../../types";

export default {
  id: "criativos-ao-vivo",
  name: "Criativos ao vivo · Comparativo de performance",
  category: "Mídia",
  tier: "avancado",
  profile: "ecommerce",
  sources: ["meta", "tiktok", "google"],
  pages: ["visao-geral", "criativos", "comparativo", "publico"],
  description: "Ranking de criativos atualizado em tempo real, duelo entre dois criativos com a confiança estatística da diferença e alerta de fadiga.",
  skin: "criativos-ao-vivo",
} satisfies DashboardTemplate;
