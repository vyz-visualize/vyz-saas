import type { DashboardTemplate } from "../../types";

export default {
  id: "clinicas-saude",
  name: "Clínicas e saúde",
  category: "Negócio local",
  tier: "avancado",
  profile: "saude",
  sources: ["meta", "google"],
  pages: ["visao-geral", "funil", "campanhas"],
  description: "Custo por agendamento, leads e o funil do lead à consulta.",
} satisfies DashboardTemplate;
