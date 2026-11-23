import type { Visual } from "../composed";

/** Padrão VYZ: O visual da casa: claro ou escuro, números grandes e leitura rápida. */
export default {
  id: "vyz",
  name: "Padrão VYZ",
  tier: "base",
  description: "O visual da casa: claro ou escuro, números grandes e leitura rápida.",
  forWhom: "Para uma visão rápida.",
  only: "números grandes, claro ou escuro",
} satisfies Visual;
