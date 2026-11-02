import type { DashboardTemplate } from "../../types";

export default {
  id: "youtube-video",
  name: "YouTube e vídeo",
  category: "Mídia",
  tier: "avancado",
  profile: "video",
  sources: ["youtube"],
  pages: ["visao-geral", "criativos", "publico"],
  description: "Visualizações, custo por visualização e taxa de visualização por formato.",
} satisfies DashboardTemplate;
