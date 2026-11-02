import type { DashboardTemplate } from "../../types";

export default {
  id: "varejo-local",
  name: "Varejo local · Visitas e rotas",
  category: "Negócio local",
  tier: "base",
  profile: "local",
  sources: ["meta", "google"],
  pages: ["visao-geral", "por-plataforma", "campanhas", "funil"],
  description: "Para loja física: pedidos de rota, ligações e conversas no WhatsApp, custo por contato e o que cada canal traz para a porta.",
} satisfies DashboardTemplate;
