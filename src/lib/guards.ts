// Checagens de tipo para dados que chegam sem tipo (JSON do banco, de APIs ou do usuário).

/** Objeto simples: não nulo e não array. */
export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
