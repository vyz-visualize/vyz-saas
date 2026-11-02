import type { DashboardTemplate } from "../../types";

export default {
  id: "funil-ga4",
  name: "Funil do site · GA4",
  category: "E-commerce",
  tier: "pro",
  profile: "site",
  sources: ["ga4"],
  pages: ["visao-geral", "funil", "comparativo"],
  description: "Sessões, taxa de conversão, receita e o funil do site, etapa por etapa.",
} satisfies DashboardTemplate;
