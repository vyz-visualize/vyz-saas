import type { DashboardTemplate } from "../../types";

export default {
  id: "google-pesquisa",
  name: "Google Ads · Pesquisa",
  category: "Mídia",
  tier: "pro",
  profile: "pesquisa",
  sources: ["google"],
  pages: ["visao-geral", "campanhas", "comparativo"],
  description: "Conversões, CPA, CTR e CPC das campanhas de pesquisa, com o comparativo de períodos.",
} satisfies DashboardTemplate;
