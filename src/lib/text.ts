// Texto para comparar e buscar.

/** Sem acentos e em minúsculas: "Pão de Açúcar" → "pao de acucar". */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
