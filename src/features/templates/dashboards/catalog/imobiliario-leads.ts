import type { DashboardTemplate } from "../../types";

export default {
  id: "imobiliario-leads",
  name: "Imobiliário · Leads",
  category: "Imobiliário",
  tier: "avancado",
  profile: "imob",
  sources: ["meta", "google"],
  pages: ["visao-geral", "campanhas", "por-plataforma"],
  description: "CPL qualificado em destaque, dispersão por empreendimento e o funil lead → visita → proposta.",
} satisfies DashboardTemplate;
