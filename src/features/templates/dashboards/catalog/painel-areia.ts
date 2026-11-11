import type { DashboardTemplate } from "../../types";

export default {
  id: "painel-areia",
  name: "Areia · Leads e CRM",
  category: "Leads",
  tier: "avancado",
  profile: "leads",
  sources: ["meta", "google", "crm"],
  pages: ["visao-geral", "leads-crm", "campanhas", "funil"],
  description: "Visual claro em tons de areia e terracota: leads, custo por lead, qualificados e vendas do CRM, leads por dia, funil do CRM, origem dos leads, verba do mês e custo por campanha.",
  skin: "areia",
} satisfies DashboardTemplate;
