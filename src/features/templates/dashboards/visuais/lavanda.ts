import type { Visual } from "../composed";

/** Lavanda: Claro, em lilás: cards suaves e gráficos arredondados. */
export default {
  id: "lavanda",
  name: "Lavanda",
  skin: "lavanda",
  tier: "base",
  description: "Claro, em lilás: cards suaves e gráficos arredondados.",
  forWhom: "Para apresentar ao cliente.",
  only: "resumo do mês em texto e os destaques",
  recommended: ["agencia", "local"],
} satisfies Visual;
