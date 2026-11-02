import type { DashboardTemplate } from "../../types";

export default {
  id: "crm-lead-venda",
  name: "CRM · Do lead à venda",
  category: "Leads",
  tier: "avancado",
  profile: "leads",
  sources: ["meta", "google", "crm"],
  pages: ["leads-crm", "visao-geral", "funil"],
  description: "Lead, MQL, SQL, proposta e venda, com o valor parado em cada etapa.",
} satisfies DashboardTemplate;
