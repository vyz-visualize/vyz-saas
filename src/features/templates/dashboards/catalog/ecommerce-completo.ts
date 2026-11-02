import type { DashboardTemplate } from "../../types";

export default {
  id: "ecommerce-completo",
  name: "E-commerce · Completo com áudio",
  category: "E-commerce",
  tier: "avancado",
  profile: "ecommerce",
  sources: ["meta", "google", "ga4"],
  pages: ["visao-geral", "por-plataforma", "produtos", "criativos", "metas", "audio"],
  description: "Tudo do e-commerce num lugar só: receita e ROAS por canal, produtos que vendem, criativos, meta do mês e a leitura por áudio dos números.",
} satisfies DashboardTemplate;
