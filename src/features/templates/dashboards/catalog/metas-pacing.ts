import type { DashboardTemplate } from "../../types";

export default {
  id: "metas-pacing",
  name: "Metas e pacing de verba",
  category: "Executivo",
  tier: "avancado",
  profile: "leads",
  sources: ["meta", "google"],
  pages: ["metas", "visao-geral", "comparativo"],
  description: "Quanto da verba já foi, a projeção do mês e o progresso de cada meta.",
} satisfies DashboardTemplate;
