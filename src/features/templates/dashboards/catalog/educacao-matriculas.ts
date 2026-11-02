import type { DashboardTemplate } from "../../types";

export default {
  id: "educacao-matriculas",
  name: "Educação · Matrículas",
  category: "Leads",
  tier: "avancado",
  profile: "educacao",
  sources: ["meta", "google", "crm"],
  pages: ["visao-geral", "funil", "leads-crm"],
  description: "Matrículas, custo por matrícula e o caminho do lead até a matrícula.",
} satisfies DashboardTemplate;
