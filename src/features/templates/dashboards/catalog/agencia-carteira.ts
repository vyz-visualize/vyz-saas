import type { DashboardTemplate } from "../../types";

export default {
  id: "agencia-carteira",
  name: "Agência · Carteira de clientes",
  category: "Agência",
  tier: "pro",
  profile: "agencia",
  sources: ["meta", "google"],
  pages: ["carteira", "visao-geral", "metas"],
  description: "Todos os clientes numa tela, com CPA contra a meta de cada um.",
} satisfies DashboardTemplate;
