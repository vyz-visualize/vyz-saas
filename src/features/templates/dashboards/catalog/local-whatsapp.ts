import type { DashboardTemplate } from "../../types";

export default {
  id: "local-whatsapp",
  name: "Negócio local · WhatsApp e ligações",
  category: "Negócio local",
  tier: "avancado",
  profile: "local",
  sources: ["meta", "google"],
  pages: ["visao-geral", "campanhas", "por-plataforma"],
  description: "Custo por conversa, conversas no WhatsApp, ligações e o pacing da verba.",
} satisfies DashboardTemplate;
