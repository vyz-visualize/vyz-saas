import type { DashboardTemplate } from "../../types";

export default {
  id: "leads-visao-geral",
  name: "Geração de leads · Visão geral",
  category: "Leads",
  tier: "base",
  profile: "leads",
  sources: ["meta", "google", "ga4"],
  pages: ["visao-geral", "por-plataforma", "campanhas", "funil"],
  description: "CPL, leads qualificados, CPL por campanha contra a meta e o funil do clique ao lead qualificado.",
} satisfies DashboardTemplate;
