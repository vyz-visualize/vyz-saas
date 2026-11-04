// Lista de espera das landing pages: regras puras (o servidor e a tela usam as mesmas).

export const WAITLIST_USE_CASE_MAX = 500;

/** "Para que você usaria?": opcional. Vazio vira null; texto acima do limite é inválido. */
export function normalizeUseCase(raw: unknown): string | null | "invalid" {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return "invalid";
  const v = raw.trim();
  if (!v) return null;
  return v.length > WAITLIST_USE_CASE_MAX ? "invalid" : v;
}
