import type { DashboardTemplate } from "../../types";

export default {
  id: "infoproduto",
  name: "Lançamento e infoproduto",
  category: "Leads",
  tier: "pro",
  profile: "infoproduto",
  sources: ["meta", "google", "ga4"],
  pages: ["visao-geral", "funil", "metas", "criativos"],
  description: "Captação, custo por lead, vendas e ROAS do lançamento, com metas e criativos.",
} satisfies DashboardTemplate;
