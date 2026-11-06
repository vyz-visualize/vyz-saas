import type { DashboardTemplate } from "../../types";

export default {
  id: "painel-monocromo",
  name: "Monocromo · Gestão de campanhas",
  category: "Agência",
  tier: "base",
  profile: "agencia",
  sources: ["meta", "google", "ga4"],
  pages: ["visao-geral", "campanhas", "por-plataforma", "funil"],
  description: "Visual preto e branco em vidro fosco: linha do tempo das campanhas, tendência contra o período anterior, melhor criativo, relatórios e o resumo por canal.",
  skin: "monocromo",
} satisfies DashboardTemplate;
