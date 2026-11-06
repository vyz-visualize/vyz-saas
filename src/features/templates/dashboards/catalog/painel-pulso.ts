import type { DashboardTemplate } from "../../types";

export default {
  id: "painel-pulso",
  name: "Pulso · Leads e metas",
  category: "Leads",
  tier: "base",
  profile: "leads",
  sources: ["meta", "google", "ga4"],
  pages: ["visao-geral", "campanhas", "por-plataforma", "funil"],
  description: "Visual roxo e rosa com menu de ícones: a curva de leads com o pico marcado, custo por lead, progresso das principais campanhas, criativos e público.",
  skin: "pulso",
} satisfies DashboardTemplate;
