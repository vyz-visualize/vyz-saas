import type { DashboardTemplate } from "../../types";

export default {
  id: "infoproduto-lancamento",
  name: "Infoproduto · Lançamento",
  category: "Leads",
  tier: "avancado",
  profile: "infoproduto",
  sources: ["meta", "google", "ga4"],
  pages: ["visao-geral", "funil", "criativos", "metas", "publico"],
  description: "Captação, aquecimento e carrinho aberto: custo por lead, conversão da página de vendas, criativos que puxam inscrição e a meta do lançamento.",
} satisfies DashboardTemplate;
