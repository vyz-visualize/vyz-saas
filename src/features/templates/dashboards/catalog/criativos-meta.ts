import type { DashboardTemplate } from "../../types";

export default {
  id: "criativos-meta",
  name: "Criativos · Meta Ads",
  category: "Mídia",
  tier: "avancado",
  profile: "midia",
  sources: ["meta"],
  pages: ["criativos", "visao-geral", "publico"],
  description: "Grade de anúncios com CTR, CPA e frequência para decidir o que renovar.",
} satisfies DashboardTemplate;
